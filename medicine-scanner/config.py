"""
Config for the medicine-scanner service. Reads ../backend/.env as a fallback and
this service's .env (which takes precedence), matching the rag-service pattern.
"""
import os
from dotenv import load_dotenv

_HERE = os.path.dirname(__file__)
load_dotenv(dotenv_path=os.path.join(_HERE, "..", "backend", ".env"))
load_dotenv(dotenv_path=os.path.join(_HERE, ".env"), override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
PRICE_CURRENCY = os.getenv("PRICE_CURRENCY", "INR")

DISCLAIMER = (
    "AI-generated identification and estimated prices. Not a substitute for a "
    "pharmacist. Always verify the medicine and price before purchase."
)
