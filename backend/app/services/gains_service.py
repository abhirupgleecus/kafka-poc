import asyncio
import json
import math
import os
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv
from app.services.condition_service import condition_bucket, condition_details
from app.services.enriched_compat import get_estimated_price

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
model = genai.GenerativeModel(GEMINI_MODEL)
MARKET_DEMAND = {"HIGH", "MEDIUM", "LOW"}
RESALE_POTENTIAL = {"EXCELLENT", "GOOD", "FAIR", "POOR"}
REFURB_COMPLEXITY = {"LOW", "MEDIUM", "HIGH"}


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

    data = json.loads(cleaned[start : end + 1])
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


def _choice(value: Any, allowed: set[str], fallback: str) -> str:
    candidate = str(value or "").strip().upper()
    return candidate if candidate in allowed else fallback


def _fallback_gains(product: dict[str, Any], triage_decision: dict[str, Any]) -> dict[str, Any]:
    assessment = condition_details(product.get("assessment") or product.get("condition"))
    condition = condition_bucket(assessment)
    decision = str(triage_decision.get("decision", "")).upper()
    triage_pct = _to_float(triage_decision.get("estimated_profit_percentage"), 0.0)
    physical_condition = assessment["physical_condition"]
    functional_status = assessment["functional_status"]
    completeness = assessment["completeness"]
    age_of_product = assessment["age_of_product"]

    if physical_condition == "Excellent":
        physical_bonus = 2
    elif physical_condition == "Good":
        physical_bonus = 1
    elif physical_condition == "Fair":
        physical_bonus = 0
    elif physical_condition == "Poor":
        physical_bonus = -1
    else:
        physical_bonus = -2

    if functional_status == "Fully Working":
        functional_bonus = 2
    elif functional_status == "Partially Working":
        functional_bonus = 1
    elif functional_status == "Powers On But Faulty":
        functional_bonus = -1
    else:
        functional_bonus = -2

    if completeness == "Complete":
        completeness_bonus = 2
    elif completeness == "Missing Accessories":
        completeness_bonus = 1
    elif completeness == "Missing Key Components":
        completeness_bonus = -1
    else:
        completeness_bonus = -2

    if age_of_product == "0-1 years":
        age_bonus = 2
    elif age_of_product == "1-5 years":
        age_bonus = 1
    elif age_of_product == "5-10 years":
        age_bonus = 0
    else:
        age_bonus = -1

    health_score = physical_bonus + functional_bonus + completeness_bonus + age_bonus

    if decision == "REFURBISH":
        market_demand = "HIGH" if health_score >= 4 else "MEDIUM"
        if health_score >= 6:
            resale_potential = "EXCELLENT"
        elif health_score >= 3:
            resale_potential = "GOOD"
        else:
            resale_potential = "FAIR"

        if functional_status == "Fully Working" and completeness == "Complete":
            refurb_complexity = "LOW"
        elif completeness == "Missing Key Components" or functional_status == "Powers On But Faulty":
            refurb_complexity = "HIGH"
        else:
            refurb_complexity = "MEDIUM"

        expected_roi = max(35.0, triage_pct + 20.0 + (health_score * 2.0))
    elif decision == "HARVEST":
        market_demand = "MEDIUM" if health_score >= 0 else "LOW"
        if completeness in {"Complete", "Missing Accessories"} and functional_status in {"Fully Working", "Partially Working"}:
            resale_potential = "GOOD"
        elif condition == "GOOD":
            resale_potential = "GOOD"
        else:
            resale_potential = "FAIR"

        refurb_complexity = "LOW" if completeness != "Missing Key Components" else "MEDIUM"
        expected_roi = max(15.0, triage_pct + 8.0 + max(health_score, -1))
    else:
        market_demand = "LOW"
        resale_potential = "POOR"
        refurb_complexity = "LOW" if functional_status == "Dead" else "MEDIUM"
        expected_roi = 0.0

    return {
        "estimated_profit_percentage": round(max(0.0, min(100.0, triage_pct)), 2),
        "market_demand": market_demand,
        "resale_potential": resale_potential,
        "refurbishment_complexity": refurb_complexity,
        "expected_roi": round(max(0.0, min(300.0, expected_roi)), 2),
    }


def _normalize_gains(
    raw: dict[str, Any], product: dict[str, Any], triage_decision: dict[str, Any]
) -> dict[str, Any]:
    fallback = _fallback_gains(product, triage_decision)
    estimated_profit_percentage = _to_float(
        raw.get("estimated_profit_percentage"),
        float(fallback["estimated_profit_percentage"]),
    )
    expected_roi = _to_float(raw.get("expected_roi"), float(fallback["expected_roi"]))

    return {
        "estimated_profit_percentage": round(max(0.0, min(100.0, estimated_profit_percentage)), 2),
        "market_demand": _choice(raw.get("market_demand"), MARKET_DEMAND, fallback["market_demand"]),
        "resale_potential": _choice(
            raw.get("resale_potential"), RESALE_POTENTIAL, fallback["resale_potential"]
        ),
        "refurbishment_complexity": _choice(
            raw.get("refurbishment_complexity"),
            REFURB_COMPLEXITY,
            fallback["refurbishment_complexity"],
        ),
        "expected_roi": round(max(0.0, min(300.0, expected_roi)), 2),
    }


async def generate_gains(product: dict, triage_decision: dict) -> dict:
    prompt = f"""
You are a profit analysis engine.

Given product data and triage decision, analyze and return profit gains metrics.

Return ONLY JSON with these fields:
{{
  "estimated_profit_percentage": number (0-100, percentage),
  "market_demand": "HIGH" | "MEDIUM" | "LOW",
  "resale_potential": "EXCELLENT" | "GOOD" | "FAIR" | "POOR",
  "refurbishment_complexity": "LOW" | "MEDIUM" | "HIGH",
  "expected_roi": number (as percentage, 0-300)
}}

Consider:
- Current assessment and historical data
- If `assessment` is a structured object, use all of its subfields
- If `condition_bucket` is present, treat it only as a coarse summary
- Market demand for this product type
- Refurbishment complexity vs resale value
- Expected return on investment

Product:
{json.dumps(product)}

Triage Decision:
{json.dumps(triage_decision)}
"""

    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = getattr(response, "text", "") or ""
        parsed = _extract_json_object(text)
        return _normalize_gains(parsed, product, triage_decision)
    except Exception:
        return _fallback_gains(product, triage_decision)
