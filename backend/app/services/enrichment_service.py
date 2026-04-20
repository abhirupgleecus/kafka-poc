import asyncio
import json
import os
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
model = genai.GenerativeModel(GEMINI_MODEL)

def clean_json(text: str) -> str:
    text = text.strip()

    # Handle ```json ... ```
    if text.startswith("```"):
        text = text.strip("`")  # remove ```
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return text


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = clean_json(text)

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    start = cleaned.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found: {cleaned}")

    in_string = False
    escaped = False
    depth = 0
    end = -1

    for index, char in enumerate(cleaned[start:], start=start):
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index
                break

    if end == -1:
        raise ValueError(f"Unterminated JSON object: {cleaned}")

    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object, got: {type(data).__name__}")
    return data


def _fallback_product(upc: str) -> dict[str, Any]:
    return {
        "name": f"Unknown Product {upc}",
        "category": "UNKNOWN",
        "brand": "UNKNOWN",
        "estimated_price": 0,
    }


def _normalize_product(upc: str, raw: dict[str, Any]) -> dict[str, Any]:
    fallback = _fallback_product(upc)
    name = str(raw.get("name") or fallback["name"]).strip() or fallback["name"]
    category = str(raw.get("category") or fallback["category"]).strip() or fallback["category"]
    brand = str(raw.get("brand") or fallback["brand"]).strip() or fallback["brand"]

    estimated_price_raw = raw.get("estimated_price", fallback["estimated_price"])
    try:
        estimated_price = float(estimated_price_raw)
    except Exception:
        estimated_price = float(fallback["estimated_price"])

    if estimated_price < 0:
        estimated_price = 0.0

    return {
        "name": name,
        "category": category,
        "brand": brand,
        "estimated_price": round(estimated_price, 2),
    }


async def generate_product_data(upc: str) -> dict:
    prompt = f"""
You are a product data generator.

Given a UPC, generate a realistic product JSON.

Constraints:
- Return ONLY JSON
- Fields:
  name, category, brand, estimated_price

UPC: {upc}
"""

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = getattr(response, "text", "") or ""
        parsed = _extract_json_object(text)
        return _normalize_product(upc, parsed)
    except Exception:
        return _fallback_product(upc)
