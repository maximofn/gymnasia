"""Fallos de Anthropic: distinguibles, y sin arrastrar secretos.

Antes todo caia en el mismo `502` con `str(e)` en crudo, asi que un timeout y un
DNS caido eran indistinguibles y cualquier secreto presente en el texto de la
excepcion salia por la respuesta.
"""

import pytest

from conftest import dns_failure, http_error, json_response, raw_response, timeout_failure

VERIFY = "/chat/providers/anthropic/verify"
MESSAGES = "/chat/providers/anthropic/messages"
MODELS = "/chat/providers/anthropic/models"

KEY = "sk-ant-api03-clave-de-prueba"


def llamar(client, ruta):
    cuerpos = {
        VERIFY: {"api_key": KEY},
        MODELS: {"api_key": KEY},
        MESSAGES: {
            "api_key": KEY,
            "model": "claude-sonnet-4-5",
            "max_tokens": 700,
            "messages": [{"role": "user", "content": "hola"}],
        },
    }
    return client.post(ruta, json=cuerpos[ruta])


TODAS = (VERIFY, MESSAGES, MODELS)


@pytest.mark.parametrize("ruta", TODAS)
def test_error_http_con_json_se_reenvia_intacto(client, fake_upstream, ruta):
    anthropic_dice = {"type": "error", "error": {"type": "authentication_error", "message": "invalid x-api-key"}}
    fake_upstream.queue(http_error(401, json_dumps(anthropic_dice)))

    response = llamar(client, ruta)

    assert response.status_code == 401
    assert response.json() == anthropic_dice


def json_dumps(payload) -> bytes:
    import json

    return json.dumps(payload).encode()


@pytest.mark.parametrize("ruta", TODAS)
def test_error_http_sin_json_se_envuelve_en_la_forma_que_lee_el_cliente(client, fake_upstream, ruta):
    fake_upstream.queue(
        http_error(502, b"<html>Bad Gateway</html>", content_type="text/html")
    )

    response = llamar(client, ruta)

    assert response.status_code == 502
    assert response.json()["error"]["type"] == "upstream_non_json"
    assert "Bad Gateway" in response.json()["error"]["message"]


def test_un_error_upstream_que_repite_la_clave_no_la_devuelve(client, fake_upstream):
    fake_upstream.queue(
        http_error(429, f"rate limited for key {KEY}".encode(), content_type="text/plain")
    )

    response = llamar(client, MODELS)

    assert response.status_code == 429
    assert KEY not in response.text


@pytest.mark.parametrize("ruta", TODAS)
def test_dns_caido_da_502_sin_detalles_internos(client, fake_upstream, ruta):
    fake_upstream.queue(dns_failure())

    response = llamar(client, ruta)

    assert response.status_code == 502
    assert response.json()["error"]["type"] == "upstream_unreachable"
    assert "gaierror" not in response.text


@pytest.mark.parametrize("ruta", TODAS)
def test_timeout_da_504_y_no_502(client, fake_upstream, ruta):
    """Un timeout no es lo mismo que un servidor inalcanzable: reintentar tiene
    sentido en uno y no en el otro."""
    fake_upstream.queue(timeout_failure())

    response = llamar(client, ruta)

    assert response.status_code == 504
    assert response.json()["error"]["type"] == "upstream_timeout"


def test_timeout_desnudo_tambien_da_504(client, fake_upstream):
    fake_upstream.queue(TimeoutError("timed out"))

    response = llamar(client, MODELS)

    assert response.status_code == 504


@pytest.mark.parametrize("cuerpo", [b"{no es json", b"", b"null-ish"])
@pytest.mark.parametrize("ruta", [VERIFY, MESSAGES, MODELS])
def test_respuesta_200_no_interpretable_da_502(client, fake_upstream, ruta, cuerpo):
    fake_upstream.queue(raw_response(cuerpo))

    response = llamar(client, ruta)

    assert response.status_code == 502
    assert response.json()["error"]["type"] == "upstream_invalid_json"


def test_una_excepcion_con_la_clave_dentro_no_la_filtra(client, fake_upstream):
    fake_upstream.queue(RuntimeError(f"fallo raro con x-api-key: {KEY}"))

    response = llamar(client, MODELS)

    assert response.status_code == 502
    assert KEY not in response.text


def test_un_mensaje_de_error_desmedido_se_trunca(client, fake_upstream, proxy):
    fake_upstream.queue(
        http_error(500, b"a" * 50_000, content_type="text/plain")
    )

    response = llamar(client, MODELS)

    mensaje = response.json()["error"]["message"]
    assert len(mensaje) <= proxy.MAX_ERROR_MESSAGE_CHARS + 1


def test_la_redaccion_pilla_claves_que_no_son_las_de_esta_peticion(proxy):
    """Aunque el secreto no sea el `api_key` del cuerpo actual."""
    texto = "se cayo usando sk-ant-api03-de-otra-persona-XYZ y ya"

    limpio = proxy.redact(texto, "")

    assert "sk-ant-api03-de-otra-persona-XYZ" not in limpio
    assert proxy.REDACTED in limpio


def test_verify_sigue_devolviendo_ok_tras_el_endurecimiento(client, fake_upstream):
    fake_upstream.queue(json_response({"model": "claude-sonnet-4-5"}))

    response = llamar(client, VERIFY)

    assert response.status_code == 200
    assert response.json() == {"ok": True, "model": "claude-sonnet-4-5"}
