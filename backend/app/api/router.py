from fastapi import APIRouter
from app.api.routes import produce
from app.api.routes import replay
from app.api.routes import workflow

api_router = APIRouter()

api_router.include_router(produce.router)
api_router.include_router(replay.router)
api_router.include_router(workflow.router)