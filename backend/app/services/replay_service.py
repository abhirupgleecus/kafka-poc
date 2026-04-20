import os
import random
import uuid
import json
from datetime import datetime, timezone
from typing import Any

from aiokafka import AIOKafkaConsumer
from aiokafka.structs import TopicPartition
from sqlalchemy import desc, select

from app.db.database import AsyncSessionLocal
from app.kafka.producer import send_event
from app.models.workflow import WorkflowEvent


KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")

KAFKA_STAGE_TOPIC_MAP = {
    "RAW": "raw_events",
    "ENRICHED": "enriched_events",
    "TRIAGE": "triage_events",
    "GAINS": "gains_events",
}

RUN_STAGES = ("RAW", "ENRICHED", "TRIAGE", "GAINS", "SUMMARY")
RANDOM_CONDITIONS = ("GOOD", "FAIR", "POOR")


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_timestamp(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, str) and value.strip():
        return value

    return None


async def _fetch_stage_payloads_from_db(upc: str, run_id: str) -> dict[str, dict[str, Any]]:
    stage_data: dict[str, dict[str, Any]] = {}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorkflowEvent.stage, WorkflowEvent.payload, WorkflowEvent.timestamp)
            .where(WorkflowEvent.upc == upc, WorkflowEvent.run_id == run_id)
            .order_by(desc(WorkflowEvent.timestamp))
        )

        rows = result.all()

    for stage, payload, timestamp in rows:
        upper_stage = str(stage).upper()
        if upper_stage in stage_data:
            continue

        stage_data[upper_stage] = {
            "payload": _safe_dict(payload),
            "timestamp": _safe_timestamp(timestamp),
        }

    return stage_data


async def _fetch_stage_payload_from_kafka(
    topic: str, upc: str, run_id: str
) -> dict[str, Any] | None:
    if not KAFKA_BOOTSTRAP_SERVERS:
        return None

    consumer = AIOKafkaConsumer(
        topic,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=None,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
        value_deserializer=lambda x: json.loads(x.decode("utf-8")),
    )

    latest_payload: dict[str, Any] | None = None
    latest_timestamp: str | None = None
    started = False

    try:
        await consumer.start()
        started = True

        partitions = await consumer.partitions_for_topic(topic)
        if not partitions:
            return None

        topic_partitions = [TopicPartition(topic, partition) for partition in partitions]
        consumer.assign(topic_partitions)

        await consumer.seek_to_beginning(*topic_partitions)
        end_offsets = await consumer.end_offsets(topic_partitions)

        while True:
            records = await consumer.getmany(timeout_ms=250, max_records=500)

            if not records:
                break

            for _partition, messages in records.items():
                for message in messages:
                    payload = _safe_dict(message.value)

                    if payload.get("upc") != upc or payload.get("run_id") != run_id:
                        continue

                    latest_payload = payload

                    payload_timestamp = payload.get("timestamp")
                    if isinstance(payload_timestamp, str) and payload_timestamp.strip():
                        latest_timestamp = payload_timestamp
                    elif isinstance(message.timestamp, int):
                        latest_timestamp = datetime.fromtimestamp(
                            message.timestamp / 1000, tz=timezone.utc
                        ).isoformat()

            reached_end = True
            for topic_partition in topic_partitions:
                position = await consumer.position(topic_partition)
                if position < end_offsets[topic_partition]:
                    reached_end = False
                    break

            if reached_end:
                break

    except Exception:
        return None
    finally:
        if started:
            await consumer.stop()

    if not latest_payload:
        return None

    return {"payload": latest_payload, "timestamp": latest_timestamp}


def _stage_status(payload: dict[str, Any] | None) -> str:
    return "COMPLETED" if payload else "PENDING"


def _stage_notes(stage: str, payload: dict[str, Any] | None) -> str:
    if payload:
        notes = payload.get("notes")
        if isinstance(notes, str) and notes.strip():
            return notes
        return f"{stage} stage completed for this run."

    return f"{stage} stage has not completed for this run yet."


