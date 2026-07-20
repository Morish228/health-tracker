"""
assistant.py — the ReAct tool-agent branch (everything that is NOT report questions).
13 tools calling the Express backend (:5000/api). Pattern = CampusX langgraph_tool_backend:
chat_node <-> ToolNode via tools_condition, until the LLM stops calling tools.

Auth: the patient's JWT is stored in a contextvar per request (set by main.py),
so tools can call the backend AS the logged-in patient.
"""
from typing import TypedDict, Annotated, List
from contextvars import ContextVar
from datetime import datetime
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
import requests

from config import BACKEND_URL
from llm import strong_llm, fast_llm

# --- request context (set by main.py before every invoke) ---
_auth_token: ContextVar[str] = ContextVar("auth_token", default="")


def set_auth_token(token: str):
    _auth_token.set(token)


def _headers() -> dict:
    return {"Authorization": f"Bearer {_auth_token.get()}"}


def _get(path: str, params: dict | None = None) -> dict:
    r = requests.get(f"{BACKEND_URL}{path}", headers=_headers(), params=params, timeout=15)
    return r.json() if r.ok else {"error": r.status_code, "detail": r.text[:300]}


def _post(path: str, body: dict) -> dict:
    r = requests.post(f"{BACKEND_URL}{path}", headers=_headers(), json=body, timeout=15)
    return r.json() if r.ok else {"error": r.status_code, "detail": r.text[:300]}


def _patch(path: str, body: dict | None = None) -> dict:
    r = requests.patch(f"{BACKEND_URL}{path}", headers=_headers(), json=body or {}, timeout=15)
    return r.json() if r.ok else {"error": r.status_code, "detail": r.text[:300]}


# =====================================================
# SAFETY TOOLS (2)
# =====================================================
@tool
def triage_symptoms(symptoms: str) -> dict:
    """Classify symptom severity as emergency / urgent / routine with a short reason.
    Use whenever the user describes symptoms."""
    out = fast_llm.invoke(
        "You are a medical triage classifier. Classify these symptoms as exactly one of: "
        "emergency (life-threatening, needs immediate help), urgent (see doctor within 24h), "
        "routine (can wait for a normal appointment). Reply as: <level>: <one line reason>.\n"
        f"Symptoms: {symptoms}"
    )
    return {"triage": out.content}


@tool
def trigger_sos(reason: str) -> dict:
    """Fire an SOS emergency alert to the patient's caregivers/emergency contacts.
    Use ONLY for emergencies (chest pain, breathing trouble, loss of consciousness...)."""
    # backend emergency.controller reads {message, severity, source}
    return _post("/emergency/sos", {"message": reason, "severity": "CRITICAL", "source": "AGENT"})


# =====================================================
# APPOINTMENT TOOLS (5)
# =====================================================
@tool
def search_doctors(specialization: str = "", name: str = "") -> dict:
    """Search doctors, optionally by specialization (e.g. 'Cardiologist') or name."""
    params = {}
    if specialization:
        params["specialization"] = specialization
    if name:
        params["name"] = name
    return _get("/doctors", params)


@tool
def find_doctors_with_slots(date: str, specialization: str = "") -> dict:
    """Find which doctors ACTUALLY have available appointment slots on a date (YYYY-MM-DD).
    ALWAYS use this to answer 'which doctor is available on X?' — never guess
    availability from search_doctors, which only lists doctors."""
    params = {"specialization": specialization} if specialization else None
    docs = _get("/doctors", params)
    available = []
    for d in docs.get("data", [])[:15]:
        slots = _get(f"/doctors/{d['_id']}/slots", {"date": date}).get("data", [])
        if slots:
            available.append({
                "doctorId": d["_id"],
                "name": d.get("name"),
                "specialization": d.get("specialization"),
                "slots": [{"slotId": s["_id"], "startTime": s.get("startTime"),
                           "endTime": s.get("endTime")} for s in slots[:6]],
            })
    return {"date": date, "doctorsWithSlots": available,
            "note": "empty list means NO doctor has slots that day"}


@tool
def get_available_slots(doctor_id: str, date: str) -> dict:
    """Get available appointment slots for a doctor on a date (YYYY-MM-DD). Both required."""
    return _get(f"/doctors/{doctor_id}/slots", {"date": date})


@tool
def book_appointment(slot_id: str, symptoms: str = "") -> dict:
    """Book an appointment by slot id (get it from get_available_slots first).
    Optionally pass the patient's symptoms/reason."""
    return _post("/appointments", {"slotId": slot_id, "symptoms": symptoms})


@tool
def get_my_appointments() -> dict:
    """List the patient's appointments (upcoming and past)."""
    return _get("/appointments")


@tool
def cancel_appointment(appointment_id: str) -> dict:
    """Cancel an appointment by its id. Confirm with the user before calling this."""
    return _patch(f"/appointments/{appointment_id}/cancel")


# =====================================================
# MEDICATION TOOLS (3)
# =====================================================
@tool
def get_my_medications() -> dict:
    """List the patient's active prescriptions and medication schedule."""
    return _get("/prescriptions")


