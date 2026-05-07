from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.kafka.producer import send_event
from app.models.workflow import WorkflowEvent
from app.schemas.upc import AssessmentRequest

router = APIRouter()


@router.post("/assessment")
async def submit_assessment(
    data: AssessmentRequest, db: AsyncSession = Depends(get_db)
):
    enriched_result = await db.execute(
        select(WorkflowEvent.id).where(
            WorkflowEvent.upc == data.upc,
            WorkflowEvent.run_id == data.run_id,
            WorkflowEvent.stage == "ENRICHED",
        )
    )
    if not enriched_result.scalar_one_or_none():
        raise HTTPException(
            status_code=404,
            detail=f"No ENRICHED stage found for UPC {data.upc} and run {data.run_id}.",
        )

    existing_assessment_result = await db.execute(
        select(WorkflowEvent.id).where(
            WorkflowEvent.upc == data.upc,
            WorkflowEvent.run_id == data.run_id,
            WorkflowEvent.stage == "ASSESSMENT",
        )
    )
    if existing_assessment_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Assessment already exists for UPC {data.upc} and run {data.run_id}.",
        )

    event = {
        "event_id": str(uuid.uuid4()),
        "upc": data.upc,
        "run_id": data.run_id,
        "timestamp": datetime.utcnow().isoformat(),
        "assessment": data.assessment.model_dump(),
    }

    await send_event("assessment_events", event)

    db.add(
        WorkflowEvent(
            upc=data.upc,
            run_id=data.run_id,
            stage="ASSESSMENT",
            payload=event,
        )
    )
    await db.commit()

    return {"status": "assessment submitted", "event": event}
