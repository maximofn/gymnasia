"""Streams SSE: un corte tiene que verse, no colarse como respuesta buena.

Cuando el stream se corta ya se enviaron las cabeceras 200, asi que el codigo de
estado no puede cambiar. La unica forma de que el usuario se entere es inyectar
un evento de error dentro del propio stream: `createAnthropicStreamParser`
(apps/mobile/agent/providerStreamParsers.ts) lanza excepcion ante un evento cuyo
`type` sea `error`.
"""

import json

from conftest import sse_response

MESSAGES = "/chat/providers/anthropic/messages"
KEY = "sk-ant-api03-clave-de-prueba"

COMPLETO = [
    'event: message_start\ndata: {"type":"message_start"}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"hola"}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
]


def pedir_stream(client) -> str:
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
        assert response.status_code == 200
        return b"".join(response.iter_bytes()).decode()


def eventos_de_error(body: str) -> list[dict]:
    encontrados = []
    for bloque in body.split("\n\n"):
        for linea in bloque.splitlines():
            if not linea.startswith("data: "):
                continue
            try:
                payload = json.loads(linea[len("data: ") :])
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict) and payload.get("type") == "error":
                encontrados.append(payload)
    return encontrados


def test_un_stream_completo_no_lleva_evento_de_error(client, fake_upstream):
    fake_upstream.queue(sse_response(COMPLETO))

    body = pedir_stream(client)

    assert "message_stop" in body
    assert eventos_de_error(body) == []


def test_un_cierre_limpio_prematuro_se_marca_como_truncado(client, fake_upstream):
    """El upstream deja de mandar sin llegar a `message_stop`. Antes esto
    terminaba el generador sin ruido y el cliente lo daba por bueno."""
    fake_upstream.queue(sse_response(COMPLETO[:2]))

    body = pedir_stream(client)

    errores = eventos_de_error(body)
    assert len(errores) == 1
    assert errores[0]["error"]["type"] == "truncated_stream"
    assert "event: error" in body


def test_una_excepcion_a_media_lectura_se_marca_como_error(client, fake_upstream):
    fake_upstream.queue(
        sse_response(COMPLETO[:1], raises=ConnectionResetError("connection reset by peer"))
    )

    body = pedir_stream(client)

    errores = eventos_de_error(body)
    assert len(errores) == 1
    assert errores[0]["error"]["type"] == "upstream_stream_error"


def test_el_error_del_stream_no_filtra_la_clave(client, fake_upstream):
    fake_upstream.queue(
        sse_response(COMPLETO[:1], raises=RuntimeError(f"fallo con x-api-key: {KEY}"))
    )

    body = pedir_stream(client)

    assert KEY not in body
    assert eventos_de_error(body)[0]["error"]["type"] == "upstream_stream_error"


def test_el_marcador_partido_entre_dos_trozos_no_es_un_falso_truncado(client, fake_upstream):
    """El proxy lee de 1024 en 1024 bytes, asi que `message_stop` puede caer
    justo en la frontera. Sin el solapamiento, el proxy inventaria un error en
    un stream que termino perfectamente."""
    fake_upstream.queue(
        sse_response(
            [
                'event: message_start\ndata: {"type":"message_start"}\n\n',
                "event: message_st",
                'op\ndata: {"type":"fin"}\n\n',
            ]
        )
    )

    body = pedir_stream(client)

    assert eventos_de_error(body) == []
    assert "message_stop" in body


def test_el_evento_de_error_tiene_la_forma_que_lanza_el_parser_del_cliente(client, fake_upstream):
    """`errorMessage` lee `error.message`, y `processEvent` lanza si
    `payload.type === "error"` o si el nombre del evento es `error`."""
    fake_upstream.queue(sse_response(COMPLETO[:1]))

    body = pedir_stream(client)

    assert "event: error" in body
    payload = eventos_de_error(body)[0]
    assert payload["type"] == "error"
    assert isinstance(payload["error"]["message"], str)
    assert payload["error"]["message"].strip()


def test_el_stream_cierra_la_respuesta_upstream(client, fake_upstream, proxy):
    respuesta = sse_response(COMPLETO)
    fake_upstream.queue(respuesta)

    pedir_stream(client)

    assert respuesta.closed
