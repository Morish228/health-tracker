"""
Medicine identification from a photo (goals 15-16) using Gemini Vision.
"""
from typing import Optional

import config
import gemini_client

_IDENTIFY_PROMPT = (
    "You are a pharmacist assistant. Look at this photo of a medicine box/strip and "
    "identify the medicine. Respond ONLY with JSON of the exact shape:\n"
    '{"brandName": string|null, "genericName": string|null, "composition": string|null, '
    '"estimatedBrandPrice": number|null}\n'
    f'Prices are approximate in {config.PRICE_CURRENCY}. If you cannot read the box, '
    "set fields to null. Do not add any text outside the JSON."
)


def identify_medicine(image_bytes: bytes) -> Optional[dict]:
    """
    Returns a dict:
      {brandName, genericName, composition, estimatedBrandPrice}
    or None if Gemini is unavailable / failed.
    """
    data = gemini_client.generate_json_from_image(_IDENTIFY_PROMPT, image_bytes)
    if not isinstance(data, dict):
        return None
    return {
        "brandName": data.get("brandName"),
        "genericName": data.get("genericName"),
        "composition": data.get("composition"),
        "estimatedBrandPrice": data.get("estimatedBrandPrice"),
        "currency": config.PRICE_CURRENCY,
    }
