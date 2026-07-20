"""
Ingestion pipeline: file bytes -> text -> chunks -> embeddings -> Mongo.
Stateless: every function takes inputs, returns outputs. No memory here.
"""
import io
from datetime import datetime, timezone

import pdfplumber
from google import genai
from pymongo import MongoClient

from config import (
    MONGO_URI, GEMINI_API_KEY,
    DB_NAME, REPORTS_COLLECTION, CHUNKS_COLLECTION,
    EMBEDDING_MODEL, EMBEDDING_DIM, CHUNK_SIZE, CHUNK_OVERLAP,
)

# --- clients (module-level, created once) ---
mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]
reports_col = db[REPORTS_COLLECTION]
chunks_col = db[CHUNKS_COLLECTION]

gemini = genai.Client(api_key=GEMINI_API_KEY)


# =====================================================
# 1) EXTRACT — PDF via pdfplumber, images via Gemini Vision OCR
# =====================================================
def extract_text(file_bytes: bytes, filename: str) -> str:
    name = filename.lower()

    if name.endswith(".pdf"):
        text_parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts).strip()

    if name.endswith((".png", ".jpg", ".jpeg")):
        mime = "image/png" if name.endswith(".png") else "image/jpeg"
        resp = gemini.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                {"inline_data": {"mime_type": mime, "data": file_bytes}},
                "Extract ALL text from this medical report image. "
                "Preserve values, units and labels exactly. Output text only.",
            ],
        )
        return (resp.text or "").strip()

    raise ValueError(f"Unsupported file type: {filename}")


# =====================================================
# 2) CHUNK — 500 chars, 50 overlap, break on word boundary
# =====================================================
def split_text(text: str) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        if end < len(text):
            # walk back to the last space so we don't cut a word in half
            space = text.rfind(" ", start, end)
            if space > start:
                end = space
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - CHUNK_OVERLAP if end - CHUNK_OVERLAP > start else end
    return chunks


# =====================================================
# 3) EMBED — Gemini, task_type matters (document vs query)
# =====================================================
def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed document chunks (retrieval_document task type)."""
    result = gemini.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config={"task_type": "retrieval_document", "output_dimensionality": EMBEDDING_DIM},
    )
    return [e.values for e in result.embeddings]


# =====================================================
# 4) INGEST — the full pipeline, called by /upload
# =====================================================
def ingest_report(file_bytes: bytes, filename: str, patient_id: str, report_type: str = "") -> dict:
    text = extract_text(file_bytes, filename)
    if not text:
        raise ValueError("No text could be extracted from the file.")

    chunks = split_text(text)
    vectors = embed_texts(chunks)

    report = reports_col.insert_one({
        "patient_id": patient_id,
        "filename": filename,
        "file_type": filename.rsplit(".", 1)[-1].lower() if "." in filename else "",
        "report_type": report_type,
        "status": "READY",
        "uploaded_at": datetime.now(timezone.utc),
        "num_chunks": len(chunks),
    })
    report_id = str(report.inserted_id)

    chunks_col.insert_many([
        {
            "report_id": report_id,
            "patient_id": patient_id,   # <- patient scoping lives on every chunk
            "chunk_index": i,
            "text": chunk,
            "embedding": vector,
        }
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ])

    return {"report_id": report_id, "filename": filename, "chunks": len(chunks)}
