from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers.account import router as account_router
from app.routers.ai_keys import router as ai_keys_router
from app.routers.auth import router as auth_router
from app.routers.chat import router as chat_router
from app.routers.diet import router as diet_router
from app.routers.goals import router as goals_router
from app.routers.media import router as media_router
from app.routers.measurements import router as measurements_router
from app.routers.sync import router as sync_router
from app.routers.workouts import router as workouts_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": settings.app_name}


app.include_router(auth_router)
app.include_router(ai_keys_router)
app.include_router(goals_router)
app.include_router(workouts_router)
app.include_router(diet_router)
app.include_router(measurements_router)
app.include_router(chat_router)
app.include_router(media_router)
app.include_router(sync_router)
app.include_router(account_router)
