from sqlalchemy import Column, String, Float, TIMESTAMP, JSON
from sqlalchemy.sql import func

from app.models.workflow import Base

class ProductSummary(Base):
    __tablename__ = "products_summary"

    upc = Column(String, primary_key=True)
    final_decision = Column(String)
    estimated_profit = Column(Float)
    summary = Column(String)
    assessment = Column(JSON, nullable=True)
    last_updated = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
