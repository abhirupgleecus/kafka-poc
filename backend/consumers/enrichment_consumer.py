import asyncio
import json
import random
import os
import traceback
import logging

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from dotenv import load_dotenv
from sqlalchemy import select

from app.services.enrichment_service import generate_product_data
from app.db.database import AsyncSessionLocal, ensure_schema
from app.models.workflow import WorkflowEvent

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
ENRICHMENT_GROUP_ID = os.getenv("ENRICHMENT_GROUP_ID", "enrichment-group")
KAFKA_AUTO_OFFSET_RESET = os.getenv("KAFKA_AUTO_OFFSET_RESET", "earliest")


async def consume():
    await ensure_schema()

    consumer = AIOKafkaConsumer(
        "raw_events",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=ENRICHMENT_GROUP_ID,
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
                event = msg.value
                upc = event["upc"]
                run_id = event.get("run_id")

                if not run_id:
                    logger.error(f"[ENRICHMENT ERROR] Missing run_id for UPC {upc}")
                    continue

                logger.info(f"[ENRICHMENT] Processing UPC: {upc} | run_id: {run_id}")

                async with AsyncSessionLocal() as db:
                    existing_result = await db.execute(
                        select(WorkflowEvent.id).where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.run_id == run_id,
                            WorkflowEvent.stage == "ENRICHED",
                        )
                    )
                    if existing_result.scalar_one_or_none():
                        logger.info(
                            f"[ENRICHMENT] Skipping duplicate ENRICHED event for UPC: {upc} | run_id: {run_id}"
                        )
                        continue

                # 1. Call LLM
                product = await generate_product_data(upc)

                # 2. Add condition and workflow identifiers
                product["condition"] = random.choice(["GOOD", "FAIR", "POOR"])
                product["upc"] = upc
                product["run_id"] = run_id

                # 3. Produce to next topic
                await producer.send_and_wait(
                    "enriched_events", json.dumps(product).encode("utf-8")
                )

                # 4. Store in DB
                async with AsyncSessionLocal() as db:
                    db_event = WorkflowEvent(
                        upc=upc,
                        run_id=run_id,
                        stage="ENRICHED",
                        payload=product,
                    )
                    db.add(db_event)
                    await db.commit()

                logger.info(f"[ENRICHMENT] Done: {upc} | run_id: {run_id}")

            except Exception as e:
                logger.error(f"[ENRICHMENT ERROR] Failed to process message: {e}")
                logger.error(f"[ENRICHMENT ERROR] Traceback: {traceback.format_exc()}")
                continue

    finally:
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(consume())
