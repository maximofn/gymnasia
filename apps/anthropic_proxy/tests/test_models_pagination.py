"""Catalogo de modelos: recorrerlo entero, y marcar lo que falte.

El fallo original no era devolver pocos modelos, sino devolver pocos modelos
aparentando que estaban todos. Cualquier lista incompleta tiene que venir
senalada en `pagination`.
"""

from urllib.parse import parse_qs, urlparse

from conftest import dns_failure, json_response, raw_response

MODELS = "/chat/providers/anthropic/models"
KEY = "sk-ant-api03-clave-de-prueba"


def modelo(numero: int) -> dict:
    return {"id": f"claude-{numero}", "display_name": f"Claude {numero}"}


def after_id_de(request) -> str | None:
    query = parse_qs(urlparse(request.full_url).query)
    valores = query.get("after_id")
    return valores[0] if valores else None


def paginador(paginas: list[list[dict]], *, fallo_en: int | None = None):
    """Upstream falso que sirve `paginas` en orden siguiendo `after_id`."""

    def responder(request):
        after = after_id_de(request)
        indice = 0 if after is None else next(
            (i + 1 for i, pagina in enumerate(paginas) if pagina and pagina[-1]["id"] == after),
            len(paginas),
        )
        if fallo_en is not None and indice == fallo_en:
            return dns_failure()
        if indice >= len(paginas):
            return json_response({"data": [], "has_more": False, "last_id": None})
        pagina = paginas[indice]
        return json_response(
            {
                "data": pagina,
                "has_more": indice < len(paginas) - 1,
                "first_id": pagina[0]["id"] if pagina else None,
                "last_id": pagina[-1]["id"] if pagina else None,
            }
        )

    return responder


def pedir(client):
    return client.post(MODELS, json={"api_key": KEY})


def test_una_sola_pagina_se_devuelve_completa(client, fake_upstream):
    fake_upstream.handler(paginador([[modelo(1), modelo(2)]]))

    response = pedir(client)

    assert response.status_code == 200
    payload = response.json()
    assert [m["id"] for m in payload["data"]] == ["claude-1", "claude-2"]
    assert payload["has_more"] is False
    assert payload["pagination"] == {
        "pages_fetched": 1,
        "truncated": False,
        "partial": False,
        "error": None,
    }
    assert fake_upstream.call_count == 1


def test_tres_paginas_se_concatenan(client, fake_upstream):
    fake_upstream.handler(
        paginador([[modelo(1), modelo(2)], [modelo(3), modelo(4)], [modelo(5)]])
    )

    payload = pedir(client).json()

    assert [m["id"] for m in payload["data"]] == [
        "claude-1",
        "claude-2",
        "claude-3",
        "claude-4",
        "claude-5",
    ]
    assert payload["pagination"]["pages_fetched"] == 3
    assert payload["has_more"] is False
    assert fake_upstream.call_count == 3


def test_la_primera_peticion_no_lleva_cursor_y_las_siguientes_si(client, fake_upstream, proxy):
    fake_upstream.handler(paginador([[modelo(1)], [modelo(2)]]))

    pedir(client)

    primera = urlparse(fake_upstream.requests[0].full_url)
    assert parse_qs(primera.query)["limit"] == [str(proxy.MODELS_PAGE_LIMIT)]
    assert "after_id" not in parse_qs(primera.query)
    assert after_id_de(fake_upstream.requests[1]) == "claude-1"


def test_los_modelos_repetidos_entre_paginas_no_se_duplican(client, fake_upstream):
    fake_upstream.handler(paginador([[modelo(1), modelo(2)], [modelo(2), modelo(3)]]))

    payload = pedir(client).json()

    assert [m["id"] for m in payload["data"]] == ["claude-1", "claude-2", "claude-3"]


def test_si_falla_la_primera_pagina_el_error_es_el_resultado(client, fake_upstream):
    fake_upstream.queue(dns_failure())

    response = pedir(client)

    assert response.status_code == 502
    assert response.json()["error"]["type"] == "upstream_unreachable"


def test_si_falla_una_pagina_posterior_se_devuelve_lo_que_hay_marcado(client, fake_upstream):
    """Un desplegable con 2 de 4 modelos y un aviso es mas util que un error
    total. Lo que no puede es parecer completo."""
    fake_upstream.handler(
        paginador([[modelo(1), modelo(2)], [modelo(3)], [modelo(4)]], fallo_en=1)
    )

    response = pedir(client)

    assert response.status_code == 200
    payload = response.json()
    assert [m["id"] for m in payload["data"]] == ["claude-1", "claude-2"]
    assert payload["has_more"] is True
    assert payload["pagination"]["partial"] is True
    assert payload["pagination"]["error"]["type"] == "upstream_unreachable"


def test_un_upstream_que_no_avanza_no_cuelga(client, fake_upstream):
    """Dice 'hay mas' y devuelve siempre el mismo cursor."""

    def atascado(request):
        return json_response(
            {"data": [modelo(1)], "has_more": True, "last_id": "claude-1"}
        )

    fake_upstream.handler(atascado)

    payload = pedir(client).json()

    assert fake_upstream.call_count == 2
    assert payload["pagination"]["truncated"] is True
    assert payload["has_more"] is True
    assert [m["id"] for m in payload["data"]] == ["claude-1"]


def test_un_upstream_sin_cursor_se_corta(client, fake_upstream):
    fake_upstream.handler(
        lambda request: json_response({"data": [modelo(1)], "has_more": True})
    )

    payload = pedir(client).json()

    assert fake_upstream.call_count == 1
    assert payload["pagination"]["truncated"] is True


def test_se_respeta_el_tope_de_paginas(client, fake_upstream, proxy):
    contador = {"n": 0}

    def infinito(request):
        contador["n"] += 1
        identificador = f"claude-{contador['n']}"
        return json_response(
            {
                "data": [{"id": identificador, "display_name": identificador}],
                "has_more": True,
                "last_id": identificador,
            }
        )

    fake_upstream.handler(infinito)

    payload = pedir(client).json()

    assert fake_upstream.call_count == proxy.MODELS_MAX_PAGES
    assert payload["pagination"]["pages_fetched"] == proxy.MODELS_MAX_PAGES
    assert payload["pagination"]["truncated"] is True
    assert payload["has_more"] is True


def test_un_catalogo_con_forma_inesperada_en_la_primera_pagina_da_502(client, fake_upstream):
    fake_upstream.queue(json_response({"data": "no soy una lista"}))

    response = pedir(client)

    assert response.status_code == 502
    assert response.json()["error"]["type"] == "upstream_invalid_json"


def test_un_catalogo_no_interpretable_da_502(client, fake_upstream):
    fake_upstream.queue(raw_response(b"{roto"))

    response = pedir(client)

    assert response.status_code == 502
    assert response.json()["error"]["type"] == "upstream_invalid_json"


def test_las_entradas_sin_id_se_ignoran(client, fake_upstream):
    fake_upstream.handler(
        lambda request: json_response(
            {"data": [modelo(1), {"display_name": "sin id"}, {"id": ""}], "has_more": False}
        )
    )

    payload = pedir(client).json()

    assert [m["id"] for m in payload["data"]] == ["claude-1"]
