"""E2E sobre HTTP real: proxy en un proceso aparte y un Anthropic falso.

Las demas pruebas sustituyen `urlopen` dentro del proceso. Aqui no se sustituye
nada: se levanta el proxy como lo levanta el runbook, se le apunta a un servidor
que hace de Anthropic, y se habla con el por HTTP. Es lo que atrapa los fallos
que solo aparecen al atravesar la pila entera — el troceado real del stream, las
cabeceras que pone el servidor, la paginacion con varias peticiones de verdad.

Sigue sin usar red ni clave: el Anthropic falso escucha en loopback.
"""

import json
import os
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

PROXY_PATH = Path(__file__).resolve().parents[1] / "cors-proxy.py"
KEY = "sk-ant-api03-clave-de-prueba"

MODELOS = [f"claude-{n}" for n in range(1, 8)]
TAMANO_PAGINA_FALSO = 3

SSE_COMPLETO = (
    'event: message_start\ndata: {"type":"message_start"}\n\n'
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,'
    '"delta":{"type":"text_delta","text":"hola"}}\n\n'
    'event: message_stop\ndata: {"type":"message_stop"}\n\n'
)
# Se corta despues del primer delta: nunca llega `message_stop`.
SSE_CORTADO = (
    'event: message_start\ndata: {"type":"message_start"}\n\n'
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,'
    '"delta":{"type":"text_delta","text":"a med"}}\n\n'
)


def puerto_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class AnthropicFalso(BaseHTTPRequestHandler):
    """Suficiente Anthropic para el recorrido completo, nada mas."""

    def log_message(self, *args):  # silencio en la salida de pytest
        pass

    def _responder(self, status, cuerpo: bytes, content_type="application/json"):
        self.send_response(status)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        partes = urlparse(self.path)
        if not partes.path.endswith("/v1/models"):
            self._responder(404, b'{"error":{"message":"no"}}')
            return
        consulta = parse_qs(partes.query)
        after = consulta.get("after_id", [None])[0]
        inicio = MODELOS.index(after) + 1 if after in MODELOS else 0
        pagina = MODELOS[inicio : inicio + TAMANO_PAGINA_FALSO]
        self._responder(
            200,
            json.dumps(
                {
                    "data": [{"id": m, "display_name": m.title()} for m in pagina],
                    "has_more": inicio + TAMANO_PAGINA_FALSO < len(MODELOS),
                    "first_id": pagina[0] if pagina else None,
                    "last_id": pagina[-1] if pagina else None,
                }
            ).encode(),
        )

    def do_POST(self):
        largo = int(self.headers.get("content-length", 0))
        cuerpo = json.loads(self.rfile.read(largo) or b"{}")

        # El proxy tiene que haber convertido la credencial en cabecera.
        assert self.headers.get("x-api-key") == KEY
        assert self.headers.get("anthropic-version") == "2023-06-01"
        assert "api_key" not in cuerpo

        if not cuerpo.get("stream"):
            self._responder(
                200,
                json.dumps(
                    {"id": "msg_1", "model": cuerpo.get("model", "m"),
                     "content": [{"type": "text", "text": "hola"}]}
                ).encode(),
            )
            return

        texto = SSE_CORTADO if cuerpo.get("model") == "corta-el-stream" else SSE_COMPLETO
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.end_headers()
        self.wfile.write(texto.encode())
        self.wfile.flush()


