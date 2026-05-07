from __future__ import annotations

import random
from typing import Any

PHYSICAL_CONDITION_OPTIONS = (
    "Excellent",
    "Good",
    "Fair",
    "Poor",
    "Damaged",
)
FUNCTIONAL_STATUS_OPTIONS = (
    "Fully Working",
    "Partially Working",
    "Powers On But Faulty",
    "Dead",
)
COMPLETENESS_OPTIONS = (
    "Complete",
    "Missing Accessories",
    "Missing Key Components",
    "Heavily Stripped",
)
AGE_OF_PRODUCT_OPTIONS = (
    "0-1 years",
    "1-5 years",
    "5-10 years",
    "10+ years",
)

# Backward-compatible alias for older imports and payloads.
AGE_USAGE_TIER_OPTIONS = AGE_OF_PRODUCT_OPTIONS

ASSESSMENT_OPTION_MAP = {
    "physical_condition": set(PHYSICAL_CONDITION_OPTIONS),
    "functional_status": set(FUNCTIONAL_STATUS_OPTIONS),
    "completeness": set(COMPLETENESS_OPTIONS),
    "age_of_product": set(AGE_OF_PRODUCT_OPTIONS),
}

LEGACY_CONDITION_TO_PHYSICAL = {
    "EXCELLENT": "Excellent",
    "GOOD": "Good",
    "FAIR": "Fair",
    "POOR": "Poor",
    "DAMAGED": "Damaged",
}


def normalize_assessment_payload(value: Any) -> dict[str, str] | None:
    if not isinstance(value, dict):
        return None

    age_of_product = value.get("age_of_product")
    if not isinstance(age_of_product, str):
        legacy_age_value = value.get("estimated_age_usage_tier")
        if isinstance(legacy_age_value, str):
            age_of_product = {
                "Like New (0-1 yr)": "0-1 years",
                "Lightly Used (1-3 yr)": "1-5 years",
                "Moderately Used (3-5 yr)": "5-10 years",
                "Heavily Used (5+ yr)": "10+ years",
            }.get(legacy_age_value.strip())

    normalized: dict[str, str] = {}
    for field_name, allowed_values in ASSESSMENT_OPTION_MAP.items():
        candidate = age_of_product if field_name == "age_of_product" else value.get(field_name)
        if not isinstance(candidate, str):
            return None

        cleaned = candidate.strip()
        if cleaned not in allowed_values:
            return None

        normalized[field_name] = cleaned

    return normalized


def build_fallback_assessment(legacy_condition: Any = None) -> dict[str, str]:
    physical_condition = LEGACY_CONDITION_TO_PHYSICAL.get(
        str(legacy_condition or "").strip().upper()
    )
    if not physical_condition:
        physical_condition = random.choice(("Good", "Fair", "Poor"))

    if physical_condition == "Excellent":
        functional_status = "Fully Working"
        completeness = "Complete"
        age_of_product = "0-1 years"
    elif physical_condition == "Good":
        functional_status = "Fully Working"
        completeness = "Complete"
        age_of_product = "1-5 years"
    elif physical_condition == "Fair":
        functional_status = "Partially Working"
        completeness = "Missing Accessories"
        age_of_product = "5-10 years"
    elif physical_condition == "Poor":
        functional_status = "Powers On But Faulty"
        completeness = "Missing Key Components"
        age_of_product = "10+ years"
    else:
        functional_status = "Dead"
        completeness = "Heavily Stripped"
        age_of_product = "10+ years"

    return {
        "physical_condition": physical_condition,
        "functional_status": functional_status,
        "completeness": completeness,
        "age_of_product": age_of_product,
    }


def extract_assessment_payload(value: Any) -> Any:
    if isinstance(value, dict):
        normalized = normalize_assessment_payload(value)
        if normalized:
            return normalized

        for field_name in ("assessment", "condition"):
            nested_value = value.get(field_name)
            nested_normalized = normalize_assessment_payload(nested_value)
            if nested_normalized:
                return nested_normalized

            if nested_value is not None:
                return nested_value

    return value


def ensure_condition_payload(value: Any) -> dict[str, str]:
    extracted = extract_assessment_payload(value)
    normalized = normalize_assessment_payload(extracted)
    if normalized:
        return normalized

    return build_fallback_assessment(extracted)


def condition_details(value: Any) -> dict[str, str]:
    return ensure_condition_payload(value)


def condition_bucket(value: Any) -> str:
    normalized = normalize_assessment_payload(value)
    if not normalized:
        legacy = str(value or "").strip().upper()
        if legacy in {"GOOD", "FAIR", "POOR"}:
            return legacy
        if legacy == "EXCELLENT":
            return "GOOD"
        if legacy == "DAMAGED":
            return "POOR"
        return "FAIR"

    physical_score = {
        "Excellent": 3,
        "Good": 2,
        "Fair": 1,
        "Poor": -1,
        "Damaged": -3,
    }
    functional_score = {
        "Fully Working": 3,
        "Partially Working": 1,
        "Powers On But Faulty": -1,
        "Dead": -3,
    }
    completeness_score = {
        "Complete": 2,
        "Missing Accessories": 1,
        "Missing Key Components": -2,
        "Heavily Stripped": -3,
    }
    age_score = {
        "0-1 years": 2,
        "1-5 years": 1,
        "5-10 years": 0,
        "10+ years": -1,
    }

    physical_condition = normalized["physical_condition"]
    functional_status = normalized["functional_status"]
    completeness = normalized["completeness"]

    if (
        physical_condition == "Damaged"
        or functional_status == "Dead"
        or completeness in {"Missing Key Components", "Heavily Stripped"}
    ):
        return "POOR"

    total_score = (
        physical_score[physical_condition]
        + functional_score[functional_status]
        + completeness_score[completeness]
        + age_score[normalized["age_of_product"]]
    )

    if total_score >= 6:
        return "GOOD"
    if total_score >= 2:
        return "FAIR"
    return "POOR"


def condition_display(value: Any) -> str:
    normalized = normalize_assessment_payload(value)
    if normalized:
        return " / ".join(
            [
                normalized["physical_condition"],
                normalized["functional_status"],
                normalized["completeness"],
                normalized["age_of_product"],
            ]
        )

    if isinstance(value, str) and value.strip():
        return value.strip()

    return "UNKNOWN"


def condition_reasoning_summary(value: Any) -> str:
    normalized = normalize_assessment_payload(value)
    if not normalized:
        if isinstance(value, str) and value.strip():
            return f"condition {value.strip()}"
        return "condition UNKNOWN"

    return (
        f"physical condition {normalized['physical_condition']}, "
        f"functional status {normalized['functional_status']}, "
        f"completeness {normalized['completeness']}, "
        f"and age of product {normalized['age_of_product']}"
    )
