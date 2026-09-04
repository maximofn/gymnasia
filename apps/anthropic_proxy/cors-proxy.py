"""
Lightweight CORS proxy for testing the mobile app in browser.
Routes Anthropic API calls through localhost to bypass browser CORS restrictions.

Usage:
    python cors-proxy.py
    # or: uvicorn cors-proxy:app --port 8000

Runs on http://127.0.0.1:8000. Point EXPO_PUBLIC_API_BASE_URL at it to use
Anthropic from the browser; the client default is empty on purpose.

Este fichero es deliberadamente UNO SOLO, sin modulos hermanos: el runbook lo
arranca por el symlink `apps/mobile/cors-proxy.py`, asi que `sys.path[0]` es
`apps/mobile/` y no este directorio. Un `from helpers import ...` reventaria en
el arranque documentado mientras las pruebas (que cargan por ruta real) pasarian
en verde.
"""

import json
import os
import re
import socket
import sys
from typing import Any, Literal
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

try:
    from fastapi import FastAPI
    from fastapi.exceptions import RequestValidationError
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, StreamingResponse
    from pydantic import BaseModel, ConfigDict, Field, field_validator
except ImportError:
    print("Install the proxy dependencies: uv sync --extra dev")
    sys.exit(1)

ANTHROPIC_API = os.environ.get(
    "ANTHROPIC_PROXY_UPSTREAM_BASE_URL", "https://api.anthropic.com"
).rstrip("/")
ANTHROPIC_API_VERSION = "2023-06-01"
DEFAULT_VERIFY_MODEL = "claude-3-5-sonnet-latest"

VERIFY_TIMEOUT_SECONDS = 15
MODELS_TIMEOUT_SECONDS = 15
MESSAGES_TIMEOUT_SECONDS = 120

MAX_REQUEST_BYTES = 4 * 1024 * 1024
MAX_API_KEY_LENGTH = 400
MAX_MODEL_ID_LENGTH = 200
MAX_MESSAGES = 500
MAX_OUTPUT_TOKENS = 200_000
MAX_ERROR_MESSAGE_CHARS = 2000

# Cuanto se solapa entre dos trozos del stream al buscar el evento terminal.
# Sin esto, un "message_stop" partido justo en la frontera de dos lecturas de
# 1024 bytes se daria por no visto y el proxy inventaria un error inexistente.
STREAM_CHUNK_BYTES = 1024
STREAM_OVERLAP_BYTES = 32
STREAM_TERMINAL_MARKER = b"message_stop"

# Paginacion del catalogo de modelos. Anthropic admite `limit` de 1 a 1000; 100
# es conservador y basta para el catalogo actual en una sola vuelta.
MODELS_PAGE_LIMIT = 100
MODELS_MAX_PAGES = 20


# --------------------------------------------------------------------------
# Redaccion de secretos
# --------------------------------------------------------------------------

_SECRET_PATTERNS = (
    re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"sk-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"(?i)(x-api-key|authorization)\s*[:=]\s*\S+"),
)
REDACTED = "«redactado»"


def redact(text: str, *secrets: str, limit: int = MAX_ERROR_MESSAGE_CHARS) -> str:
    """Quita secretos de un texto antes de devolverlo al cliente.

    Tres capas: el valor literal de los secretos de esta peticion, los patrones
    de clave conocidos, y un truncado para que un upstream verborreico no
    convierta un error en un volcado.
    """
    cleaned = text
    for secret in secrets:
        value = (secret or "").strip()
        if len(value) >= 8:
            cleaned = cleaned.replace(value, REDACTED)
    for pattern in _SECRET_PATTERNS:
        cleaned = pattern.sub(REDACTED, cleaned)
    if len(cleaned) > limit:
        cleaned = cleaned[:limit] + "…"
    return cleaned


def error_payload(error_type: str, message: str) -> dict:
    """Forma que el cliente sabe leer.

    `extractErrorMessage` en App.tsx lee `error.message` antes que nada, y
    `errorMessage` en agent/providerStreamParsers.ts hace lo mismo. Cualquier
    otra forma llega a la interfaz como un mensaje vacio.
    """
    return {"error": {"type": error_type, "message": message}}


# --------------------------------------------------------------------------
# Modelos de solicitud
# --------------------------------------------------------------------------


class ProxyRequestBase(BaseModel):
    api_key: str = Field(min_length=1, max_length=MAX_API_KEY_LENGTH)
    workspace_id: str = ""

    @field_validator("api_key")
    @classmethod
    def _require_non_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("la clave de API no puede estar vacia")
        return cleaned


