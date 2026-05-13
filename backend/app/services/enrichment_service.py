import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
google_search_tool = types.Tool(google_search=types.GoogleSearch())


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


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def _str(val: Any, default: str = "UNKNOWN") -> str:
    if isinstance(val, str) and val.strip():
        return val.strip()
    return default


def _num_str(val: Any, default: str = "0") -> str:
    if isinstance(val, (int, float)):
        return str(round(val, 2))
    if isinstance(val, str) and val.strip():
        return val.strip()
    return default


def _list_of_str(val: Any) -> list[str]:
    if isinstance(val, list):
        return [str(v).strip() for v in val if isinstance(v, str) and v.strip()]
    return []


def _dict(val: Any) -> dict[str, Any]:
    return val if isinstance(val, dict) else {}


def _normalize_materials(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []

    result = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        circularity = _dict(item.get("circularity"))
        materials_raw = item.get("materials", [])
        if not isinstance(materials_raw, list):
            materials_raw = []

        normalized_materials = []
        for mat in materials_raw:
            if not isinstance(mat, dict):
                continue
            normalized_materials.append({
                "material_id": _str(mat.get("material_id"), str(uuid.uuid4())),
                "material_name": _str(mat.get("material_name")),
                "fraction_weight": _str(mat.get("fraction_weight"), "0"),
            })

        result.append({
            "uuid": _str(item.get("uuid"), str(uuid.uuid4())),
            "parent_component": _str(item.get("parent_component"), ""),
            "name": _str(item.get("name")),
            "type": _str(item.get("type")),
            "quantity": item.get("quantity", 1) if isinstance(item.get("quantity"), (int, float)) else 1,
            "uom": _str(item.get("uom"), "each"),
            "circularity": {
                "reusability_score": _num_str(circularity.get("reusability_score") or circularity.get("reuability_score"), "0.5"),
                "recyclability_score": _num_str(circularity.get("recyclability_score"), "0.5"),
                "repairability_score": _num_str(circularity.get("repairability_score"), "0.5"),
                "material_recovery_routes": _list_of_str(circularity.get("material_recovery_routes")),
                "recommended_action": _str(circularity.get("recommended_action"), "reuse"),
            },
            "materials": normalized_materials,
        })

    return result


def _normalize_product(upc: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize the LLM output into the canonical enriched schema."""
    metadata = _dict(raw.get("metadata"))
    technical = _dict(raw.get("technical"))
    compliance = _dict(raw.get("compliance"))
    market_value = _dict(raw.get("market_value"))
    manufacturer = _dict(metadata.get("manufacturer"))
    identity = _dict(metadata.get("identity"))

    product_uuid = str(uuid.uuid4())

    disassembly = _str(technical.get("disassembly_complexity"), "medium").lower()
    if disassembly not in ("low", "medium", "high"):
        disassembly = "medium"

    demand = _str(market_value.get("market_demand"), "medium").lower()
    if demand not in ("high", "medium", "low"):
        demand = "medium"

    compliance_fields = {}
    for field in ("authorized_needed", "special_handling_required", "contains_user_data", "mandatory_data_wipe_needed"):
        val = _str(compliance.get(field), "no").lower()
        compliance_fields[field] = val if val in ("yes", "no") else "no"

    return {
        "metadata": {
            "name": _str(metadata.get("name")),
            "category": _str(metadata.get("category")),
            "brand": _str(metadata.get("brand")),
            "type": _str(metadata.get("type"), "SmallWhiteGoods"),
            "manufacturer": {
                "oem": _str(manufacturer.get("oem"), str(uuid.uuid4())),
                "origin": _str(manufacturer.get("origin")),
                "facility": _str(manufacturer.get("facility")),
            },
            "identity": {
                "upc": upc,
                "ean": _str(identity.get("ean"), ""),
                "gtin": _str(identity.get("gtin"), ""),
                "variant": _str(identity.get("variant"), ""),
                "model_number": _str(identity.get("model_number"), ""),
                "serial_number": _str(identity.get("serial_number"), ""),
                "model_year": _str(identity.get("model_year"), ""),
                "master_uuid": _str(identity.get("master_uuid"), str(uuid.uuid4())),
                "uuid": product_uuid,
            },
        },
        "technical": {
            "weight": _str(technical.get("weight"), "N/A"),
            "dimensions": _str(technical.get("dimensions"), "N/A"),
            "repairability_score": _str(technical.get("repairability_score"), "N/A"),
            "disassembly_complexity": disassembly,
            "average_life_span": _str(technical.get("average_life_span"), "N/A"),
            "energy_efficiency_rating": _str(technical.get("energy_efficiency_rating"), "N/A"),
        },
        "compliance": {
            **compliance_fields,
            "hazardous_materials": _list_of_str(compliance.get("hazardous_materials")),
            "required_certifications": _list_of_str(compliance.get("required_certifications")),
        },
        "market_value": {
            "valuation_timestamp": _str(market_value.get("valuation_timestamp"), datetime.now(timezone.utc).isoformat()),
            "location_context": _str(market_value.get("location_context"), "US"),
            "market_demand": demand,
            "average_sale_time": _str(market_value.get("average_sale_time"), "N/A"),
            "current_market_value": _num_str(market_value.get("current_market_value")),
            "refurbished_market_value": _num_str(market_value.get("refurbished_market_value")),
            "estimated_refurbish_cost": _num_str(market_value.get("estimated_refurbish_cost")),
            "expected_refurbish_profit": _num_str(market_value.get("expected_refurbish_profit")),
            "total_parts_value": _num_str(market_value.get("total_parts_value")),
            "net_parts_harvest_value": _num_str(market_value.get("net_parts_harvest_value")),
            "total_recycling_value": _num_str(market_value.get("total_recycling_value")),
            "net_recycling_value": _num_str(market_value.get("net_recycling_value")),
            "disposal_cost": _num_str(market_value.get("disposal_cost")),
        },
        "materials_composition": _normalize_materials(raw.get("materials_composition")),
    }


def _fallback_product(upc: str) -> dict[str, Any]:
    return _normalize_product(upc, {})


# ---------------------------------------------------------------------------
# Main generation function
# ---------------------------------------------------------------------------

async def generate_product_data(upc: str) -> dict:
    prompt = f"""You are an expert product data generator for reverse logistics and circular economy operations.

Given a UPC/product code, generate a comprehensive product data JSON following the EXACT schema below.
Fill in realistic, plausible values based on your knowledge of consumer products.

Return ONLY the JSON object, no other text.

Schema:
{{
  "metadata": {{
    "name": "string - full product name",
    "category": "string - product category",
    "brand": "string - brand name",
    "type": "SmallWhiteGoods or LargeWhiteGoods",
    "manufacturer": {{
      "oem": "string - UUID of the manufacturing company",
      "origin": "string - country of manufacture",
      "facility": "string - manufacturing facility name"
    }},
    "identity": {{
      "upc": "{upc}",
      "ean": "string",
      "gtin": "string",
      "variant": "string",
      "model_number": "string",
      "serial_number": "string",
      "model_year": "string"
    }}
  }},
  "technical": {{
    "weight": "string - e.g. 2.5 kg",
    "dimensions": "string - e.g. 30x20x15 cm",
    "repairability_score": "string - score out of 10",
    "disassembly_complexity": "low or medium or high",
    "average_life_span": "string - e.g. 5 years",
    "energy_efficiency_rating": "string - e.g. A++"
  }},
  "compliance": {{
    "authorized_needed": "yes or no",
    "special_handling_required": "yes or no",
    "contains_user_data": "yes or no",
    "mandatory_data_wipe_needed": "yes or no",
    "hazardous_materials": ["list of hazardous materials if any"],
    "required_certifications": ["list of certifications"]
  }},
  "market_value": {{
    "valuation_timestamp": "ISO 8601 timestamp",
    "location_context": "string - e.g. US",
    "market_demand": "high or medium or low",
    "average_sale_time": "string - e.g. 7 days",
    "current_market_value": "string - dollar amount",
    "refurbished_market_value": "string - dollar amount",
    "estimated_refurbish_cost": "string - dollar amount",
    "expected_refurbish_profit": "string - dollar amount",
    "total_parts_value": "string - dollar amount",
    "net_parts_harvest_value": "string - dollar amount",
    "total_recycling_value": "string - dollar amount",
    "net_recycling_value": "string - dollar amount",
    "disposal_cost": "string - dollar amount"
  }},
  "materials_composition": [
    {{
      "name": "string - component name",
      "type": "string - component type",
      "quantity": 1,
      "uom": "each",
      "circularity": {{
        "reusability_score": "0-1 float as string",
        "recyclability_score": "0-1 float as string",
        "repairability_score": "0-1 float as string",
        "material_recovery_routes": ["reuse", "repair", "parts_harvest"],
        "recommended_action": "string"
      }},
      "materials": [
        {{
          "material_name": "string",
          "fraction_weight": "string - e.g. 0.3 kg"
        }}
      ]
    }}
  ]
}}

UPC: {upc}"""

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[google_search_tool]
            )
        )
        text = getattr(response, "text", "") or ""
        parsed = _extract_json_object(text)
        return _normalize_product(upc, parsed)
    except Exception:
        return _fallback_product(upc)
