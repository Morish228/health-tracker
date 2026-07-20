import os
from pathlib import Path
from dotenv import load_dotenv

# Keys live in backend/.env (single source of truth for all services).
# A local agent/.env, if present, can still override.
_BACKEND_ENV = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(_BACKEND_ENV)
load_dotenv(override=True)  # local .env (optional) wins

# --- keys ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")

# langchain-tavily reads TAVILY_API_KEY from the environment — make sure it's set
if TAVILY_API_KEY:
    os.environ.setdefault("TAVILY_API_KEY", TAVILY_API_KEY)

# --- other services ---
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000/api")

# --- models (Groq for all text/grading — free-tier 429 solved setup) ---
FAST_MODEL = "llama-3.1-8b-instant"        # graders, router, safety gate
STRONG_MODEL = "llama-3.3-70b-versatile"   # generation, assistant
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "whisper-large-v3")  # voice STT

# --- CRAG thresholds ---
UPPER_TH = 0.7   # any doc above  -> verdict CORRECT
LOWER_TH = 0.3   # all docs below -> verdict INCORRECT

# --- Self-RAG loop caps (tight: production instinct, not CampusX's 10) ---
MAX_REVISE = 2     # revise_answer -> is_sup loop
MAX_REWRITES = 2   # rewrite_question -> retrieve loop

# --- memory ring ---
DB_NAME = "test"  # backend URI has no db path -> Mongoose defaults to `test`; must match
HISTORY_LIMIT = 10   # short-term: last N messages loaded per session
