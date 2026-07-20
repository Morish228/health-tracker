"""
persistence.py — the memory ring's storage layer.
Short-term: chatsessions + chatmessages (recent turns per session).
Long-term:  healthfacts (durable facts extracted from conversation).
All best-effort: a Mongo failure never breaks the chat.
"""
from typing import List
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone

from config import MONGO_URI, DB_NAME, HISTORY_LIMIT
from llm import fast_llm

mongo = MongoClient(MONGO_URI)
db = mongo[DB_NAME]
sessions_col = db["chatsessions"]
messages_col = db["chatmessages"]
facts_col = db["healthfacts"]


# =====================================================
# SESSIONS + SHORT-TERM HISTORY
# =====================================================
def ensure_session(session_id: str | None, patient_id: str, first_question: str = "") -> str:
    if session_id:
        return session_id
    now = datetime.now(timezone.utc)
    doc = sessions_col.insert_one({
        "patient_id": patient_id,
        "title": (first_question or "Conversation")[:60],  # shown in the history rail
        "created_at": now,
        "updated_at": now,
    })
    return str(doc.inserted_id)


def get_recent_history(session_id: str) -> str:
    """Last N messages of this session, formatted for prompts. Empty string if none."""
    try:
        msgs = list(
            messages_col.find({"session_id": session_id})
            .sort("created_at", -1)
            .limit(HISTORY_LIMIT)
        )[::-1]  # back to chronological order
        return "\n".join(f"{m['role']}: {m['content']}" for m in msgs)
    except Exception:
        return ""


def save_turn(session_id: str, patient_id: str, question: str, answer: str):
    try:
        now = datetime.now(timezone.utc)
        messages_col.insert_many([
            {"session_id": session_id, "patient_id": patient_id,
             "role": "user", "content": question, "created_at": now},
            {"session_id": session_id, "patient_id": patient_id,
             "role": "assistant", "content": answer, "created_at": now},
        ])
        sessions_col.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"updated_at": now}},
        )
    except Exception:
        pass  # best-effort


def list_sessions(patient_id: str) -> list[dict]:
    sessions = sessions_col.find({"patient_id": patient_id}).sort("updated_at", -1)
    return [
        {
            "sessionId": str(s["_id"]),
            "title": s.get("title", "Conversation"),
            "updatedAt": s["updated_at"].isoformat() if s.get("updated_at") else None,
        }
        for s in sessions
    ]


def get_session_messages(session_id: str) -> list[dict]:
    msgs = messages_col.find({"session_id": session_id}).sort("created_at", 1)
    return [
        {
            "role": m["role"],
            "content": m["content"],
            "createdAt": m["created_at"].isoformat() if m.get("created_at") else None,
        }
        for m in msgs
    ]



# =====================================================
# LONG-TERM: HEALTH FACTS (extract + recall)
# =====================================================
class ExtractedFacts(BaseModel):
    facts: List[str] = Field(
        default_factory=list,
        description="Durable health facts worth remembering across sessions "
                    "(allergies, chronic conditions, preferences). Empty if none.")


extract_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "Extract DURABLE health facts about the patient from this exchange — things "
     "worth remembering in future conversations:\n"
     "- allergies, chronic conditions, ongoing treatments\n"
     "- strong preferences ('prefers morning appointments', 'vegetarian')\n"
     "- key personal context ('lives alone', 'caregiver is her son')\n"
     "Do NOT extract: one-off values already stored elsewhere (vitals, appointments), "
     "questions, or anything transient. Return an empty list if nothing qualifies."),
    ("human", "user: {question}\nassistant: {answer}"),
])

extract_chain = extract_prompt | fast_llm.with_structured_output(ExtractedFacts)


def get_health_facts(patient_id: str) -> list[str]:
    try:
        return [f["fact"] for f in facts_col.find({"patient_id": patient_id}).limit(30)]
    except Exception:
        return []


def extract_and_save_facts(patient_id: str, question: str, answer: str):
    try:
        out = extract_chain.invoke({"question": question, "answer": answer})
        existing = set(get_health_facts(patient_id))
        now = datetime.now(timezone.utc)
        new_facts = [f for f in out.facts if f and f not in existing]
        if new_facts:
            facts_col.insert_many([
                {"patient_id": patient_id, "fact": f, "created_at": now}
                for f in new_facts
            ])
    except Exception:
        pass  # best-effort
