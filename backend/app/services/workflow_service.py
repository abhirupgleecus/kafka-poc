from sqlalchemy import select, asc

from app.models.workflow import WorkflowEvent
from app.models.product import ProductSummary
from app.db.database import AsyncSessionLocal


def _safe_payload(payload):
    return payload if isinstance(payload, dict) else {}


def _build_fallback_summary(upc: str, enriched_payload: dict, triage_payload: dict) -> str:
    decision = triage_payload.get("decision", "UNKNOWN")
    reason = triage_payload.get("reason", "No reason provided")
    estimated_profit = triage_payload.get("estimated_profit", "N/A")
    product_name = enriched_payload.get("name", "Unknown product")
    condition = enriched_payload.get("condition", "UNKNOWN")

    return (
        f"UPC {upc}: Decision={decision}, Estimated Profit={estimated_profit}. "
        f"Product={product_name}, Condition={condition}. Reason={reason}"
    )


async def _repair_workflow_for_upc(upc: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.upc == upc)
            .order_by(asc(WorkflowEvent.timestamp))
        )
        events = result.scalars().all()

        if not events:
            return

        # 1) Backfill missing run_id values by linear pipeline order.
        latest_run_id = None
        run_id_updated = False

        for event in events:
            payload = _safe_payload(event.payload)
            run_id = event.run_id or payload.get("run_id")

            if event.stage == "RAW" and run_id:
                latest_run_id = run_id
            elif not run_id and latest_run_id:
                run_id = latest_run_id

            if run_id and event.run_id != run_id:
                event.run_id = run_id
                payload["run_id"] = run_id
                event.payload = payload
                run_id_updated = True

        if run_id_updated:
            await db.commit()

        # Refresh in-memory list after any updates.
        result = await db.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.upc == upc)
            .order_by(asc(WorkflowEvent.timestamp))
        )
        events = result.scalars().all()

        # 2) Deduplicate legacy duplicate SUMMARY events for the same run.
        latest_summary_by_run = {}
        duplicate_summary_events = []

        for event in events:
            run_id = event.run_id
            if not run_id or event.stage.upper() != "SUMMARY":
                continue

            previous = latest_summary_by_run.get(run_id)
            if previous is not None:
                duplicate_summary_events.append(previous)

            latest_summary_by_run[run_id] = event

        if duplicate_summary_events:
            for summary_event in duplicate_summary_events:
                await db.delete(summary_event)
            await db.commit()

            result = await db.execute(
                select(WorkflowEvent)
                .where(WorkflowEvent.upc == upc)
                .order_by(asc(WorkflowEvent.timestamp))
            )
            events = result.scalars().all()

        # 3) Ensure products_summary row for each run with TRIAGE.
        by_run = {}
        for event in events:
            run_id = event.run_id
            if not run_id:
                continue

            if run_id not in by_run:
                by_run[run_id] = {"ENRICHED": None, "TRIAGE": None, "SUMMARY": None}

            stage = event.stage.upper()
            if stage in by_run[run_id]:
                by_run[run_id][stage] = event

        changed = False
        for run_id, grouped in by_run.items():
            triage = grouped["TRIAGE"]
            if not triage:
                continue

            enriched = grouped["ENRICHED"]
            summary_event = grouped["SUMMARY"]

            triage_payload = _safe_payload(triage.payload)
            enriched_payload = _safe_payload(enriched.payload if enriched else {})
            summary_payload = _safe_payload(summary_event.payload if summary_event else {})

            decision = triage_payload.get("decision", "UNKNOWN")
            estimated_profit = triage_payload.get("estimated_profit_percentage", 0)
            if not isinstance(estimated_profit, (int, float)):
                estimated_profit = 0.0

            summary_text = summary_payload.get("summary")
            if not isinstance(summary_text, str) or not summary_text.strip():
                summary_text = _build_fallback_summary(upc, enriched_payload, triage_payload)

            # Ensure products_summary row is present.
            summary_row = ProductSummary(
                upc=upc,
                final_decision=str(decision),
                estimated_profit=float(estimated_profit),
                summary=summary_text,
            )
            await db.merge(summary_row)
            changed = True

        if changed:
            await db.commit()


async def get_workflow(upc: str):
    await _repair_workflow_for_upc(upc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorkflowEvent)
            .where(WorkflowEvent.upc == upc)
            .order_by(asc(WorkflowEvent.timestamp))
        )

        events = result.scalars().all()

    if not events:
        return None

    return {
        "upc": upc,
        "events": [
            {
                "stage": event.stage,
                "run_id": event.run_id,
                "timestamp": event.timestamp,
                "payload": event.payload,
            }
            for event in events
        ],
    }