class VerifyRequest(ProxyRequestBase):
    # El contrato de /verify lo definimos nosotros, no Anthropic: un campo que
    # no reconocemos es un error del cliente y conviene decirlo.
    model_config = ConfigDict(extra="forbid")
    model: str = Field(
        default=DEFAULT_VERIFY_MODEL, min_length=1, max_length=MAX_MODEL_ID_LENGTH
    )


class ModelsRequest(ProxyRequestBase):
    model_config = ConfigDict(extra="forbid")


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="allow")
    role: Literal["user", "assistant"]
    content: str | list[dict[str, Any]]


class MessagesRequest(ProxyRequestBase):
    # /messages SI acepta campos desconocidos: es una pasarela transparente de
    # la Messages API. La app ya manda `thinking`, `system`, `tools` y
    # `tool_choice`, y prohibir lo desconocido la romperia el dia que Anthropic
    # anada un parametro. Se validan los tipos de lo que si conocemos.
    model_config = ConfigDict(extra="allow")
    model: str = Field(min_length=1, max_length=MAX_MODEL_ID_LENGTH)
    max_tokens: int = Field(ge=1, le=MAX_OUTPUT_TOKENS)
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    stream: bool = False


def upstream_body(request: ProxyRequestBase) -> bytes:
    """Cuerpo que se manda a Anthropic, siempre sin las credenciales.

    Las credenciales viajan como cabecera. Construirlo aqui, y no con un `pop`
    en cada ruta, es lo que garantiza que ninguna ruta pueda reenviarlas por
    descuido.
    """
    payload = request.model_dump(exclude={"api_key", "workspace_id"})
    return json.dumps(payload).encode()


# --------------------------------------------------------------------------
# Aplicacion
# --------------------------------------------------------------------------

app = FastAPI(title="CORS Proxy")


@app.middleware("http")
async def limit_body_size(request, call_next):
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            if int(declared) > MAX_REQUEST_BYTES:
                return JSONResponse(
                    error_payload(
                        "request_too_large",
                        f"El cuerpo supera el limite de {MAX_REQUEST_BYTES} bytes.",
                    ),
                    status_code=413,
                )
        except ValueError:
            return JSONResponse(
                error_payload("invalid_request_error", "Cabecera content-length invalida."),
                status_code=400,
            )
    return await call_next(request)


# CORS se anade DESPUES del limitador a proposito. Starlette inserta cada
# middleware en la posicion 0, asi que el ultimo anadido es el mas externo: solo
# asi un 413 o un 422 salen con cabeceras CORS y el navegador puede leer el
# error en vez de mostrar un "Failed to fetch" generico.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _describe_validation_errors(errors: list[dict]) -> str:
    if not errors:
        return "El cuerpo de la peticion no es valido."
    first = errors[0]
    if first.get("type") == "json_invalid":
        return "El cuerpo de la peticion no es JSON valido."
    location = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    detail = first.get("msg", "valor invalido")
    return f"Cuerpo invalido en '{location}': {detail}." if location else f"Cuerpo invalido: {detail}."


MAX_VALIDATION_DETAILS = 10


def _safe_validation_detail(errors: list[dict]) -> list[dict]:
    """Detalle acotado y sin eco del cuerpo rechazado.

    Cada entrada de `exc.errors()` trae un campo `input` con el valor que fallo
    la validacion, es decir, justo la parte del cuerpo que puede contener la
    clave del usuario. Se descarta entera: se conservan solo el tipo, la
    posicion y el mensaje, cada uno con su propio limite.
    """
    resumen = []
    for error in errors[:MAX_VALIDATION_DETAILS]:
        resumen.append(
            {
                "type": str(error.get("type", ""))[:80],
                "loc": [str(parte)[:80] for parte in error.get("loc", ())][:10],
                "msg": redact(str(error.get("msg", "")), limit=300),
            }
        )
    return resumen


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc: RequestValidationError):
    """FastAPI devuelve `detail` como lista, y el cliente lo espera como texto.

    Sin este manejador, `extractErrorMessage` de App.tsx recibe un array donde
    espera una cadena y el usuario ve un mensaje inutil.
    """
    errors = exc.errors()
    return JSONResponse(
        {
            **error_payload("invalid_request_error", _describe_validation_errors(errors)),
            "detail": _safe_validation_detail(errors),
        },
        status_code=422,
    )


