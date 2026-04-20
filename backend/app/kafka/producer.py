from aiokafka import AIOKafkaProducer
import os
import json
from dotenv import load_dotenv

load_dotenv()

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")

producer = None

async def get_producer():
    global producer
    if producer is None:
        producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS
        )
        await producer.start()
    return producer

async def send_event(topic: str, value: dict):
    prod = await get_producer()
    await prod.send_and_wait(
        topic,
        json.dumps(value).encode("utf-8")
    )


async def close_producer():
    global producer
    if producer is not None:
        await producer.stop()
        producer = None
