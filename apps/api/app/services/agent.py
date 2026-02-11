from dataclasses import dataclass

from app.core.config import get_settings


@dataclass
class AgentResponse:
    provider: str
    model: str
    text: str


class SectionAgentService:
    """
    Punto de integración con LangGraph.
    Deja un contrato estable para conectar tu grafo sin tocar rutas.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    async def respond(self, *, section: str, user_message: str, provider: str | None, model: str | None) -> AgentResponse:
        selected_provider = provider or self.settings.default_llm_provider
        selected_model = model or self.settings.default_llm_model

        # Placeholder consciente: backend listo para acoplar grafo LangGraph real.
        text = (
            f"[{section}] Respuesta provisional del agente ({selected_provider}/{selected_model}). "
            "Integra aqui tu flujo de LangGraph con memoria y herramientas. "
            f"Mensaje recibido: {user_message}"
        )
        return AgentResponse(provider=selected_provider, model=selected_model, text=text)
