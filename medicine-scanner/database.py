"""
MongoDB connection for the medicine-scanner. Uses its OWN collections
(medicinecache) so it never collides with the backend or rag-service data.
"""
from pymongo import MongoClient

import config

_client = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(config.MONGODB_URI)

    # Derive db name from the URI. Default to 'test' to match the backend (Mongoose
    # connects with no db path -> 'test'), so every service targets one database.
    db_name = config.MONGODB_URI.split("/")[-1].split("?")[0]
    if not db_name:
        db_name = "test"
    return _client[db_name]


def get_cache_collection():
    """Collection that caches generic lookups per drug (goal 42)."""
    col = get_db()["medicinecache"]
    # Unique on the normalized brand key so we never store/generate duplicates.
    col.create_index("brandKey", unique=True)
    return col


def test_connection() -> bool:
    try:
        get_db().command("ping")
        print("[Database] medicine-scanner DB connection OK")
        return True
    except Exception as e:
        print(f"[Database] connection failed: {e}")
        return False
