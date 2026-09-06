"""El proxy es una herramienta de escritorio y debe negarse a atender de fuera.

GYM-180. La app ya no necesita este proxy: el navegador habla con Anthropic
directamente desde que declara `anthropic-dangerous-direct-browser-access`. Por
eso exponerlo no compensa ningun riesgo, y el limite se comprueba en ejecucion
ademas de en el arranque: da igual como se lance el proceso.
"""

import pytest

VERIFY = "/chat/providers/anthropic/verify"


@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "127.0.0.5", "::1", "0:0:0:0:0:0:0:1"],
)
def test_acepta_a_los_clientes_de_la_propia_maquina(proxy, host):
    assert proxy.is_loopback_client(host) is True


@pytest.mark.parametrize(
    "host",
    ["10.0.0.4", "192.168.1.50", "8.8.8.8", "172.16.3.1", "2001:db8::1"],
)
def test_rechaza_a_los_clientes_de_fuera(proxy, host):
    assert proxy.is_loopback_client(host) is False


def test_lo_que_no_es_una_ip_no_se_rechaza(proxy):
    """Solo se rechaza lo que se puede demostrar remoto.

    El `TestClient` de Starlette se identifica como `testclient`, y un socket
    unix no trae host. Tratarlos como remotos dejaria la suite en rojo sin que
    exista ninguna exposicion real.
    """
    assert proxy.is_loopback_client("testclient") is True
    assert proxy.is_loopback_client(None) is True
    assert proxy.is_loopback_client("") is True


def test_una_peticion_remota_recibe_403_y_no_llega_al_upstream(proxy, fake_upstream):
    """El cerrojo corta antes de tocar Anthropic, con clave valida o sin ella."""
    from fastapi.testclient import TestClient

    with TestClient(proxy.app, client=("203.0.113.7", 54321)) as remoto:
        respuesta = remoto.post(VERIFY, json={"api_key": "sk-ant-api03-clave"})

    assert respuesta.status_code == 403
    cuerpo = respuesta.json()
    assert cuerpo["error"]["type"] == "forbidden"
    assert "127.0.0.1" in cuerpo["error"]["message"]
    assert fake_upstream.requests == []


def test_el_error_no_filtra_la_clave(proxy, fake_upstream):
    from fastapi.testclient import TestClient

    clave = "sk-ant-api03-secreto-que-no-debe-salir"
    with TestClient(proxy.app, client=("198.51.100.9", 40000)) as remoto:
        respuesta = remoto.post(VERIFY, json={"api_key": clave})

    assert respuesta.status_code == 403
    assert clave not in respuesta.text
