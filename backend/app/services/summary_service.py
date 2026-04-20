import asyncio
import json
import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
model = genai.GenerativeModel(GEMINI_MODEL)


def clean_json(text: str) -> str:
    text = text.strip()

    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return text


async def generate_summary(
    product: dict, decision: dict, gains: dict | None = None
) -> str:
    prompt = f"""
You are generating a concise business summary.

Given:
- product data
- triage decision
- gains analysis metrics

Write a short 2-3 sentence explanation explaining WHY this decision was made.

Focus on:
- condition
- resale value
- profitability
- market demand and ROI signals

Return ONLY plain text (no JSON).

Product:
{json.dumps(product)}

Decision:
{json.dumps(decision)}

Gains:
{json.dumps(gains or {})}
"""

    gains_payload = gains if isinstance(gains, dict) else {}
    fallback = (
        f"UPC {product.get('upc', 'UNKNOWN')} was classified as "
        f"{decision.get('decision', 'UNKNOWN')} based on condition "
        f"{product.get('condition', 'UNKNOWN')} and expected profitability "
        f"of {decision.get('estimated_profit_percentage', 0)}%. "
        f"Market demand is {gains_payload.get('market_demand', 'UNKNOWN')}, "
        f"resale potential is {gains_payload.get('resale_potential', 'UNKNOWN')}, "
        f"refurbishment complexity is {gains_payload.get('refurbishment_complexity', 'UNKNOWN')}, "
        f"and expected ROI is {gains_payload.get('expected_roi', 0)}%."
    )

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = getattr(response, "text", "") or ""
        cleaned = text.strip()
        return cleaned if cleaned else fallback
    except Exception:
        return fallback
