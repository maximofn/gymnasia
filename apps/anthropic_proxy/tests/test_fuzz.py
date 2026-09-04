"""Propiedades que deben aguantar con cualquier entrada.

Dos invariantes, no negociables sea cual sea el cuerpo que llegue:
la clave nunca sale, y nunca hay un exito falso — o respuesta valida, o error
explicito, pero nunca un 500 ni una lista que aparente estar completa.
"""

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from conftest import json_response

VERIFY = "/chat/providers/anthropic/verify"
MESSAGES = "/chat/providers/anthropic/messages"
MODELS = "/chat/providers/anthropic/models"

KEY = "sk-ant-api03-clave-de-prueba"

SIN_FIXTURE_POR_EJEMPLO = settings(
    max_examples=150,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)

# Sin NaN ni infinitos: no son JSON valido, asi que ningun cliente real puede
# mandarlos y el unico que se atraganta con ellos es el generador.
json_arbitrario = st.recursive(
    st.none()
    | st.booleans()
    | st.integers()
    | st.floats(allow_nan=False, allow_infinity=False)
    | st.text(),
    lambda hijos: st.lists(hijos, max_size=3) | st.dictionaries(st.text(), hijos, max_size=3),
    max_leaves=6,
)


@SIN_FIXTURE_POR_EJEMPLO
@given(cuerpo=json_arbitrario, ruta=st.sampled_from([VERIFY, MESSAGES, MODELS]))
def test_ningun_cuerpo_provoca_un_500(client, fake_upstream, cuerpo, ruta):
    fake_upstream.handler(lambda request: json_response({"data": [], "content": [], "model": "m"}))

    response = client.post(ruta, json=cuerpo)

    assert response.status_code < 500 or response.status_code in (502, 504)
    assert response.status_code != 500


@SIN_FIXTURE_POR_EJEMPLO
@given(extra=st.dictionaries(st.text(min_size=1).filter(lambda k: k != "api_key"), json_arbitrario, max_size=4))
def test_la_clave_nunca_viaja_en_el_cuerpo_hacia_anthropic(client, fake_upstream, extra):
    fake_upstream.handler(lambda request: json_response({"content": []}))
    cuerpo = {
        "api_key": KEY,
        "model": "claude-sonnet-4-5",
        "max_tokens": 700,
        "messages": [{"role": "user", "content": "hola"}],
        **extra,
    }

    client.post(MESSAGES, json=cuerpo)

    for request in fake_upstream.requests:
        assert request.data is None or KEY not in request.data.decode()


@given(
    secreto=st.text(min_size=8, max_size=60).filter(lambda s: s.strip() == s and s.strip()),
    antes=st.text(max_size=20),
    despues=st.text(max_size=20),
)
@settings(max_examples=200, deadline=None)
def test_redact_borra_cualquier_secreto_lo_bastante_largo(proxy, secreto, antes, despues):
    texto = f"{antes}{secreto}{despues}"

    limpio = proxy.redact(texto, secreto)

    assert secreto not in limpio


@SIN_FIXTURE_POR_EJEMPLO
@given(
    paginas=st.lists(
        st.fixed_dictionaries(
            {
                "data": st.lists(
                    st.fixed_dictionaries({"id": st.text(max_size=8)}), max_size=3
                ),
                "has_more": st.booleans(),
                "last_id": st.one_of(st.text(max_size=8), st.none()),
            }
        ),
        max_size=6,
    )
)
def test_la_paginacion_siempre_termina_y_no_duplica(client, fake_upstream, proxy, paginas):
    """Aunque el upstream mienta sobre `has_more` o repita el cursor."""
    contador = {"n": 0}

    def responder(request):
        indice = contador["n"] % max(len(paginas), 1)
        contador["n"] += 1
        return json_response(paginas[indice] if paginas else {"data": [], "has_more": False})

    fake_upstream.handler(responder)
    # El fixture no se reinicia entre ejemplos de hypothesis, asi que se mide
    # el salto de esta llamada y no el acumulado.
    antes = fake_upstream.call_count

    response = client.post(MODELS, json={"api_key": KEY})

    assert response.status_code == 200
    assert fake_upstream.call_count - antes <= proxy.MODELS_MAX_PAGES
    payload = response.json()
    identificadores = [m["id"] for m in payload["data"]]
    assert len(set(identificadores)) == len(identificadores)
    # Una lista incompleta siempre viene marcada: eso es lo contrario del bug.
    if payload["has_more"]:
        assert payload["pagination"]["truncated"] or payload["pagination"]["partial"]
