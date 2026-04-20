from sqlalchemy import Column, String, JSON, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import engine
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    upc = Column(String, index=True)
    run_id = Column(String, nullable=True, index=True)
    stage = Column(String)
    payload = Column(JSON)
    timestamp = Column(TIMESTAMP, server_default=func.now())
