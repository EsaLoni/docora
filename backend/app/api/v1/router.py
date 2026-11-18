"""API v1 Master Router.

Aggregates all version 1 route modules under /api/v1.
"""

from fastapi import APIRouter
from app.api.v1.actions import router as actions_router
from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.config import router as config_router
from app.api.v1.documents import router as documents_router
from app.api.v1.folders import router as folders_router
from app.api.v1.health import router as health_router
from app.api.v1.intelligence import router as intelligence_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.notebooks import router as notebooks_router
from app.api.v1.reminders import router as reminders_router
from app.api.v1.search import router as search_router
from app.api.v1.studio import router as studio_router
from app.api.v1.workspaces import router as workspaces_router

api_v1_router = APIRouter()

# Include feature routers
api_v1_router.include_router(health_router, tags=["Health"])
api_v1_router.include_router(config_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(admin_router)
api_v1_router.include_router(workspaces_router)
api_v1_router.include_router(documents_router)
api_v1_router.include_router(folders_router)
api_v1_router.include_router(search_router)
api_v1_router.include_router(chat_router)
api_v1_router.include_router(intelligence_router)
api_v1_router.include_router(actions_router)
api_v1_router.include_router(reminders_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(notebooks_router)
api_v1_router.include_router(studio_router)