@pytest.fixture(scope="module")
def entorno():
    upstream = ThreadingHTTPServer(("127.0.0.1", 0), AnthropicFalso)
    hilo = threading.Thread(target=upstream.serve_forever, daemon=True)
    hilo.start()
    puerto_upstream = upstream.server_address[1]

    puerto_proxy = puerto_libre()
    entorno_proceso = {
        **os.environ,
        "ANTHROPIC_PROXY_UPSTREAM_BASE_URL": f"http://127.0.0.1:{puerto_upstream}",
        "ANTHROPIC_PROXY_PORT": str(puerto_proxy),
    }
    proceso = subprocess.Popen(
        [sys.executable, str(PROXY_PATH)],
        env=entorno_proceso,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    base = f"http://127.0.0.1:{puerto_proxy}"
    for _ in range(100):
        if proceso.poll() is not None:
            salida = proceso.stdout.read().decode(errors="replace")
            raise AssertionError(f"El proxy murio al arrancar:\n{salida}")
        try:
            if httpx.get(f"{base}/health", timeout=0.5).status_code == 200:
                break
        except httpx.HTTPError:
            time.sleep(0.1)
    else:
        proceso.kill()
        raise AssertionError("El proxy no llego a responder en /health")

    yield base

    proceso.terminate()
    proceso.wait(timeout=10)
    upstream.shutdown()


def test_health_responde_por_http_real(entorno):
    respuesta = httpx.get(f"{entorno}/health", timeout=5)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"ok": True}


def test_verify_de_extremo_a_extremo(entorno):
    respuesta = httpx.post(
        f"{entorno}/chat/providers/anthropic/verify",
        json={"api_key": KEY, "model": "claude-sonnet-4-5"},
        timeout=10,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["ok"] is True


def test_models_recorre_las_tres_paginas_de_verdad(entorno):
    respuesta = httpx.post(
        f"{entorno}/chat/providers/anthropic/models",
        json={"api_key": KEY},
        timeout=10,
    )

    assert respuesta.status_code == 200
    payload = respuesta.json()
    assert [m["id"] for m in payload["data"]] == MODELOS
    assert payload["pagination"]["pages_fetched"] == 3
    assert payload["has_more"] is False


def test_mensaje_sin_streaming_de_extremo_a_extremo(entorno):
    respuesta = httpx.post(
        f"{entorno}/chat/providers/anthropic/messages",
        json={
            "api_key": KEY,
            "model": "claude-sonnet-4-5",
            "max_tokens": 700,
            "messages": [{"role": "user", "content": "hola"}],
        },
        timeout=10,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["content"][0]["text"] == "hola"


def leer_stream(entorno, modelo: str) -> str:
    trozos = []
    with httpx.stream(
        "POST",
        f"{entorno}/chat/providers/anthropic/messages",
        json={
            "api_key": KEY,
            "model": modelo,
            "max_tokens": 700,
            "messages": [{"role": "user", "content": "hola"}],
            "stream": True,
        },
        timeout=20,
    ) as respuesta:
        assert respuesta.status_code == 200
        assert respuesta.headers["content-type"].startswith("text/event-stream")
        for trozo in respuesta.iter_bytes():
            trozos.append(trozo)
    return b"".join(trozos).decode()


def test_stream_completo_llega_entero_y_sin_error(entorno):
    cuerpo = leer_stream(entorno, "claude-sonnet-4-5")

    assert "message_stop" in cuerpo
    assert "event: error" not in cuerpo


def test_stream_cortado_llega_con_el_error_dentro(entorno):
    """La prueba que justifica todo el mecanismo: el estado HTTP ya era 200
    cuando el upstream se corto, asi que el aviso solo cabe dentro del stream."""
    cuerpo = leer_stream(entorno, "corta-el-stream")

    assert "message_stop" not in cuerpo
    assert "event: error" in cuerpo
    assert "truncated_stream" in cuerpo


def test_un_cuerpo_invalido_da_422_legible_por_http_real(entorno):
    respuesta = httpx.post(
        f"{entorno}/chat/providers/anthropic/models",
        content=b"no-json",
        headers={"content-type": "application/json"},
        timeout=10,
    )

    assert respuesta.status_code == 422
    assert isinstance(respuesta.json()["error"]["message"], str)


def test_el_preflight_del_navegador_pasa_por_http_real(entorno):
    respuesta = httpx.request(
        "OPTIONS",
        f"{entorno}/chat/providers/anthropic/messages",
        headers={
            "origin": "http://localhost:8081",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
        timeout=10,
    )

    assert respuesta.status_code == 200
    assert respuesta.headers["access-control-allow-origin"] == "*"
