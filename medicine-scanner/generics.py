"""
Generic-alternative finder + price comparison (goal 17), cached per drug (goal 42).

The cache key is the normalized brand name, so the SAME drug never calls Gemini twice.
"""
import datetime
from typing import List, Optional

import config
import gemini_client
from database import get_cache_collection


def _normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _build_prompt(brand_name: str, composition: Optional[str]) -> str:
    comp = f" (active ingredient: {composition})" if composition else ""
    return (
        f"The brand medicine is '{brand_name}'{comp}. List cheaper GENERIC alternatives "
        f"with the same active ingredient available in {config.PRICE_CURRENCY} markets. "
        "Respond ONLY with a JSON array; each item exactly:\n"
        '{"name": string, "composition": string, "estimatedPrice": number, "note": string}\n'
        "Order from cheapest to most expensive. Prices are approximate. Max 6 items. "
        "If none are known, return an empty array []."
    )


def find_generics(brand_name: str, composition: Optional[str] = None) -> dict:
    """
    Returns { alternatives: [...], cached: bool }.
    alternatives items: {name, composition, estimatedPrice, currency, note}
    """
    brand_key = _normalize(brand_name)
    col = get_cache_collection()

    # 1. Cache hit -> no Gemini call.
    cached_doc = col.find_one({"brandKey": brand_key})
    if cached_doc:
        return {"alternatives": cached_doc.get("alternatives", []), "cached": True}

    # 2. No Gemini -> return empty gracefully.
    if not gemini_client.is_configured():
        return {"alternatives": [], "cached": False}

    # 3. Ask Gemini.
    raw = gemini_client.generate_json(_build_prompt(brand_name, composition))
    alternatives: List[dict] = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict) or not item.get("name"):
                continue
            alternatives.append(
                {
                    "name": item.get("name"),
                    "composition": item.get("composition"),
                    "estimatedPrice": item.get("estimatedPrice"),
                    "currency": config.PRICE_CURRENCY,
                    "note": item.get("note"),
                }
            )

    # 4. Cache (best-effort; ignore duplicate-key races).
    try:
        col.update_one(
            {"brandKey": brand_key},
            {
                "$set": {
                    "brandKey": brand_key,
                    "brandName": brand_name,
                    "composition": composition,
                    "alternatives": alternatives,
                    "updatedAt": datetime.datetime.utcnow(),
                },
                "$setOnInsert": {"createdAt": datetime.datetime.utcnow()},
            },
            upsert=True,
        )
    except Exception as e:
        print(f"[generics] cache write failed: {e}")

    return {"alternatives": alternatives, "cached": False}
