from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from datetime import datetime

from app.db.database import get_db
from app.models.workflow import WorkflowEvent
from app.kafka.producer import send_event
from app.schemas.upc import UPCRequest

router = APIRouter()


@router.post("/produce")
async def produce_event(data: UPCRequest, db: AsyncSession = Depends(get_db)):
    run_id = str(uuid.uuid4())

    event = {
        "event_id": str(uuid.uuid4()),
        "upc": data.upc,
        "run_id": run_id,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Kafka
    await send_event("raw_events", event)

    # DB
    db_event = WorkflowEvent(
        upc=data.upc,
        run_id=run_id,
        stage="RAW",
        payload=event,
    )

    db.add(db_event)
    await db.commit()

    return {"status": "event produced", "event": event}
