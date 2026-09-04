"""Fixtures compartidas de la suite del proxy CORS de Anthropic.

Ninguna prueba de esta suite toca la red ni necesita una clave real: el upstream
de Anthropic se sustituye entero por `fake_upstream`.

Por que se carga el modulo con importlib: el fichero se llama `cors-proxy.py`,
con guion, asi que `import cors_proxy` no funciona. Es el mismo patron que ya usa
`.claude/skills/linear-tickets/tests/test_linear.py`.
"""

import email.message
import importlib.util
import io
import json
import socket
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError

import pytest
from fastapi.testclient import TestClient

PROXY_PATH = Path(__file__).resolve().parents[1] / "cors-proxy.py"


def _load_proxy_module():
    spec = importlib.util.spec_from_file_location("cors_proxy", PROXY_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # El proxy se arranca normalmente por el symlink `apps/mobile/cors-proxy.py`,
    # asi que debe seguir siendo un unico fichero sin imports hermanos: aqui se
    # registra en sys.modules solo para que dataclasses/pydantic lo resuelvan.
    sys.modules["cors_proxy"] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="session")
def proxy():
    return _load_proxy_module()


@pytest.fixture
def client(proxy):
    with TestClient(proxy.app) as test_client:
        yield test_client


class FakeResponse:
    """Sustituto de la respuesta de urlopen.

    `chunks` son los trozos que devolvera `read(n)` en orden. `read(-1)` (que es
    lo que hace el proxy en las rutas sin streaming) los concatena todos.
    `raises` permite simular un corte a mitad del stream.
    """

    def __init__(self, chunks, *, status=200, raises=None):
        self._chunks = list(chunks)
        self.status = status
        self._raises = raises
        self.closed = False

    def read(self, size=-1):
        if size is None or size < 0:
            body = b"".join(self._chunks)
            self._chunks = []
            if self._raises is not None:
                raise self._raises
            return body
        if self._chunks:
            return self._chunks.pop(0)
        if self._raises is not None:
            raise self._raises
        return b""

    def close(self):
        self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()
        return False


def json_response(payload, *, status=200):
    """Respuesta upstream con un cuerpo JSON."""
    return FakeResponse([json.dumps(payload).encode()], status=status)


def raw_response(body: bytes, *, status=200):
    """Respuesta upstream con un cuerpo arbitrario (para probar JSON malformado)."""
    return FakeResponse([body], status=status)


def sse_response(chunks, *, raises=None):
    """Respuesta upstream de tipo SSE, troceada tal cual la leera el proxy."""
    return FakeResponse(
        [c.encode() if isinstance(c, str) else c for c in chunks],
        raises=raises,
    )


def http_error(status: int, body: bytes, *, content_type="application/json"):
    """HTTPError con un `fp` legible: el proxy hace `e.read()` sobre el."""
    headers = email.message.Message()
    headers["content-type"] = content_type
    return HTTPError(
        "https://api.anthropic.com/v1/messages",
        status,
        "error",
        headers,
        io.BytesIO(body),
    )


def dns_failure():
    return URLError(socket.gaierror(8, "nodename nor servname provided"))


def timeout_failure():
    return URLError(socket.timeout("timed out"))


class UpstreamRecorder:
    """Registra cada peticion que el proxy manda a Anthropic y responde por cola.

    Se puede programar con `queue(...)` (respuestas o excepciones en orden) o con
    `handler(...)` para casos que dependen de la peticion, como la paginacion.
    """

    def __init__(self):
        self.requests = []
        self.timeouts = []
        self._queue = []
        self._handler = None

    def queue(self, *responses):
        self._queue.extend(responses)
        return self

    def handler(self, fn):
        self._handler = fn
        return self

    # --- lo que ve el proxy ---
    def __call__(self, request, timeout=None):
        self.requests.append(request)
        self.timeouts.append(timeout)
        if self._handler is not None:
            result = self._handler(request)
        elif self._queue:
            result = self._queue.pop(0)
        else:
            raise AssertionError(
                f"El proxy llamo al upstream mas veces de las programadas: {request.full_url}"
            )
        if isinstance(result, BaseException):
            raise result
        return result

    # --- ayudas de asercion ---
    @property
    def last_request(self):
        assert self.requests, "El proxy no llamo al upstream"
        return self.requests[-1]

    @property
    def call_count(self):
        return len(self.requests)

    def body_of(self, index=-1):
        data = self.requests[index].data
        return json.loads(data.decode()) if data else None

    def headers_of(self, index=-1):
        # urllib normaliza las cabeceras a Capitalizado; comparamos en minusculas.
        return {k.lower(): v for k, v in self.requests[index].headers.items()}


@pytest.fixture
def fake_upstream(proxy, monkeypatch):
    recorder = UpstreamRecorder()
    monkeypatch.setattr(proxy, "urlopen", recorder)
    return recorder
