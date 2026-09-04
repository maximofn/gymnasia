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
            # Se conserva el detalle estructurado para depurar, pero redactado:
            # el cuerpo rechazado puede contener la clave del usuario.
            "detail": json.loads(redact(json.dumps(errors, default=str))),
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


def upstream_failure(exc: Exception, api_key: str) -> JSONResponse:
    """Traduce un fallo de la llamada a Anthropic a una respuesta distinguible.

    Antes todo caia en un 502 con `str(e)` en crudo, que ademas podia arrastrar
    secretos. Ahora el cliente puede diferenciar un timeout de un DNS caido.
    """
    if isinstance(exc, HTTPError):
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return JSONResponse(json.loads(raw), status_code=exc.code)
        except (ValueError, TypeError):
            return JSONResponse(
                error_payload("upstream_non_json", redact(raw, api_key)),
                status_code=exc.code,
            )

    reason = getattr(exc, "reason", None)
    if isinstance(exc, (socket.timeout, TimeoutError)) or isinstance(
        reason, (socket.timeout, TimeoutError)
    ):
        return JSONResponse(
            error_payload("upstream_timeout", "Anthropic no respondio a tiempo."),
            status_code=504,
        )
    if isinstance(exc, URLError):
        return JSONResponse(
            error_payload(
                "upstream_unreachable", "No se pudo contactar con la API de Anthropic."
            ),
            status_code=502,
        )
    if isinstance(exc, (ValueError, json.JSONDecodeError)):
        return JSONResponse(
            error_payload(
                "upstream_invalid_json",
                "Anthropic devolvio una respuesta que no se pudo interpretar.",
            ),
            status_code=502,
        )
    return JSONResponse(
        error_payload("upstream_error", redact(str(exc), api_key)), status_code=502
    )


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


@app.post("/chat/providers/anthropic/models")
def anthropic_models(body: ModelsRequest):
    headers = anthropic_headers(body.api_key, body.workspace_id)

    try:
        request = Request(f"{ANTHROPIC_API}/v1/models", headers=headers, method="GET")
        data = read_json_upstream(request, MODELS_TIMEOUT_SECONDS)
        return JSONResponse(data)
    except Exception as exc:  # noqa: BLE001 - se clasifica en upstream_failure
        return upstream_failure(exc, body.api_key)


if __name__ == "__main__":
    import uvicorn

    if ANTHROPIC_API != "https://api.anthropic.com":
        print(f"!! Upstream sobreescrito: {ANTHROPIC_API}")
    print("CORS proxy running on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
