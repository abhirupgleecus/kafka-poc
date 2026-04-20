import asyncio
import json
import os
import traceback
import logging
import math
from typing import Any

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from dotenv import load_dotenv
from sqlalchemy import desc, select

from app.services.gains_service import generate_gains
from app.db.database import AsyncSessionLocal, ensure_schema
from app.models.workflow import WorkflowEvent

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
GAINS_GROUP_ID = os.getenv("GAINS_GROUP_ID", "gains-group")
KAFKA_AUTO_OFFSET_RESET = os.getenv("KAFKA_AUTO_OFFSET_RESET", "earliest")


def _to_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        number = float(value)
        return number if math.isfinite(number) else default

    if isinstance(value, str):
        normalized = (
            value.strip()
            .replace("%", "")
            .replace("$", "")
            .replace(",", "")
        )
        if not normalized:
            return default
        try:
            number = float(normalized)
            return number if math.isfinite(number) else default
        except ValueError:
            return default

    return default


async def consume():
    await ensure_schema()

    consumer = AIOKafkaConsumer(
        "triage_events",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=GAINS_GROUP_ID,
        value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
    )

    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)

    await consumer.start()
    await producer.start()

    try:
        async for msg in consumer:
            try:
                triage_decision = msg.value
                upc = triage_decision["upc"]
                run_id = triage_decision.get("run_id")

                if not run_id:
                    logger.error(f"[GAINS ERROR] Missing run_id for UPC {upc}")
                    continue

                logger.info(f"[GAINS] Processing UPC: {upc} | run_id: {run_id}")

                async with AsyncSessionLocal() as db:
                    existing_result = await db.execute(
                        select(WorkflowEvent.id).where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.run_id == run_id,
                            WorkflowEvent.stage == "GAINS",
                        )
                    )
                    if existing_result.scalar_one_or_none():
                        logger.info(
                            f"[GAINS] Skipping duplicate GAINS event for UPC: {upc} | run_id: {run_id}"
                        )
                        continue

                # Fetch ENRICHED product data for this run
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(WorkflowEvent.payload)
                        .where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.stage == "ENRICHED",
                            WorkflowEvent.run_id == run_id,
                        )
                        .order_by(desc(WorkflowEvent.timestamp))
                        .limit(1)
                    )
                    product = result.scalar()

                if not product:
                    logger.error(
                        f"[GAINS ERROR] No ENRICHED data for UPC {upc} and run_id {run_id}"
                    )
                    continue

                # Validate triage decision structure
                if "decision" not in triage_decision:
                    logger.error(
                        f"[GAINS ERROR] TRIAGE decision missing 'decision' for UPC {upc}"
                    )
                    continue
                triage_decision["estimated_profit_percentage"] = _to_float(
                    triage_decision.get("estimated_profit_percentage"),
                    0.0,
                )

                # 1. Generate gains analysis
                gains = await generate_gains(product, triage_decision)

                gains["upc"] = upc
                gains["run_id"] = run_id

                # 2. Produce to gains events topic
                await producer.send_and_wait(
                    "gains_events", json.dumps(gains).encode("utf-8")
                )

                # 3. Store in DB
                async with AsyncSessionLocal() as db:
                    db_event = WorkflowEvent(
                        upc=upc,
                        run_id=run_id,
                        stage="GAINS",
                        payload=gains,
                    )
                    db.add(db_event)
                    await db.commit()

                logger.info(f"[GAINS] Done: {upc} | run_id: {run_id}")

            except Exception as e:
                logger.error(f"[GAINS ERROR] Failed to process message: {e}")
                logger.error(f"[GAINS ERROR] Traceback: {traceback.format_exc()}")
                continue

    finally:
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(consume())
