"""
agent-service — the chatbot brain (port 8001).
/chat = memory ring (load) -> supervisor graph -> memory ring (persist).
/voice-chat = Groq Whisper transcribe -> same pipeline.
API shapes are camelCase to match the frontend (Assistant.tsx / Reports.tsx).
"""
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from supervisor import supervisor
from assistant import set_auth_token
from voice import transcribe
from persistence import (
    ensure_session, get_recent_history, save_turn,
    get_health_facts, extract_and_save_facts,
    list_sessions, get_session_messages,
)

app = FastAPI(title="agent-service")

# Browser calls come from the Vite dev server (:5173) — without CORS they fail.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str
    patientId: str
    authToken: Optional[str] = None
    sessionId: Optional[str] = None
    reportId: Optional[str] = None   # Reports page scope selector


class ChatResponse(BaseModel):
    answer: str
    route: str
    sessionId: str
    citations: List[str] = []


def _run_chat(question: str, patient_id: str, auth_token: str,
              session_id: Optional[str], report_id: Optional[str]) -> ChatResponse:
    """Shared by /chat and /voice-chat: memory ring around one supervisor invoke."""
    # ---- tools call the backend AS this patient ----
    set_auth_token(auth_token or "")

    # ---- MEMORY RING: load ----
    session_id = ensure_session(session_id, patient_id, first_question=question)
    history = get_recent_history(session_id)
    memory_facts = get_health_facts(patient_id)

    # ---- the graph ----
    result = supervisor.invoke({
        "question": question,
        "patient_id": patient_id,
        "auth_token": auth_token or "",
        "report_id": report_id or "",
        "history": history,
        "memory_facts": memory_facts,
    })
    answer = result.get("answer", "Sorry, something went wrong.")

    # ---- MEMORY RING: persist (best-effort) ----
    save_turn(session_id, patient_id, question, answer)
    extract_and_save_facts(patient_id, question, answer)

    return ChatResponse(
        answer=answer,
        route=result.get("route", ""),
        sessionId=session_id,
        citations=result.get("evidence", []) or [],
    )


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    return _run_chat(req.question, req.patientId, req.authToken, req.sessionId, req.reportId)


@app.post("/voice-chat")
def voice_chat(
    file: UploadFile = File(...),
    patientId: str = Form(...),
    sessionId: Optional[str] = Form(None),
    authToken: Optional[str] = Form(None),
):
    audio = file.file.read()
    transcript = transcribe(audio, file.filename or "clip.webm")
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not transcribe the audio clip.")
    resp = _run_chat(transcript, patientId, authToken, sessionId, None)
    return {**resp.model_dump(), "transcript": transcript}


@app.get("/sessions")
def sessions(patientId: str):
    return {"sessions": list_sessions(patientId)}


@app.get("/sessions/{session_id}")
def session_messages(session_id: str):
    return {"messages": get_session_messages(session_id)}


@app.get("/health")
def health():
    return {"status": "ok", "service": "agent-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