def anthropic_headers(api_key: str, workspace_id: str = "", *, stream: bool = False):
    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
    }
    normalized_workspace_id = (
        workspace_id.strip() if isinstance(workspace_id, str) else ""
    )
    if normalized_workspace_id:
        headers["anthropic-workspace-id"] = normalized_workspace_id
    if stream:
        headers["accept"] = "text/event-stream"
    return headers


def classify_failure(exc: Exception, api_key: str) -> tuple[int, dict]:
    """Traduce un fallo de la llamada a Anthropic a estado y cuerpo.

    Antes todo caia en un 502 con `str(e)` en crudo, que ademas podia arrastrar
    secretos. Ahora el cliente puede diferenciar un timeout de un DNS caido.
    """
    if isinstance(exc, HTTPError):
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except (ValueError, TypeError):
            return exc.code, error_payload("upstream_non_json", redact(raw, api_key))

    reason = getattr(exc, "reason", None)
    if isinstance(exc, (socket.timeout, TimeoutError)) or isinstance(
        reason, (socket.timeout, TimeoutError)
    ):
        return 504, error_payload("upstream_timeout", "Anthropic no respondio a tiempo.")
    if isinstance(exc, URLError):
        return 502, error_payload(
            "upstream_unreachable", "No se pudo contactar con la API de Anthropic."
        )
    if isinstance(exc, (ValueError, json.JSONDecodeError)):
        return 502, error_payload(
            "upstream_invalid_json",
            "Anthropic devolvio una respuesta que no se pudo interpretar.",
        )
    return 502, error_payload("upstream_error", redact(str(exc), api_key))


def upstream_failure(exc: Exception, api_key: str) -> JSONResponse:
    status, payload = classify_failure(exc, api_key)
    return JSONResponse(payload, status_code=status)


def failure_summary(exc: Exception, api_key: str) -> dict:
    """El mismo fallo, reducido a `{type, message}` para incrustarlo en una
    respuesta parcial de paginacion."""
    _, payload = classify_failure(exc, api_key)
    error = payload.get("error") if isinstance(payload, dict) else None
    if isinstance(error, dict):
        return {
            "type": error.get("type") or "upstream_error",
            "message": error.get("message") or "Fallo al pedir una pagina del catalogo.",
        }
    return {"type": "upstream_error", "message": "Fallo al pedir una pagina del catalogo."}


def read_json_upstream(request: Request, timeout: int):
    resp = urlopen(request, timeout=timeout)
    try:
        return json.loads(resp.read())
    finally:
        resp.close()


# --------------------------------------------------------------------------
# Rutas
# --------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/chat/providers/anthropic/verify")
def anthropic_verify(body: VerifyRequest):
    headers = anthropic_headers(body.api_key, body.workspace_id)
    payload = json.dumps(
        {
            "model": body.model,
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "hi"}],
        }
    ).encode()

    try:
        request = Request(
            f"{ANTHROPIC_API}/v1/messages", data=payload, headers=headers, method="POST"
        )
        data = read_json_upstream(request, VERIFY_TIMEOUT_SECONDS)
        return JSONResponse({"ok": True, "model": data.get("model", body.model)})
    except Exception as exc:  # noqa: BLE001 - se clasifica en upstream_failure
        return upstream_failure(exc, body.api_key)


def sse_error_event(error_type: str, message: str) -> bytes:
    """Error inyectado dentro del propio stream.

    Cuando el stream se corta ya se han enviado las cabeceras 200, asi que no se
    puede cambiar el codigo de estado. `createAnthropicStreamParser` lanza
    excepcion ante un evento cuyo `type` sea `error`, asi que esta es la unica
    forma de que un corte llegue al usuario como fallo y no como respuesta buena.
    """
    payload = json.dumps({"type": "error", "error": {"type": error_type, "message": message}})
    return f"event: error\ndata: {payload}\n\n".encode()


def iter_upstream_stream(resp, api_key: str):
    saw_terminal = False
    overlap = b""
    try:
        while True:
            chunk = resp.read(STREAM_CHUNK_BYTES)
            if not chunk:
                break
            if STREAM_TERMINAL_MARKER in overlap + chunk:
                saw_terminal = True
            overlap = chunk[-STREAM_OVERLAP_BYTES:]
            yield chunk
    except GeneratorExit:
        # Se fue el cliente: no hay error que reportar y el socket ya no existe.
        raise
    except Exception as exc:  # noqa: BLE001 - cualquier corte debe ser visible
        yield sse_error_event("upstream_stream_error", redact(str(exc), api_key))
        return
    finally:
        resp.close()

    if not saw_terminal:
        yield sse_error_event(
            "truncated_stream",
            "El stream de Anthropic termino antes de completarse.",
        )


