"""
supervisor.py — top-level graph: safety_gate -> router -> {report_pipeline | assistant}.
safety_gate runs FIRST so emergencies never depend on the router guessing right.
"""
from typing import List, TypedDict, Literal
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END

from llm import fast_llm
from report_pipeline import report_pipeline
from assistant import assistant, trigger_sos


class SupervisorState(TypedDict, total=False):
    question: str
    patient_id: str
    auth_token: str
    report_id: str           # optional: narrow report Q&A to one report

    # memory ring (injected by main.py)
    history: str
    memory_facts: List[str]

    # outputs
    is_emergency: bool
    route: str               # emergency | report_rag | assistant
    answer: str
    evidence: List[str]      # citations when route == report_rag


# =====================================================
# NODE 0: SAFETY GATE — before everything
# =====================================================
class SafetyCheck(BaseModel):
    is_emergency: bool = Field(
        ...,
        description="True ONLY for life-threatening situations happening NOW: "
                    "chest pain, can't breathe, stroke signs, severe bleeding, "
                    "loss of consciousness, suicidal intent.")


safety_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are an emergency detector for a health chatbot.\n"
     "is_emergency=true ONLY if the message describes a life-threatening situation "
     "happening RIGHT NOW to the user (chest pain, can't breathe, stroke symptoms, "
     "severe bleeding, fainting, suicidal intent).\n"
     "Questions ABOUT emergencies, past events, or general info are NOT emergencies.\n"
     "If unsure, choose false — the assistant can still triage normally."),
    ("human", "{question}"),
])

safety_chain = safety_prompt | fast_llm.with_structured_output(SafetyCheck)


def safety_gate(state: SupervisorState):
    try:
        out = safety_chain.invoke({"question": state["question"]})
        return {"is_emergency": out.is_emergency}
    except Exception:
        return {"is_emergency": False}  # flaky -> normal flow (triage tool still exists)


def route_after_safety(state: SupervisorState) -> Literal["emergency", "router"]:
    return "emergency" if state.get("is_emergency") else "router"


def emergency(state: SupervisorState):
    sos_result = trigger_sos.invoke({"reason": state["question"]})
    return {
        "route": "emergency",
        "answer": "🚨 This sounds like an emergency. I've alerted your emergency contacts. "
                  "Please call your local emergency number NOW. "
                  "Stay where you are, and if possible keep the door unlocked.",
        "evidence": [],
    }


# =====================================================
# NODE 1: ROUTER — report_rag | assistant (sees history)
# =====================================================
class RouteQuery(BaseModel):
    datasource: Literal["report_rag", "assistant"] = Field(
        ...,
        description="report_rag: question about the patient's uploaded medical reports/"
                    "documents/lab results. assistant: everything else.")


router_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "Route the user's message.\n"
     "- report_rag: asking about their UPLOADED medical reports, lab results, "
     "test values, or what a document says. Follow-ups about a report count too — "
     "use the HISTORY to detect that.\n"
     "- assistant: appointments, medications, vitals logging, symptoms, adherence, "
     "greetings, and everything else."),
    ("human", "HISTORY:\n{history}\n\nMessage: {question}"),
])

router_chain = router_prompt | fast_llm.with_structured_output(RouteQuery)


def router(state: SupervisorState):
    if state.get("report_id"):
        # the Reports page scoped this question to a report — no need to guess
        return {"route": "report_rag"}
    try:
        out = router_chain.invoke({
            "question": state["question"],
            "history": state.get("history", "") or "(no prior messages)",
        })
        return {"route": out.datasource}
    except Exception:
        return {"route": "assistant"}  # flaky -> assistant handles anything


def route_after_router(state: SupervisorState) -> Literal["report_rag", "assistant_node"]:
    return "report_rag" if state.get("route") == "report_rag" else "assistant_node"


# =====================================================
# NODE 2a: REPORT BRANCH — delegate to the CRAG+Self-RAG pipeline
# =====================================================
def report_rag(state: SupervisorState):
    result = report_pipeline.invoke({
        "question": state["question"],
        "patient_id": state["patient_id"],
        "auth_token": state.get("auth_token", ""),
        "report_id": state.get("report_id", ""),
        "history": state.get("history", ""),
        "memory_facts": state.get("memory_facts", []),
        "revise_tries": 0,
        "rewrite_tries": 0,
    }, config={"recursion_limit": 40})
    return {"answer": result.get("answer", ""), "evidence": result.get("evidence", [])}


# =====================================================
# NODE 2b: ASSISTANT BRANCH — delegate to the ReAct tool agent
# =====================================================
def assistant_node(state: SupervisorState):
    history = state.get("history", "")
    content = f"(recent conversation)\n{history}\n\n{state['question']}" if history else state["question"]
    result = assistant.invoke({
        "messages": [HumanMessage(content=content)],
        "memory_facts": state.get("memory_facts", []),
    })
    return {"answer": result["messages"][-1].content, "evidence": []}


# =====================================================
# GRAPH WIRING
# =====================================================
g = StateGraph(SupervisorState)

g.add_node("safety_gate", safety_gate)
g.add_node("emergency", emergency)
g.add_node("router", router)
g.add_node("report_rag", report_rag)
g.add_node("assistant_node", assistant_node)

g.add_edge(START, "safety_gate")
g.add_conditional_edges("safety_gate", route_after_safety, {
    "emergency": "emergency",
    "router": "router",
})
g.add_edge("emergency", END)
g.add_conditional_edges("router", route_after_router, {
    "report_rag": "report_rag",
    "assistant_node": "assistant_node",
})
g.add_edge("report_rag", END)
g.add_edge("assistant_node", END)

supervisor = g.compile()
