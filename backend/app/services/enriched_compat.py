"""Backward compatibility helpers for reading enriched product data.

Supports both the legacy flat format (name, brand, category, estimated_price)
and the new nested format (metadata.name, market_value.current_market_value, etc.).
"""
from __future__ import annotations

import math
from typing import Any


def get_product_name(product: dict[str, Any]) -> str:
    """Extract product name from either enriched format."""
    metadata = product.get("metadata")
    if isinstance(metadata, dict):
        name = metadata.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()

    for key in ("name", "product_name"):
        name = product.get(key)
        if isinstance(name, str) and name.strip():
            return name.strip()

    return "Unknown Product"


def get_product_brand(product: dict[str, Any]) -> str:
    """Extract brand from either enriched format."""
    metadata = product.get("metadata")
    if isinstance(metadata, dict):
        brand = metadata.get("brand")
        if isinstance(brand, str) and brand.strip():
            return brand.strip()

    brand = product.get("brand")
    if isinstance(brand, str) and brand.strip():
        return brand.strip()

    return "UNKNOWN"


def get_product_category(product: dict[str, Any]) -> str:
    """Extract category from either enriched format."""
    metadata = product.get("metadata")
    if isinstance(metadata, dict):
        cat = metadata.get("category")
        if isinstance(cat, str) and cat.strip():
            return cat.strip()

    cat = product.get("category")
    if isinstance(cat, str) and cat.strip():
        return cat.strip()

    return "UNKNOWN"


def _parse_price(val: Any) -> float | None:
    """Try to parse a numeric value from various representations."""
    if isinstance(val, (int, float)):
        num = float(val)
        return num if math.isfinite(num) else None

    if isinstance(val, str):
        cleaned = val.strip().replace("$", "").replace(",", "")
        if not cleaned:
            return None
        try:
            num = float(cleaned)
            return num if math.isfinite(num) else None
        except ValueError:
            return None

    return None


def get_estimated_price(product: dict[str, Any]) -> float:
    """Extract estimated price from either enriched format."""
    # New format: market_value.current_market_value
    mv = product.get("market_value")
    if isinstance(mv, dict):
        price = _parse_price(mv.get("current_market_value"))
        if price is not None:
            return max(0.0, price)

    # Legacy format
    price = _parse_price(product.get("estimated_price"))
    if price is not None:
        return max(0.0, price)

    return 0.0
