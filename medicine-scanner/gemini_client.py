"""
Thin Gemini wrapper shared by vision + generics. Handles config, JSON parsing,
and graceful failure (returns None instead of raising when the key is missing).
"""
import io
import json
from typing import Any, Optional

import google.generativeai as genai
from PIL import Image

import config

if config.GEMINI_API_KEY:
    genai.configure(api_key=config.GEMINI_API_KEY)


def is_configured() -> bool:
    return bool(config.GEMINI_API_KEY)


def _parse_json(text: str) -> Optional[Any]:
    """Strip markdown fences and parse JSON; return None on failure."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]          # drop the ```json line
        cleaned = cleaned.rsplit("```", 1)[0]          # drop trailing ```
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        print(f"[gemini] could not parse JSON: {text[:200]}")
        return None


def generate_json(prompt: str) -> Optional[Any]:
    """Text-only prompt -> parsed JSON (or None)."""
    if not is_configured():
        return None
    try:
        model = genai.GenerativeModel(config.GEMINI_MODEL)
        resp = model.generate_content(prompt)
        return _parse_json(resp.text)
    except Exception as e:
        print(f"[gemini] generate_json failed: {e}")
        return None


def generate_json_from_image(prompt: str, image_bytes: bytes) -> Optional[Any]:
    """Prompt + image -> parsed JSON (or None). Used for medicine identification."""
    if not is_configured():
        return None
    try:
        img = Image.open(io.BytesIO(image_bytes))
        model = genai.GenerativeModel(config.GEMINI_MODEL)
        resp = model.generate_content([prompt, img])
        return _parse_json(resp.text)
    except Exception as e:
        print(f"[gemini] generate_json_from_image failed: {e}")
        return None
