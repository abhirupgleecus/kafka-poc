import asyncio
import json
import os
import traceback
import logging
import math
from typing import Any
from datetime import datetime, timezone

from aiokafka import AIOKafkaConsumer
from dotenv import load_dotenv
from sqlalchemy import select, desc

from app.services.summary_service import generate_summary
from app.services.condition_service import ensure_condition_payload
from app.db.database import AsyncSessionLocal, ensure_schema
from app.models.workflow import WorkflowEvent
from app.models.product import ProductSummary
from app.services.email_service import send_email

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")
NOTIFIER_GROUP_ID = os.getenv("NOTIFIER_GROUP_ID", "notifier-group")
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


def _safe_payload(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


async def consume():
    await ensure_schema()

    consumer = AIOKafkaConsumer(
        "gains_events",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=NOTIFIER_GROUP_ID,
        value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset=KAFKA_AUTO_OFFSET_RESET,
    )

    await consumer.start()

    try:
        async for msg in consumer:
            try:
                gains_payload = _safe_payload(msg.value)
                upc = str(gains_payload.get("upc") or "").strip()
                run_id = str(gains_payload.get("run_id") or "").strip()

                if not upc or not run_id:
                    logger.error(f"[NOTIFIER ERROR] Missing run_id for UPC {upc}")
                    continue

                logger.info(f"[NOTIFIER] Processing UPC: {upc} | run_id: {run_id}")

                async with AsyncSessionLocal() as db:
                    existing_summary_result = await db.execute(
                        select(WorkflowEvent)
                        .where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.run_id == run_id,
                            WorkflowEvent.stage == "SUMMARY",
                        )
                        .order_by(desc(WorkflowEvent.timestamp))
                        .limit(1)
                    )
                    existing_summary_event = existing_summary_result.scalar_one_or_none()
                    existing_summary_id = (
                        existing_summary_event.id if existing_summary_event else None
                    )
                    existing_email_result = await db.execute(
                        select(WorkflowEvent)
                        .where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.run_id == run_id,
                            WorkflowEvent.stage == "EMAIL",
                        )
                        .order_by(desc(WorkflowEvent.timestamp))
                        .limit(1)
                    )
                    existing_email_event = existing_email_result.scalar_one_or_none()

                    enriched_result = await db.execute(
                        select(WorkflowEvent.payload)
                        .where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.stage == "ENRICHED",
                            WorkflowEvent.run_id == run_id,
                        )
                        .order_by(desc(WorkflowEvent.timestamp))
                        .limit(1)
                    )
                    product = enriched_result.scalar()

                    assessment_result = await db.execute(
                        select(WorkflowEvent.payload)
                        .where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.stage == "ASSESSMENT",
                            WorkflowEvent.run_id == run_id,
                        )
                        .order_by(desc(WorkflowEvent.timestamp))
                        .limit(1)
                    )
                    assessment_payload = _safe_payload(assessment_result.scalar())

                    triage_result = await db.execute(
                        select(WorkflowEvent.payload)
                        .where(
                            WorkflowEvent.upc == upc,
                            WorkflowEvent.stage == "TRIAGE",
                            WorkflowEvent.run_id == run_id,
                        )
                        .order_by(desc(WorkflowEvent.timestamp))
                        .limit(1)
                    )
                    triage_payload = _safe_payload(triage_result.scalar())

                existing_summary_payload = dict(
                    _safe_payload(existing_summary_event.payload if existing_summary_event else {})
                )
                if existing_email_event:
                    logger.info(
                        f"[NOTIFIER] Skipping duplicate email for UPC: {upc} | run_id: {run_id}"
                    )
                    continue

                if not product:
                    logger.error(
                        f"[NOTIFIER ERROR] No ENRICHED data for UPC {upc} and run_id {run_id}"
                    )
                    continue
                if not assessment_payload:
                    logger.error(
                        f"[NOTIFIER ERROR] No ASSESSMENT data for UPC {upc} and run_id {run_id}"
                    )
                    continue

                decision = str(
                    triage_payload.get(
                        "decision", existing_summary_payload.get("decision", "")
                    )
                ).strip()
                if not decision:
                    logger.error(
                        f"[NOTIFIER ERROR] TRIAGE payload missing 'decision' field for UPC {upc}"
                    )
                    continue

                # 1. Resolve summary content
                summary = existing_summary_payload.get("summary")
                if not isinstance(summary, str) or not summary.strip():
                    product_for_summary = dict(_safe_payload(product))
                    product_for_summary["assessment"] = assessment_payload.get("assessment")
                    summary = await generate_summary(
                        product_for_summary, triage_payload, gains_payload
                    )

                # 2. Store final summary
                async with AsyncSessionLocal() as db:
                    assessment = ensure_condition_payload(assessment_payload)
                    estimated_profit = _to_float(
                        triage_payload.get(
                            "estimated_profit_percentage",
                            gains_payload.get(
                                "estimated_profit_percentage",
                                existing_summary_payload.get("estimated_profit"),
                            ),
                        ),
                        0.0,
                    )
                    market_demand = str(gains_payload.get("market_demand", "UNKNOWN"))
                    resale_potential = str(gains_payload.get("resale_potential", "UNKNOWN"))
                    refurbishment_complexity = str(
                        gains_payload.get("refurbishment_complexity", "UNKNOWN")
                    )
                    expected_roi = _to_float(gains_payload.get("expected_roi"), 0.0)

                    summary_row = ProductSummary(
                        upc=upc,
                        final_decision=decision,
                        estimated_profit=float(estimated_profit),
                        summary=summary,
                        assessment=assessment,
                    )

                    await db.merge(summary_row)

                    summary_event_payload = {
                        "upc": upc,
                        "run_id": run_id,
                        "decision": decision,
                        "estimated_profit": estimated_profit,
                        "market_demand": market_demand,
                        "resale_potential": resale_potential,
                        "refurbishment_complexity": refurbishment_complexity,
                        "expected_roi": expected_roi,
                        "summary": summary,
                    }
                    summary_event = None
                    if existing_summary_id:
                        summary_event_result = await db.execute(
                            select(WorkflowEvent).where(WorkflowEvent.id == existing_summary_id)
                        )
                        summary_event = summary_event_result.scalar_one_or_none()

                    if summary_event:
                        summary_event.payload = summary_event_payload
                        db.add(summary_event)
                    else:
                        db.add(
                            WorkflowEvent(
                            upc=upc,
                            run_id=run_id,
                            stage="SUMMARY",
                            payload=summary_event_payload,
                        )
                        )
                    await db.commit()

                    # Send email asynchronously (non-blocking)
                    try:
                        subject = f"Triage Decision for UPC {upc}"
                        body = f"""
                    UPC: {upc}
                    Run ID: {run_id}

                    Decision: {decision}
                    Estimated Profit: {estimated_profit}%
                    Market Demand: {market_demand}
                    Resale Potential: {resale_potential}
                    Refurbishment Complexity: {refurbishment_complexity}
                    Expected ROI: {expected_roi}%

                    Summary:
                    {summary}
                    """
                        await asyncio.to_thread(send_email, subject, body)

                        email_payload = {
                            "upc": upc,
                            "run_id": run_id,
                            "subject": subject,
                            "summary": summary,
                            "email_sent": True,
                            "email_sent_at": datetime.now(timezone.utc).isoformat(),
                        }
                        existing_email_result = await db.execute(
                            select(WorkflowEvent)
                            .where(
                                WorkflowEvent.upc == upc,
                                WorkflowEvent.run_id == run_id,
                                WorkflowEvent.stage == "EMAIL",
                            )
                            .order_by(desc(WorkflowEvent.timestamp))
                            .limit(1)
                        )
                        email_event = existing_email_result.scalar_one_or_none()
                        if email_event:
                            email_event.payload = email_payload
                            db.add(email_event)
                        else:
                            db.add(
                                WorkflowEvent(
                                    upc=upc,
                                    run_id=run_id,
                                    stage="EMAIL",
                                    payload=email_payload,
                                )
                            )
                        await db.commit()

                        logger.info(f"[EMAIL] Successfully sent for UPC {upc}")
                    except Exception as e:
                        logger.error(f"[EMAIL ERROR] Failed to send email for UPC {upc}: {e}")

                logger.info(f"[NOTIFIER] Done: {upc} | run_id: {run_id}")

            except Exception as e:
                logger.error(f"[NOTIFIER ERROR] Failed to process message: {e}")
                logger.error(f"[NOTIFIER ERROR] Traceback: {traceback.format_exc()}")
                continue

    finally:
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(consume())
