"""
rag-service — stateless RAG engine (port 8000).
Endpoints: /upload, /retrieve, /reports, /health. No memory, no chat, no LLM reasoning.
API shapes are camelCase to match the frontend (Reports.tsx).
"""
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bson import ObjectId

from config import DEFAULT_TOP_K
from ingestion import ingest_report, reports_col, chunks_col
from retrieval import retrieve_chunks

app = FastAPI(title="rag-service")

# Browser calls come from the Vite dev server (:5173) — without CORS they fail.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# /upload — PDF or image -> extract -> chunk -> embed -> store
# =====================================================
@app.post("/upload")
async def upload(
    patientId: str = Form(...),
    reportType: str = Form(""),
    file: UploadFile = File(...),
):
    try:
        file_bytes = await file.read()
        return ingest_report(file_bytes, file.filename, patientId, reportType)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================
# /retrieve — the endpoint the agent's retrieve node calls
# =====================================================
class RetrieveRequest(BaseModel):
    query: str
    patient_id: str
    report_id: Optional[str] = None   # narrow search to one report
    top_k: int = DEFAULT_TOP_K


@app.post("/retrieve")
def retrieve(req: RetrieveRequest):
    chunks = retrieve_chunks(req.query, req.patient_id, req.top_k, req.report_id)
    return {"chunks": chunks}


# =====================================================
# /reports — list + delete (cascade to chunks)
# =====================================================
@app.get("/reports")
def list_reports(patientId: str):
    reports = list(reports_col.find({"patient_id": patientId}).sort("uploaded_at", -1))
    return {
        "reports": [
            {
                "reportId": str(r["_id"]),
                "fileName": r.get("filename"),
                "fileType": r.get("file_type"),
                "reportType": r.get("report_type"),
                "status": r.get("status", "READY"),
                "uploadedAt": r["uploaded_at"].isoformat() if r.get("uploaded_at") else None,
            }
            for r in reports
        ]
    }


@app.delete("/report/{report_id}")
def delete_report(report_id: str, patientId: str):
    # patient-scoped so nobody can delete another patient's report
    result = reports_col.delete_one({"_id": ObjectId(report_id), "patient_id": patientId})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    deleted_chunks = chunks_col.delete_many({"report_id": report_id, "patient_id": patientId})
    return {"deleted_report": report_id, "deleted_chunks": deleted_chunks.deleted_count}


@app.get("/health")
def health():
    return {"status": "ok", "service": "rag-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
