"""Validacion de entrada: el proxy rechaza lo que no entiende, y lo dice bien.

Antes las tres rutas hacian `await req.json()` sin red de seguridad: un cuerpo
que no fuera JSON daba un 500, y una clave ausente se convertia en cadena vacia
y se enviaba igualmente a Anthropic.
"""

import pytest

from conftest import json_response

VERIFY = "/chat/providers/anthropic/verify"
MESSAGES = "/chat/providers/anthropic/messages"
MODELS = "/chat/providers/anthropic/models"
TODAS = (VERIFY, MESSAGES, MODELS)

KEY = "sk-ant-api03-clave-de-prueba"


def mensaje_valido(response) -> str:
    """El cliente lee `error.message` y lo pinta tal cual: tiene que ser texto."""
    payload = response.json()
    message = payload["error"]["message"]
    assert isinstance(message, str) and message.strip()
    return message


def cuerpo_de_mensajes(**overrides):
    body = {
        "api_key": KEY,
        "model": "claude-sonnet-4-5",
        "max_tokens": 700,
        "messages": [{"role": "user", "content": "hola"}],
    }
    body.update(overrides)
    return body


# --- Cuerpo no interpretable ---


@pytest.mark.parametrize("ruta", TODAS)
def test_cuerpo_que_no_es_json_da_422_y_no_llama_al_upstream(client, fake_upstream, ruta):
    response = client.post(
        ruta, content=b"no-json", headers={"content-type": "application/json"}
    )

    assert response.status_code == 422
    assert "JSON" in mensaje_valido(response)
    assert fake_upstream.call_count == 0


@pytest.mark.parametrize("ruta", TODAS)
def test_cuerpo_json_que_no_es_objeto_da_422(client, fake_upstream, ruta):
    response = client.post(ruta, json=[1, 2, 3])

    assert response.status_code == 422
    mensaje_valido(response)
    assert fake_upstream.call_count == 0


# --- Credenciales ---


@pytest.mark.parametrize("ruta", TODAS)
def test_sin_clave_no_se_llama_a_anthropic(client, fake_upstream, ruta):
    response = client.post(ruta, json={"model": "claude-sonnet-4-5"})

    assert response.status_code == 422
    assert fake_upstream.call_count == 0


@pytest.mark.parametrize("clave", ["", "   ", None, 123, 400 * "x" + "y"])
def test_claves_invalidas_se_rechazan(client, fake_upstream, clave):
    response = client.post(MODELS, json={"api_key": clave})

    assert response.status_code == 422
    assert fake_upstream.call_count == 0


def test_la_clave_se_normaliza_quitando_espacios(client, fake_upstream):
    fake_upstream.queue(json_response({"data": []}))

    client.post(MODELS, json={"api_key": f"  {KEY}  "})

    assert fake_upstream.headers_of()["x-api-key"] == KEY


# --- Campos desconocidos: politica distinta por ruta ---


@pytest.mark.parametrize("ruta", [VERIFY, MODELS])
def test_verify_y_models_rechazan_campos_desconocidos(client, fake_upstream, ruta):
    """Su contrato lo definimos nosotros: un campo extra es un error del cliente."""
    response = client.post(ruta, json={"api_key": KEY, "campo_inventado": 1})

    assert response.status_code == 422
    assert fake_upstream.call_count == 0


def test_messages_acepta_campos_desconocidos_y_los_reenvia(client, fake_upstream):
    """/messages es una pasarela transparente: prohibir lo desconocido la
    romperia el dia que Anthropic anada un parametro nuevo."""
    fake_upstream.queue(json_response({"content": []}))

    response = client.post(
        MESSAGES,
        json=cuerpo_de_mensajes(
            system="eres un entrenador",
            thinking={"type": "enabled", "budget_tokens": 1024},
            tools=[{"name": "buscar", "input_schema": {"type": "object"}}],
            parametro_del_futuro="hola",
        ),
    )

    assert response.status_code == 200
    enviado = fake_upstream.body_of()
    assert enviado["parametro_del_futuro"] == "hola"
    assert enviado["thinking"] == {"type": "enabled", "budget_tokens": 1024}
    assert enviado["system"] == "eres un entrenador"


# --- Tipos de los campos que si conocemos ---


@pytest.mark.parametrize(
    "overrides",
    [
        {"model": ""},
        {"max_tokens": 0},
        {"max_tokens": -5},
        {"max_tokens": 10**9},
        {"max_tokens": "muchos"},
        {"messages": []},
        {"messages": "hola"},
        {"messages": [{"role": "system", "content": "hola"}]},
        {"messages": [{"role": "user", "content": 123}]},
        {"messages": [{"content": "sin rol"}]},
        {"stream": "puede"},
    ],
    ids=[
        "modelo-vacio",
        "max_tokens-cero",
        "max_tokens-negativo",
        "max_tokens-desmedido",
        "max_tokens-texto",
        "sin-mensajes",
        "mensajes-no-lista",
        "rol-invalido",
        "contenido-numerico",
        "mensaje-sin-rol",
        "stream-no-booleano",
    ],
)
def test_campos_incompatibles_en_messages(client, fake_upstream, overrides):
    response = client.post(MESSAGES, json=cuerpo_de_mensajes(**overrides))

    assert response.status_code == 422
    mensaje_valido(response)
    assert fake_upstream.call_count == 0


def test_falta_un_campo_obligatorio_de_messages(client, fake_upstream):
    response = client.post(MESSAGES, json={"api_key": KEY})

    assert response.status_code == 422
    assert fake_upstream.call_count == 0


# --- Tamano ---


def test_cuerpo_demasiado_grande_da_413(client, fake_upstream, proxy):
    enorme = b'{"api_key": "' + b"x" * (proxy.MAX_REQUEST_BYTES + 1) + b'"}'

    response = client.post(
        MODELS, content=enorme, headers={"content-type": "application/json"}
    )

    assert response.status_code == 413
    assert response.json()["error"]["type"] == "request_too_large"
    assert fake_upstream.call_count == 0


# --- El error tiene que llegar al navegador ---


def test_el_422_lleva_cabeceras_cors(client):
    """Sin CORS por encima del validador, el navegador no puede leer el error y
    muestra un 'Failed to fetch' generico que no dice nada."""
    response = client.post(
        MODELS, json={}, headers={"origin": "http://localhost:8081"}
    )

    assert response.status_code == 422
    assert response.headers["access-control-allow-origin"] == "*"


def test_el_413_lleva_cabeceras_cors(client, proxy):
    enorme = b"x" * (proxy.MAX_REQUEST_BYTES + 1)

    response = client.post(
        MODELS,
        content=enorme,
        headers={"content-type": "application/json", "origin": "http://localhost:8081"},
    )

    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "*"


def test_el_detalle_del_422_no_filtra_la_clave(client):
    """El detalle estructurado repite el cuerpo rechazado, que puede llevarla."""
    response = client.post(MESSAGES, json={"api_key": KEY, "max_tokens": 0})

    assert response.status_code == 422
    assert KEY not in response.text


def test_preflight_permite_al_cliente_web(client):
    response = client.options(
        MESSAGES,
        headers={
            "origin": "http://localhost:8081",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
