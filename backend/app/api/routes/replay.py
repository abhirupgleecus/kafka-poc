from fastapi import APIRouter, HTTPException
from app.schemas.replay import ReplayRequest, RerunRequest
from app.services.replay_service import fetch_run_history, rerun_from_enriched

router = APIRouter()


@router.post("/replay")
async def replay(data: ReplayRequest):
    try:
        return await fetch_run_history(data.upc, data.run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/rerun")
async def rerun(data: RerunRequest):
    try:
        return await rerun_from_enriched(data.upc, data.run_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
