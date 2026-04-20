from fastapi import APIRouter, HTTPException
from app.services.workflow_service import get_workflow

router = APIRouter()

@router.get("/workflow/{upc}")
async def workflow(upc: str):
    data = await get_workflow(upc)

    if not data:
        raise HTTPException(status_code=404, detail="UPC not found")

    return data