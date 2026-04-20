import asyncio
import logging
import os
from collections.abc import Awaitable, Callable

from fastapi import FastAPI

from app.db.database import ensure_schema
from app.api.router import api_router
from app.kafka.producer import close_producer
from consumers.enrichment_consumer import consume as consume_enrichment
from consumers.triage_consumer import consume as consume_triage
from consumers.gains_consumer import consume as consume_gains
from consumers.notifier_consumer import consume as consume_notifier


app = FastAPI()
app.include_router(api_router)
logger = logging.getLogger(__name__)

CONSUMER_TASK_FACTORIES: list[tuple[str, Callable[[], Awaitable[None]]]] = [
    ("enrichment", consume_enrichment),
    ("triage", consume_triage),
    ("gains", consume_gains),
    ("notifier", consume_notifier),
]


def _as_bool(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


async def _run_consumer_forever(name: str, consume_fn: Callable[[], Awaitable[None]]) -> None:
    while True:
        try:
            await consume_fn()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[WORKER] %s consumer crashed; restarting in 2s", name)
            await asyncio.sleep(2)
        else:
            logger.warning("[WORKER] %s consumer exited unexpectedly; restarting in 2s", name)
            await asyncio.sleep(2)


@app.on_event("startup")
async def startup():
    await ensure_schema()

    if not _as_bool(os.getenv("RUN_CONSUMERS_IN_API"), default=True):
        app.state.consumer_tasks = []
        logger.info("[WORKER] RUN_CONSUMERS_IN_API is disabled.")
        return

    tasks = [
        asyncio.create_task(_run_consumer_forever(name, consume_fn))
        for name, consume_fn in CONSUMER_TASK_FACTORIES
    ]
    app.state.consumer_tasks = tasks
    logger.info("[WORKER] Started %d consumer task(s) in API process.", len(tasks))


@app.on_event("shutdown")
async def shutdown():
    tasks = getattr(app.state, "consumer_tasks", [])
    for task in tasks:
        task.cancel()

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    await close_producer()


@app.get("/")
async def root():
    return {"status": "ok"}
