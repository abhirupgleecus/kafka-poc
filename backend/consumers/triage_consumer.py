import asyncio
import json
import os
import traceback
import logging

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from dotenv import load_dotenv
from sqlalchemy import select

from app.services.triage_service import generate_triage_decision
from app.db.database import AsyncSessionLocal, ensure_schema
from app.models.workflow import WorkflowEvent

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
TRIAGE_GROUP_ID = os.getenv("TRIAGE_GROUP_ID", "triage-group")
KAFKA_AUTO_OFFSET_RESET = os.getenv("KAFKA_AUTO_OFFSET_RESET", "earliest")


async def consume():
    await ensure_schema()

    consumer = AIOKafkaConsumer(
        "enriched_events",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=TRIAGE_GROUP_ID,
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
                product = msg.value
                upc = product["upc"]
                run_id = product.get("run_id")

                if not run_id:
                    logger.error(f"[TRIAGE ERROR] Missing run_id for UPC {upc}")
                    continue

                logger.info(f"[TRIAGE] Processing UPC: {upc} | run_id: {run_id}")

                async with AsyncSessionLocal() as db:
                    existing_result = await db.execute(
                        select(WorkflowEvent.id).where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.run_id == run_id,
                            WorkflowEvent.stage == "TRIAGE",
                        )
                    )
                    if existing_result.scalar_one_or_none():
                        logger.info(
                            f"[TRIAGE] Skipping duplicate TRIAGE event for UPC: {upc} | run_id: {run_id}"
                        )
                        continue

                # 1. Call LLM
                decision = await generate_triage_decision(product)

                decision["upc"] = upc
                decision["run_id"] = run_id

                # 2. Produce next event
                await producer.send_and_wait(
                    "triage_events", json.dumps(decision).encode("utf-8")
                )

                # 3. Store in DB
                async with AsyncSessionLocal() as db:
                    db_event = WorkflowEvent(
                        upc=upc,
                        run_id=run_id,
                        stage="TRIAGE",
                        payload=decision,
                    )
                    db.add(db_event)
                    await db.commit()

                logger.info(f"[TRIAGE] Done: {upc} | run_id: {run_id}")

            except Exception as e:
                logger.error(f"[TRIAGE ERROR] Failed to process message: {e}")
                logger.error(f"[TRIAGE ERROR] Traceback: {traceback.format_exc()}")
                continue

    finally:
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(consume())
