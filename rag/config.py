import os
from pathlib import Path
from dotenv import load_dotenv

# Keys live in backend/.env (single source of truth for all services).
# A local rag/.env, if present, can still override.
_BACKEND_ENV = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(_BACKEND_ENV)
load_dotenv(override=True)  # local .env (optional) wins

# --- keys / connections ---
MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# --- database ---
DB_NAME = "test"  # backend URI has no db path -> Mongoose defaults to `test`; must match
REPORTS_COLLECTION = "medicalreports"      # report metadata (filename, patient, date)
CHUNKS_COLLECTION = "reportchunks"         # chunk text + embedding vectors
VECTOR_INDEX_NAME = "report_vector_index"  # Atlas Search index (create in Atlas UI)

# --- embeddings (Gemini) ---
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 768   # must match the Atlas vector index dims EXACTLY

# --- chunking ---
CHUNK_SIZE = 500      # characters
CHUNK_OVERLAP = 50

# --- retrieval ---
DEFAULT_TOP_K = 4
