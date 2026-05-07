import asyncio
import json
import math
import os
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv
from app.services.condition_service import condition_bucket, condition_details, condition_reasoning_summary

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
model = genai.GenerativeModel(GEMINI_MODEL)
ALLOWED_DECISIONS = {"REFURBISH", "HARVEST", "SCRAP"}


def clean_json(text: str) -> str:
    text = text.strip()

    if text.startswith("```"):
        text = text.strip("`")
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

    candidate = cleaned[start : end + 1]
    data = json.loads(candidate)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object, got: {type(data).__name__}")
    return data


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


def _fallback_triage(product: dict[str, Any]) -> dict[str, Any]:
    assessment = condition_details(product.get("assessment") or product.get("condition"))
    condition = condition_bucket(assessment)
    estimated_price = _to_float(product.get("estimated_price"), 0.0)
    physical_condition = assessment["physical_condition"]
    functional_status = assessment["functional_status"]
    completeness = assessment["completeness"]
    age_of_product = assessment["age_of_product"]

    if (
        physical_condition == "Damaged"
        or functional_status == "Dead"
        or completeness == "Heavily Stripped"
    ):
        decision = "SCRAP"
        reason = (
            "Assessment indicates "
            f"{condition_reasoning_summary(assessment)}, which makes refurbishment unlikely to be profitable."
        )
        pct = 0.0
    elif (
        physical_condition in {"Excellent", "Good"}
        and functional_status == "Fully Working"
        and completeness == "Complete"
    ):
        if estimated_price >= 150:
            decision = "REFURBISH"
            reason = (
                "Assessment indicates "
                f"{condition_reasoning_summary(assessment)}, which supports refurbishment upside."
            )
            pct = 35.0
        else:
            decision = "HARVEST"
            reason = (
                "Assessment indicates "
                f"{condition_reasoning_summary(assessment)}, but resale is moderate, so component harvest is safer."
            )
            pct = 20.0
    else:
        if (
            functional_status in {"Partially Working", "Powers On But Faulty"}
            or completeness in {"Missing Accessories", "Missing Key Components"}
            or age_of_product in {"5-10 years", "10+ years"}
        ) and estimated_price >= 75:
            decision = "HARVEST"
            reason = (
                "Assessment indicates "
                f"{condition_reasoning_summary(assessment)}, so harvest is the balanced option."
            )
            pct = 15.0
        else:
            decision = "SCRAP" if condition == "POOR" else "HARVEST"
            reason = (
                "Assessment indicates "
                f"{condition_reasoning_summary(assessment)}, and price signals limited upside."
            )
            pct = 0.0 if decision == "SCRAP" else 10.0

    amount = round((estimated_price * pct) / 100.0, 2)
    return {
        "decision": decision,
        "reason": reason,
        "estimated_profit_amount": amount,
        "estimated_profit_percentage": pct,
    }


def _normalize_triage(raw: dict[str, Any], product: dict[str, Any]) -> dict[str, Any]:
    fallback = _fallback_triage(product)
    decision = str(raw.get("decision", "")).strip().upper()
    if decision not in ALLOWED_DECISIONS:
        decision = fallback["decision"]

    reason = str(raw.get("reason") or fallback["reason"]).strip() or fallback["reason"]
    estimated_profit_percentage = _to_float(
        raw.get("estimated_profit_percentage"),
        float(fallback["estimated_profit_percentage"]),
    )
    estimated_profit_percentage = max(0.0, min(100.0, estimated_profit_percentage))

    estimated_profit_amount = _to_float(
        raw.get("estimated_profit_amount"),
        float(fallback["estimated_profit_amount"]),
    )
    estimated_profit_amount = max(0.0, estimated_profit_amount)

    return {
        "decision": decision,
        "reason": reason,
        "estimated_profit_amount": round(estimated_profit_amount, 2),
        "estimated_profit_percentage": round(estimated_profit_percentage, 2),
    }


async def generate_triage_decision(product: dict) -> dict:
    prompt = f"""
You are a decision engine for product triage.

Given product data, choose ONLY one:
- REFURBISH
- HARVEST
- SCRAP

Goal: maximize profit.

Rules:
- Consider the assessment VERY IMPORTANT
- The `assessment` field may be a structured object with:
  - physical_condition
  - functional_status
  - completeness
  - age_of_product
- Use all provided assessment subfields in your reasoning, not just physical_condition
- If `condition_bucket` is present, treat it only as a derived summary, not the primary evidence
- Consider estimated_price
- Consider Historical data of similar products (use your knowledge)

Return ONLY JSON with:
1. Decision and reasoning
2. Profit metrics

{{
  "decision": "...",
  "reason": "...",
  "estimated_profit_amount": number,
  "estimated_profit_percentage": number
}}

Field definitions:
- estimated_profit_amount: dollar amount profit
- estimated_profit_percentage: profit as percentage (0-100)

Product:
{json.dumps(product)}
"""

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = getattr(response, "text", "") or ""
        parsed = _extract_json_object(text)
        return _normalize_triage(parsed, product)
    except Exception:
        return _fallback_triage(product)
