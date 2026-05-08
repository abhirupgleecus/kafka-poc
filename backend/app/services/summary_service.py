import asyncio
import json
import os

import google.generativeai as genai
from dotenv import load_dotenv
from app.services.condition_service import condition_display

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
You are a senior secondary market analyst. Generate a data-dense Triage Summary Report.

### Telemetry:
- Product: {json.dumps(product)}
- Condition: {json.dumps(decision.get('assessment') or product.get('assessment') or product.get('condition'))}
- Decision: {json.dumps(decision.get('decision') or decision.get('triage_decision'))}
- Financials: {json.dumps(gains or {})}

### Output Structure (Strictly Follow):
1. **STRATEGIC OVERVIEW**: 1-2 dense paragraphs explaining the logic. Use real-world citations formatted EXACTLY as `[[*Source Name*]](URL)` (e.g., `[[*eBay Market Trends*]](https://www.ebay.com/sch/i.html?_nkw=Product+Name+Sold)`) to justify value/demand.
   - Use live search query URLs (eBay sold listings, Google Market results) whenever possible to provide "real-world" proof of your claims.
   - The citations must be inline and italicized within the brackets as shown.
2. **KEY PARAMETERS**: 4-6 bullet points of strategic metrics.
3. **STRATEGIC CONCLUSION**: 2-line final impact statement.

### Mandatory Rules:
- DO NOT include drafts, "Draft 1", "Check against constraints", or any internal reasoning.
- DO NOT include the instructions or prompt text in your response.
- Start your response IMMEDIATELY with the "STRATEGIC OVERVIEW" header.
- Use a professional, analytical tone.
- Use plain text for headers (e.g., STRATEGIC OVERVIEW) rather than Markdown symbols if possible, to keep the UI clean.
- Ensure all numbers and dollar amounts are mentioned clearly.
"""

    gains_payload = gains if isinstance(gains, dict) else {}
    fallback = (
        f"UPC {product.get('upc', 'UNKNOWN')} was classified as "
        f"{decision.get('decision', 'UNKNOWN')} based on assessment "
        f"{condition_display(product.get('assessment') or product.get('condition'))} and expected profitability "
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
