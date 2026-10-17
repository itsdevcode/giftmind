from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.gift_projects import router as gift_projects_router
from app.api.v1.recipients import router as recipients_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.users import router as users_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(users_router)
router.include_router(recipients_router)
router.include_router(gift_projects_router)
router.include_router(recommendations_router)