@app.post("/chat/providers/anthropic/messages")
def anthropic_messages(body: MessagesRequest):
    headers = anthropic_headers(body.api_key, body.workspace_id, stream=body.stream)
    payload = upstream_body(body)

    try:
        request = Request(
            f"{ANTHROPIC_API}/v1/messages", data=payload, headers=headers, method="POST"
        )
        resp = urlopen(request, timeout=MESSAGES_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001 - se clasifica en upstream_failure
        return upstream_failure(exc, body.api_key)

    if body.stream:
        return StreamingResponse(
            iter_upstream_stream(resp, body.api_key),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        data = json.loads(resp.read())
    except Exception as exc:  # noqa: BLE001
        return upstream_failure(exc, body.api_key)
    finally:
        resp.close()
    return JSONResponse(data)


def fetch_models_page(headers: dict, after_id: str | None) -> dict:
    query = f"?limit={MODELS_PAGE_LIMIT}"
    if after_id:
        query += f"&after_id={quote(after_id, safe='')}"
    request = Request(
        f"{ANTHROPIC_API}/v1/models{query}", headers=headers, method="GET"
    )
    return read_json_upstream(request, MODELS_TIMEOUT_SECONDS)


@app.post("/chat/providers/anthropic/models")
def anthropic_models(body: ModelsRequest):
    """Devuelve el catalogo entero, recorriendo la paginacion de Anthropic.

    Antes se pedia una sola pagina y se devolvia tal cual: si el catalogo no
    cabia, faltaban modelos en el desplegable sin ningun aviso. Ahora se
    recorren todas, y cualquier lista incompleta viene marcada en `pagination`
    en vez de aparentar estar completa.
    """
    headers = anthropic_headers(body.api_key, body.workspace_id)

    collected: list = []
    seen: set[str] = set()
    after_id: str | None = None
    pages = 0
    truncated = False
    partial_error: dict | None = None

    while pages < MODELS_MAX_PAGES:
        try:
            page = fetch_models_page(headers, after_id)
        except Exception as exc:  # noqa: BLE001 - se clasifica abajo
            if pages == 0:
                # No hay nada que ensenar: el fallo es el resultado.
                return upstream_failure(exc, body.api_key)
            partial_error = failure_summary(exc, body.api_key)
            break

        pages += 1
        items = page.get("data") if isinstance(page, dict) else None
        if not isinstance(items, list):
            if pages == 1:
                return JSONResponse(
                    error_payload(
                        "upstream_invalid_json",
                        "Anthropic devolvio un catalogo de modelos inesperado.",
                    ),
                    status_code=502,
                )
            partial_error = {
                "type": "upstream_invalid_json",
                "message": "Una pagina del catalogo llego con una forma inesperada.",
            }
            break

        nuevos = 0
        for item in items:
            model_id = item.get("id") if isinstance(item, dict) else None
            if not isinstance(model_id, str) or not model_id or model_id in seen:
                continue
            seen.add(model_id)
            collected.append(item)
            nuevos += 1

        if not page.get("has_more"):
            break

        # Tres cortafuegos contra un upstream que dice "hay mas" para siempre:
        # el tope de paginas de arriba, un cursor ausente o repetido, y una
        # pagina que no aporta ningun modelo nuevo.
        next_id = page.get("last_id")
        if not isinstance(next_id, str) or not next_id or next_id == after_id or nuevos == 0:
            truncated = True
            break
        after_id = next_id
    else:
        truncated = True

    incompleto = truncated or partial_error is not None
    return JSONResponse(
        {
            "data": collected,
            "has_more": incompleto,
            "first_id": collected[0].get("id") if collected else None,
            "last_id": collected[-1].get("id") if collected else None,
            "pagination": {
                "pages_fetched": pages,
                "truncated": truncated,
                "partial": partial_error is not None,
                "error": partial_error,
            },
        }
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("ANTHROPIC_PROXY_PORT", "8000"))
    if ANTHROPIC_API != "https://api.anthropic.com":
        print(f"!! Upstream sobreescrito: {ANTHROPIC_API}")
    print(f"CORS proxy running on http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port)
