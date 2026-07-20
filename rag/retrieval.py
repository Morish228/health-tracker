"""
Retrieval: query text -> embedding -> patient-scoped $vectorSearch -> top-k chunks.
Stateless. No LLM generation here — the agent-service does all reasoning.
"""
from google import genai

from config import (
    GEMINI_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIM,
    VECTOR_INDEX_NAME, DEFAULT_TOP_K,
)
from ingestion import chunks_col

gemini = genai.Client(api_key=GEMINI_API_KEY)


def embed_query(query: str) -> list[float]:
    """Embed the QUERY (task_type retrieval_query — NOT retrieval_document)."""
    result = gemini.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
        config={"task_type": "retrieval_query", "output_dimensionality": EMBEDDING_DIM},
    )
    return result.embeddings[0].values


def retrieve_chunks(query: str, patient_id: str, top_k: int = DEFAULT_TOP_K,
                    report_id: str | None = None) -> list[dict]:
    query_vector = embed_query(query)

    # always patient-scoped; optionally narrowed to a single report
    vs_filter: dict = {"patient_id": patient_id}
    if report_id:
        vs_filter["report_id"] = report_id

    results = chunks_col.aggregate([
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": top_k * 10,
                "limit": top_k,
                "filter": vs_filter,
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "report_id": 1,
                "chunk_index": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ])
    return list(results)
