from fastapi import APIRouter

from app.api.routes import auth, chat, diet, health, measures, media, training

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(training.router, prefix="/training", tags=["training"])
api_router.include_router(diet.router, prefix="/diet", tags=["diet"])
api_router.include_router(measures.router, prefix="/measures", tags=["measures"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
