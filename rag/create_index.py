"""
create_index.py — one-off Atlas vector index migration.
The old index filtered on camelCase fields (patientId/reportId) from the old rag-service;
the rewritten ingestion writes snake_case (patient_id/report_id). Recreate to match.

Run once:  python create_index.py
"""
import time
from pymongo import MongoClient
from pymongo.operations import SearchIndexModel

from config import MONGO_URI, DB_NAME, CHUNKS_COLLECTION, VECTOR_INDEX_NAME, EMBEDDING_DIM

mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]
chunks = db[CHUNKS_COLLECTION]
reports = db["medicalreports"]


def main():
    # 1) report what's in the collections (old camelCase docs vs new snake_case)
    old_chunks = chunks.count_documents({"patientId": {"$exists": True}})
    new_chunks = chunks.count_documents({"patient_id": {"$exists": True}})
    old_reports = reports.count_documents({"patientId": {"$exists": True}})
    print(f"chunks: {old_chunks} legacy camelCase, {new_chunks} new snake_case")
    print(f"reports: {old_reports} legacy camelCase")

    # 2) delete legacy docs — unreachable by the new snake_case filter anyway
    if old_chunks:
        r = chunks.delete_many({"patientId": {"$exists": True}})
        print(f"deleted {r.deleted_count} legacy chunks")
    if old_reports:
        r = reports.delete_many({"patientId": {"$exists": True}})
        print(f"deleted {r.deleted_count} legacy reports")

    # 3) drop the old index if present
    existing = [ix["name"] for ix in chunks.list_search_indexes()]
    if VECTOR_INDEX_NAME in existing:
        print(f"dropping old index {VECTOR_INDEX_NAME}...")
        chunks.drop_search_index(VECTOR_INDEX_NAME)
        while VECTOR_INDEX_NAME in [ix["name"] for ix in chunks.list_search_indexes()]:
            time.sleep(3)
        print("dropped.")

    # 4) create the new index with snake_case filter fields
    model = SearchIndexModel(
        name=VECTOR_INDEX_NAME,
        type="vectorSearch",
        definition={
            "fields": [
                {"type": "vector", "path": "embedding",
                 "numDimensions": EMBEDDING_DIM, "similarity": "cosine"},
                {"type": "filter", "path": "patient_id"},
                {"type": "filter", "path": "report_id"},
            ]
        },
    )
    chunks.create_search_index(model)
    print(f"creating {VECTOR_INDEX_NAME}...")

    # 5) poll until queryable
    while True:
        ix = next((i for i in chunks.list_search_indexes() if i["name"] == VECTOR_INDEX_NAME), None)
        if ix and ix.get("queryable"):
            print(f"index READY (status={ix.get('status')})")
            break
        time.sleep(5)
        print("  waiting for index to become queryable...")


if __name__ == "__main__":
    main()