async def fetch_run_history(upc: str, run_id: str) -> dict[str, Any]:
    db_stage_payloads = await _fetch_stage_payloads_from_db(upc, run_id)

    stage_payloads: dict[str, dict[str, Any]] = dict(db_stage_payloads)

    for stage, topic in KAFKA_STAGE_TOPIC_MAP.items():
        kafka_value = await _fetch_stage_payload_from_kafka(topic, upc, run_id)
        if kafka_value:
            stage_payloads[stage] = kafka_value

    if not any(stage in stage_payloads for stage in RUN_STAGES):
        raise ValueError(f"No workflow run found for UPC {upc} and run_id {run_id}")

    raw_output = _safe_dict(stage_payloads.get("RAW", {}).get("payload"))
    enriched_output = _safe_dict(stage_payloads.get("ENRICHED", {}).get("payload"))
    triage_output = _safe_dict(stage_payloads.get("TRIAGE", {}).get("payload"))
    gains_output = _safe_dict(stage_payloads.get("GAINS", {}).get("payload"))
    summary_output = _safe_dict(stage_payloads.get("SUMMARY", {}).get("payload"))

    raw_payload = raw_output if raw_output else None
    enriched_payload = enriched_output if enriched_output else None
    triage_payload = triage_output if triage_output else None
    gains_payload = gains_output if gains_output else None
    summary_payload = summary_output if summary_output else None

    stage_rows = [
        {
            "stage": "RAW",
            "status": _stage_status(raw_payload),
            "input": {"upc": upc},
            "output": raw_payload,
            "notes": _stage_notes("RAW", raw_payload),
            "timestamp": stage_payloads.get("RAW", {}).get("timestamp"),
        },
        {
            "stage": "ENRICHED",
            "status": _stage_status(enriched_payload),
            "input": raw_payload,
            "output": enriched_payload,
            "notes": _stage_notes("ENRICHED", enriched_payload),
            "timestamp": stage_payloads.get("ENRICHED", {}).get("timestamp"),
        },
        {
            "stage": "TRIAGE",
            "status": _stage_status(triage_payload),
            "input": enriched_payload,
            "output": triage_payload,
            "notes": _stage_notes("TRIAGE", triage_payload),
            "timestamp": stage_payloads.get("TRIAGE", {}).get("timestamp"),
        },
        {
            "stage": "GAINS",
            "status": _stage_status(gains_payload),
            "input": triage_payload,
            "output": gains_payload,
            "notes": _stage_notes("GAINS", gains_payload),
            "timestamp": stage_payloads.get("GAINS", {}).get("timestamp"),
        },
        {
            "stage": "SUMMARY",
            "status": _stage_status(summary_payload),
            "input": gains_payload if gains_payload else triage_payload,
            "output": summary_payload,
            "notes": _stage_notes("SUMMARY", summary_payload),
            "timestamp": stage_payloads.get("SUMMARY", {}).get("timestamp"),
        },
    ]

    return {"status": "ok", "upc": upc, "run_id": run_id, "stages": stage_rows}


async def rerun_from_enriched(upc: str, run_id: str) -> dict[str, Any]:
    stage_payloads = await _fetch_stage_payloads_from_db(upc, run_id)
    source_enriched = _safe_dict(stage_payloads.get("ENRICHED", {}).get("payload"))

    if not source_enriched:
        raise ValueError(f"No ENRICHED data found for UPC {upc} and run_id {run_id}")

    new_run_id = str(uuid.uuid4())
    new_condition = random.choice(RANDOM_CONDITIONS)

    rerun_payload = dict(source_enriched)
    rerun_payload["upc"] = upc
    rerun_payload["run_id"] = new_run_id
    rerun_payload["condition"] = new_condition

    await send_event("enriched_events", rerun_payload)

    async with AsyncSessionLocal() as db:
        db.add(
            WorkflowEvent(
                upc=upc,
                run_id=new_run_id,
                stage="ENRICHED",
                payload=rerun_payload,
            )
        )
        await db.commit()

    return {
        "status": "rerun_started",
        "upc": upc,
        "source_run_id": run_id,
        "run_id": new_run_id,
        "condition": new_condition,
    }