@tool
def check_drug_interactions(medications: List[str]) -> dict:
    """Check for dangerous interactions between medications (list of drug names)."""
    return _post("/prescriptions/check-interactions", {"medications": medications})


@tool
def get_adherence_summary() -> dict:
    """Get medication adherence: today's doses, missed doses and current streak."""
    return {
        "today": _get("/adherence/today"),
        "missed": _get("/adherence/missed"),
        "streak": _get("/adherence/streak"),
    }


# =====================================================
# VITALS TOOLS (2)
# =====================================================
# backend Vital.type is an UPPERCASE enum — normalize friendly names to it
VITAL_TYPES = {
    "heart rate": "HEART_RATE", "heart_rate": "HEART_RATE", "pulse": "HEART_RATE", "hr": "HEART_RATE",
    "blood sugar": "BLOOD_SUGAR", "blood_sugar": "BLOOD_SUGAR", "glucose": "BLOOD_SUGAR", "sugar": "BLOOD_SUGAR",
    "spo2": "SPO2", "oxygen": "SPO2", "oxygen saturation": "SPO2",
    "weight": "WEIGHT",
    "temperature": "TEMPERATURE", "temp": "TEMPERATURE", "fever": "TEMPERATURE",
    "bp systolic": "BLOOD_PRESSURE_SYSTOLIC", "systolic": "BLOOD_PRESSURE_SYSTOLIC",
    "bp diastolic": "BLOOD_PRESSURE_DIASTOLIC", "diastolic": "BLOOD_PRESSURE_DIASTOLIC",
    "bp": "BLOOD_PRESSURE_SYSTOLIC", "blood pressure": "BLOOD_PRESSURE_SYSTOLIC",
    "respiratory rate": "RESPIRATORY_RATE", "breathing rate": "RESPIRATORY_RATE",
}


def _vital_type(vital_type: str) -> str:
    key = vital_type.strip().lower().replace("-", " ")
    return VITAL_TYPES.get(key, vital_type.strip().upper().replace(" ", "_"))


@tool
def get_vitals_history(vital_type: str = "") -> dict:
    """Get the patient's vitals history (heart rate, blood sugar, spo2, weight,
    temperature, blood pressure...). vital_type optional, e.g. 'glucose', 'bp'."""
    params = {}
    if vital_type:
        params["type"] = _vital_type(vital_type)
    return _get("/vitals/history", params)


@tool
def log_vital(vital_type: str, value: str, unit: str = "") -> dict:
    """Log a new vital reading for the patient, e.g. vital_type='glucose', value='140', unit='mg/dL'."""
    return _post("/vitals", {"type": _vital_type(vital_type), "value": value, "unit": unit})


TOOLS = [
    triage_symptoms, trigger_sos,
    search_doctors, find_doctors_with_slots, get_available_slots, book_appointment, get_my_appointments, cancel_appointment,
    get_my_medications, check_drug_interactions, get_adherence_summary,
    get_vitals_history, log_vital,
]
# search_medical_reports is NOT here — report questions go to the report_pipeline branch.

llm_with_tools = strong_llm.bind_tools(TOOLS)


# =====================================================
# STATE + GRAPH (CampusX pattern: chat_node <-> ToolNode)
# =====================================================
class AssistantState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    memory_facts: List[str]


SYSTEM_PROMPT = (
    "You are a warm, careful health companion assistant for a patient.\n"
    "Today's date is {today}.\n"
    "You can: triage symptoms, trigger SOS for emergencies, search doctors, check slots, "
    "book/cancel appointments, list medications, check drug interactions, show adherence, "
    "and read/log vitals.\n"
    "Known patient facts: {facts}\n"
    "Rules:\n"
    "- Only call tools when the request needs them; reply directly to greetings and general questions.\n"
    "- NEVER claim a doctor 'has available slots' unless a tool result in THIS conversation "
    "shows those slots. search_doctors only lists doctors — it says NOTHING about availability. "
    "For 'who is available on X?' use find_doctors_with_slots(date).\n"
    "- If a tool returns an empty list, say so honestly — do not invent results.\n"
    "- If symptoms sound life-threatening, call trigger_sos immediately.\n"
    "- get_available_slots needs a date (YYYY-MM-DD) — compute it from today's date "
    "('tomorrow', 'next Monday'...) and ask the user if no day was given.\n"
    "- Confirm with the user before booking or cancelling anything.\n"
    "- You are not a doctor: for medical decisions, recommend consulting one.\n"
    "- Be concise and kind."
)


def chat_node(state: AssistantState):
    facts = ", ".join(state.get("memory_facts", [])) or "(none)"
    today = datetime.now().strftime("%A, %Y-%m-%d")
    messages = [SystemMessage(content=SYSTEM_PROMPT.format(facts=facts, today=today)), *state["messages"]] # * unpack things

    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


g = StateGraph(AssistantState)
g.add_node("chat_node", chat_node)
g.add_node("tools", ToolNode(TOOLS))

g.add_edge(START, "chat_node")
g.add_conditional_edges("chat_node", tools_condition)  # tool call -> "tools", else END
g.add_edge("tools", "chat_node")

assistant = g.compile()
