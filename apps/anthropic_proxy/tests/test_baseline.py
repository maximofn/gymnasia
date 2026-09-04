"""Caracterizacion del comportamiento que ya funciona y no debe romperse.

Estas pruebas se escriben ANTES de endurecer el proxy, para que el endurecimiento
se lea como un diff y no como una reescritura a ciegas.
"""

from conftest import json_response, sse_response

VERIFY = "/chat/providers/anthropic/verify"
MESSAGES = "/chat/providers/anthropic/messages"
MODELS = "/chat/providers/anthropic/models"

KEY = "sk-ant-api03-clave-de-prueba"


def test_health_no_llama_al_upstream(client, fake_upstream):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert fake_upstream.call_count == 0


def test_verify_devuelve_ok_y_modelo(client, fake_upstream):
    fake_upstream.queue(json_response({"model": "claude-sonnet-4-5"}))

    response = client.post(VERIFY, json={"api_key": KEY, "model": "claude-sonnet-4-5"})

    assert response.status_code == 200
    assert response.json() == {"ok": True, "model": "claude-sonnet-4-5"}
    assert fake_upstream.last_request.full_url == "https://api.anthropic.com/v1/messages"


def test_messages_sin_stream_devuelve_el_json_upstream(client, fake_upstream):
    upstream_payload = {
        "id": "msg_1",
        "content": [{"type": "text", "text": "hola"}],
        "stop_reason": "end_turn",
    }
    fake_upstream.queue(json_response(upstream_payload))

    response = client.post(
        MESSAGES,
        json={
            "api_key": KEY,
            "model": "claude-sonnet-4-5",
            "max_tokens": 700,
            "messages": [{"role": "user", "content": "hola"}],
        },
    )

    assert response.status_code == 200
    assert response.json() == upstream_payload


def test_messages_con_stream_devuelve_sse_con_las_cabeceras_del_contrato(client, fake_upstream):
    fake_upstream.queue(
        sse_response(
            [
                'event: message_start\ndata: {"type":"message_start"}\n\n',
                'event: message_stop\ndata: {"type":"message_stop"}\n\n',
            ]
        )
    )

    with client.stream(
        "POST",
        MESSAGES,
        json={
            "api_key": KEY,
            "model": "claude-sonnet-4-5",
            "max_tokens": 700,
            "messages": [{"role": "user", "content": "hola"}],
            "stream": True,
        },
    ) as response:
        body = b"".join(response.iter_bytes()).decode()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"
    assert "message_stop" in body


def test_models_devuelve_el_json_upstream(client, fake_upstream):
    catalogo = {"data": [{"id": "claude-sonnet-4-5", "display_name": "Claude Sonnet 4.5"}]}
    fake_upstream.queue(json_response(catalogo))

    response = client.post(MODELS, json={"api_key": KEY})

    assert response.status_code == 200
    assert response.json()["data"] == catalogo["data"]


# --- Contrato de cabeceras y secretos ---


def test_las_tres_rutas_fijan_la_version_de_la_api(client, fake_upstream):
    """`2023-06-01` es la unica version que Anthropic acepta (ver el log de
    problemas resueltos del CLAUDE.md). Anclada aqui para que nadie la 'actualice'."""
    fake_upstream.queue(
        json_response({"model": "m"}),
        json_response({"content": []}),
        json_response({"data": []}),
    )

    client.post(VERIFY, json={"api_key": KEY})
    client.post(
        MESSAGES,
        json={
            "api_key": KEY,
            "model": "m",
            "max_tokens": 10,
            "messages": [{"role": "user", "content": "hola"}],
        },
    )
    client.post(MODELS, json={"api_key": KEY})

    assert fake_upstream.call_count == 3
    for index in range(3):
        headers = fake_upstream.headers_of(index)
        assert headers["anthropic-version"] == "2023-06-01"
        assert headers["x-api-key"] == KEY


def test_messages_no_reenvia_la_clave_en_el_cuerpo(client, fake_upstream):
    fake_upstream.queue(json_response({"content": []}))

    client.post(
        MESSAGES,
        json={
            "api_key": KEY,
            "model": "claude-sonnet-4-5",
            "max_tokens": 700,
            "messages": [{"role": "user", "content": "hola"}],
        },
    )

    body = fake_upstream.body_of()
    assert "api_key" not in body
    assert KEY not in fake_upstream.last_request.data.decode()


def test_el_workspace_id_viaja_como_cabecera_y_no_en_el_cuerpo(client, fake_upstream):
    fake_upstream.queue(json_response({"content": []}))

    client.post(
        MESSAGES,
        json={
            "api_key": KEY,
            "workspace_id": "wrkspc_123",
            "model": "claude-sonnet-4-5",
            "max_tokens": 700,
            "messages": [{"role": "user", "content": "hola"}],
        },
    )

    assert fake_upstream.headers_of()["anthropic-workspace-id"] == "wrkspc_123"
    assert "workspace_id" not in fake_upstream.body_of()


def test_el_stream_pide_el_accept_de_sse_al_upstream(client, fake_upstream):
    fake_upstream.queue(sse_response(['data: {"type":"message_stop"}\n\n']))

    with client.stream(
        "POST",
        MESSAGES,
        json={
            "api_key": KEY,
            "model": "m",
            "max_tokens": 10,
            "messages": [{"role": "user", "content": "hola"}],
            "stream": True,
        },
    ) as response:
        b"".join(response.iter_bytes())

    assert fake_upstream.headers_of()["accept"] == "text/event-stream"
