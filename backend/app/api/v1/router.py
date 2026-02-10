from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.leaderboards import router as leaderboards_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.users import router as users_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(sessions_router)
api_router.include_router(leaderboards_router)
