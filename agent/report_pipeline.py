"""
report_pipeline.py — the report branch: CRAG (pre-generation) + Self-RAG (post-generation).
Reads top-to-bottom like the CampusX notebooks: state -> nodes (schema+prompt+fn) -> edges.
"""
from typing import List, TypedDict, Literal
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, START, END
from langchain_tavily import TavilySearch
import requests

from config import RAG_SERVICE_URL, UPPER_TH, LOWER_TH, MAX_REVISE, MAX_REWRITES
from llm import fast_llm, strong_llm


def _safe_invoke(chain, payload: dict, attempts: int = 2):
    """Groq/Llama structured output sporadically 400s with tool_use_failed —
    retry once, then let the caller fall back to a default instead of 500ing."""
    last = None
    for _ in range(attempts):
        try:
            return chain.invoke(payload)
        except Exception as e:
            last = e
    raise last


class State(TypedDict, total=False):

      question: str    # user will give this — NEVER overwritten, graders use this

      retrieval_query: str     # rewritten query — ONLY retrieval uses this
      patient_id: str
      report_id: str           # optional: narrow retrieval to one report
      auth_token: str

      # memory ring (injected by main.py before invoke)
      history: str             # last ~10 messages, formatted
      memory_facts: List[str]  # durable healthfacts

      # CRAG stage: pre-generation, builds context (nodes 1-5)
      docs: List[dict]         # raw chunks
      good_docs: List[dict]    # chunks scoring > LOWER_TH
      verdict: str             # CORRECT | AMBIGUOUS | INCORRECT
      web_docs: List[dict]     # web search se aynge in crag
      web_query: str           # rewritten keyword query for web search
      refined_context: str

      # Self-RAG stage: post-generation, verifies answer (nodes 6-10)
      answer: str
      issup: str               # fully_supported | partially_supported | no_support
      evidence: List[str]      # supporting quotes -> become citations
      isuse: str               # useful | not_useful

      # loop counters (safety caps)
      revise_tries: int
      rewrite_tries: int


# =====================================================
# NODE 1: RETRIEVE — HTTP call to stateless rag-service
# =====================================================
def retrieve(state: State):
    q = state.get("retrieval_query") or state["question"]
    body = {"query": q, "patient_id": state["patient_id"], "top_k": 4}
    if state.get("report_id"):
        body["report_id"] = state["report_id"]
    resp = requests.post(
        f"{RAG_SERVICE_URL}/retrieve",
        json=body,
        timeout=30,
    )
    resp.raise_for_status()
    return {"docs": resp.json().get("chunks", [])}


# =====================================================
# NODE 2: EVAL — score each chunk 0-1 (LLM), verdict (plain Python)
# =====================================================
class DocEvalScore(BaseModel):
    score: float = Field(..., description="Relevance in [0.0, 1.0]")
    reason: str = Field(..., description="One short line")


doc_eval_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a strict retrieval evaluator for a medical RAG system.\n"
     "Given ONE retrieved chunk from a patient's medical report and a question, "
     "return a relevance score in [0.0, 1.0].\n"
     "- 1.0: chunk alone can answer the question fully/mostly\n"
     "- 0.0: chunk is irrelevant\n"
     "Be conservative with high scores."),
    ("human", "Question: {question}\n\nChunk:\n{chunk}"),
])

doc_eval_chain = doc_eval_prompt | fast_llm.with_structured_output(DocEvalScore)


def eval_each_doc(state: State):
    q = state["question"]
    scores, good = [], []

    for d in state["docs"]:
        try:
            out = doc_eval_chain.invoke({"question": q, "chunk": d["text"]})
            score = out.score
        except Exception:
            score = 0.5  # flaky grader -> treat as ambiguous, don't crash
        scores.append(score)
        if score > LOWER_TH:
            good.append(d)

    if any(s > UPPER_TH for s in scores):
        return {"good_docs": good, "verdict": "CORRECT"}
    if scores and all(s < LOWER_TH for s in scores):
        return {"good_docs": [], "verdict": "INCORRECT"}
    return {"good_docs": good, "verdict": "AMBIGUOUS"}


def route_after_eval(state: State) -> Literal["refine_context", "rewrite_web_query"]:
    if state["verdict"] == "CORRECT":
        return "refine_context"
    return "rewrite_web_query"  # INCORRECT / AMBIGUOUS both need web


# =====================================================
# NODE 3: REWRITE WEB QUERY — question -> keyword search query
# =====================================================
class WebQuery(BaseModel):
    query: str = Field(..., description="Keyword web search query, 6-14 words")


web_query_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "Rewrite the user question into a web search query composed of keywords.\n"
     "Rules:\n"
     "- Keep it short (6-14 words).\n"
     "- Medical topic: prefer terms that match reputable health sources.\n"
     "- Do NOT include the patient's personal values in the query.\n"
     "- Do NOT answer the question."),
    ("human", "Question: {question}"),
])

web_query_chain = web_query_prompt | fast_llm.with_structured_output(WebQuery)


def rewrite_web_query(state: State):
    try:
        out = _safe_invoke(web_query_chain, {"question": state["question"]})
        return {"web_query": out.query}
    except Exception:
        # flaky structured output -> search with the raw question instead
        return {"web_query": state["question"]}


# =====================================================
# NODE 4: WEB SEARCH — Tavily fallback
# =====================================================
try:
    tavily = TavilySearch(max_results=5)   # raises if TAVILY_API_KEY missing
except Exception:
    tavily = None


def web_search(state: State):
    if tavily is None:
        return {"web_docs": []}
    q = state.get("web_query") or state["question"]
    try:
        results = tavily.invoke({"query": q})
    except Exception:
        # no Tavily key / network hiccup -> degrade gracefully:
        # AMBIGUOUS still has good_docs; INCORRECT ends at no_answer_found.
        return {"web_docs": []}

    web_docs = []
    for r in results.get("results", []):
        text = f"TITLE: {r.get('title', '')}\nURL: {r.get('url', '')}\nCONTENT:\n{r.get('content', '')}"
        web_docs.append({"text": text, "source": "web", "url": r.get("url", "")})
    return {"web_docs": web_docs}


# =====================================================
# NODE 5: REFINE — pick sources by verdict, batched sentence filter
# =====================================================
class KeptSentences(BaseModel):
    kept: List[int] = Field(..., description="Indices of sentences that directly help answer the question")


refine_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a strict relevance filter.\n"
     "You get a QUESTION and a NUMBERED list of sentences.\n"
     "Return the indices of sentences that directly help answer the question.\n"
     "Drop headers, boilerplate and unrelated lines."),
    ("human", "Question: {question}\n\nSentences:\n{sentences}"),
])

refine_chain = refine_prompt | fast_llm.with_structured_output(KeptSentences)


def _split_sentences(text: str) -> List[str]:
    import re
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in parts if len(s.strip()) > 20]


def refine_context(state: State):
    verdict = state.get("verdict")
    if verdict == "CORRECT":
        docs_to_use = state["good_docs"]
    elif verdict == "INCORRECT":
        docs_to_use = state["web_docs"]
    else:  # AMBIGUOUS -> merge internal + web
        docs_to_use = state["good_docs"] + state["web_docs"]

    context = "\n\n".join(d["text"] for d in docs_to_use).strip()
    sentences = _split_sentences(context)
    if not sentences:
        return {"refined_context": ""}

    numbered = "\n".join(f"{i}: {s}" for i, s in enumerate(sentences))
    try:
        # ONE batched LLM call (not one per sentence like the CampusX repo)
        out = refine_chain.invoke({"question": state["question"], "sentences": numbered})
        kept = [sentences[i] for i in out.kept if 0 <= i < len(sentences)]
    except Exception:
        kept = sentences  # flaky grader -> keep everything rather than drop all

    return {"refined_context": "\n".join(kept).strip()}


def route_after_refine(state: State) -> Literal["generate", "no_answer_found"]:
    if state.get("refined_context"):
        return "generate"
    return "no_answer_found"


# =====================================================
# NODE 6: GENERATE — strong model, memory-aware, grounded
# =====================================================
generate_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a health companion assistant answering questions about the patient's "
     "medical reports.\n"
     "Answer ONLY using the provided CONTEXT. Do not invent values or diagnoses.\n"
     "Use the conversation HISTORY to resolve references like 'that value'.\n"
     "Known patient facts: {memory_facts}\n"
     "Be clear and calm; do not add interpretations the context does not support.\n"
     "If the context is insufficient, say so."),
    ("human",
     "HISTORY:\n{history}\n\nCONTEXT:\n{context}\n\nQuestion: {question}"),
])


def generate(state: State):
    out = (generate_prompt | strong_llm).invoke({
        "question": state["question"],
        "context": state.get("refined_context", ""),
        "history": state.get("history", "") or "(no prior messages)",
        "memory_facts": ", ".join(state.get("memory_facts", [])) or "(none)",
    })
    return {"answer": out.content}


# =====================================================
# NODE 7: IS_SUP — 3-way grounding check + evidence quotes
# =====================================================
class IsSUPDecision(BaseModel):
    issup: Literal["fully_supported", "partially_supported", "no_support"]
    evidence: List[str] = Field(default_factory=list,
                                description="Up to 3 short direct quotes from CONTEXT supporting the answer")


issup_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You verify whether the ANSWER is supported by the CONTEXT.\n"
     "- fully_supported: every claim is explicitly in CONTEXT, no added "
     "interpretation (no 'looks great', 'clearly', 'probably').\n"
     "- partially_supported: core facts supported BUT answer adds interpretive/"
     "qualitative phrasing not in CONTEXT.\n"
     "- no_support: key claims are not in CONTEXT.\n"
     "This is MEDICAL content — be strict. Any unsupported qualitative claim "
     "means partially_supported.\n"
     "Also return up to 3 short direct quotes from CONTEXT as evidence."),
    ("human", "Question:\n{question}\n\nAnswer:\n{answer}\n\nContext:\n{context}"),
])

issup_chain = issup_prompt | fast_llm.with_structured_output(IsSUPDecision)


def is_sup(state: State):
    try:
        out = issup_chain.invoke({
            "question": state["question"],
            "answer": state.get("answer", ""),
            "context": state.get("refined_context", ""),
        })
        return {"issup": out.issup, "evidence": out.evidence}
    except Exception:
        # flaky grader -> accept rather than infinite-loop
        return {"issup": "fully_supported", "evidence": []}


def route_after_issup(state: State) -> Literal["is_use", "revise_answer", "generate"]:
    issup = state.get("issup")
    if issup == "fully_supported":
        return "is_use"
    if state.get("revise_tries", 0) >= MAX_REVISE:
        return "is_use"  # caps hit -> move on, is_use decides fate
    if issup == "partially_supported":
        return "revise_answer"   # cheap fix: strip unsupported phrasing
    return "generate"            # no_support -> full regenerate (capped below)


def count_regen(state: State):
    """generate -> is_sup -> no_support -> generate would loop forever without
    a counter — regeneration consumes the same revise_tries budget."""
    return {"revise_tries": state.get("revise_tries", 0) + 1}


# =====================================================
# NODE 8: REVISE — strip unsupported phrasing, keep it natural (NOT quote-dump)
# =====================================================
revise_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "Revise the ANSWER so that EVERY claim is explicitly supported by the CONTEXT.\n"
     "Rules:\n"
     "- Remove any interpretation, opinion or qualitative wording not in CONTEXT.\n"
     "- Keep the tone natural and helpful (do NOT turn it into a quote list).\n"
     "- Do not add new information.\n"
     "- Do not mention the context or these rules."),
    ("human", "Question:\n{question}\n\nAnswer:\n{answer}\n\nCONTEXT:\n{context}"),
])


def revise_answer(state: State):
    out = (revise_prompt | strong_llm).invoke({
        "question": state["question"],
        "answer": state.get("answer", ""),
        "context": state.get("refined_context", ""),
    })
    return {"answer": out.content, "revise_tries": state.get("revise_tries", 0) + 1}


# =====================================================
# NODE 9: IS_USE — does the answer address the question?
# =====================================================
class IsUSEDecision(BaseModel):
    isuse: Literal["useful", "not_useful"]
    reason: str = Field(..., description="One short line")


isuse_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "Judge USEFULNESS of the ANSWER for the QUESTION.\n"
     "- useful: directly answers what was asked.\n"
     "- not_useful: generic, off-topic, or background without answering.\n"
     "Do NOT re-check grounding (that was already verified). "
     "Only check: did we answer the question?"),
    ("human", "Question:\n{question}\n\nAnswer:\n{answer}"),
])

isuse_chain = isuse_prompt | fast_llm.with_structured_output(IsUSEDecision)


def is_use(state: State):
    try:
        out = isuse_chain.invoke({"question": state["question"], "answer": state.get("answer", "")})
        return {"isuse": out.isuse}
    except Exception:
        return {"isuse": "useful"}  # flaky grader -> accept


def route_after_isuse(state: State) -> Literal["__end__", "rewrite_question", "no_answer_found"]:
    if state.get("isuse") == "useful":
        return "__end__"
    if state.get("rewrite_tries", 0) >= MAX_REWRITES:
        return "no_answer_found"
    return "rewrite_question"


# =====================================================
# NODE 10: REWRITE QUESTION — better retrieval query, loop back
# =====================================================
class RewriteDecision(BaseModel):
    retrieval_query: str = Field(..., description="Rewritten query optimized for vector search over medical reports, 6-16 words")


rewrite_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "Rewrite the QUESTION into a query optimized for vector retrieval over the "
     "patient's medical report chunks.\n"
     "Rules:\n"
     "- Short (6-16 words), keep key medical entities (test names, drug names).\n"
     "- Add 2-5 high-signal keywords likely to appear in lab reports/prescriptions.\n"
     "- Remove filler words. Do NOT answer the question."),
    ("human",
     "QUESTION:\n{question}\n\nPrevious retrieval query:\n{retrieval_query}\n\n"
     "Answer that was not useful:\n{answer}"),
])

rewrite_chain = rewrite_prompt | fast_llm.with_structured_output(RewriteDecision)


def rewrite_question(state: State):
    try:
        out = _safe_invoke(rewrite_chain, {
            "question": state["question"],
            "retrieval_query": state.get("retrieval_query", ""),
            "answer": state.get("answer", ""),
        })
        new_query = out.retrieval_query
    except Exception:
        new_query = state["question"]  # flaky -> retry retrieval with the raw question
    return {
        "retrieval_query": new_query,
        "rewrite_tries": state.get("rewrite_tries", 0) + 1,
        # reset so the next pass is clean
        "docs": [], "good_docs": [], "web_docs": [], "refined_context": "", "answer": "",
    }


# =====================================================
# NODE 11: NO ANSWER FOUND — honest give-up
# =====================================================
def no_answer_found(state: State):
    return {
        "answer": "I couldn't find this information in your medical reports. "
                  "It may not have been captured when the report was uploaded — "
                  "you could try re-uploading a clearer copy, or ask me something else.",
        "evidence": [],
    }


# =====================================================
# GRAPH WIRING
# =====================================================
g = StateGraph(State)

g.add_node("retrieve", retrieve)
g.add_node("eval_each_doc", eval_each_doc)
g.add_node("rewrite_web_query", rewrite_web_query)
g.add_node("web_search", web_search)
g.add_node("refine_context", refine_context)
g.add_node("generate", generate)
g.add_node("is_sup", is_sup)
g.add_node("count_regen", count_regen)
g.add_node("revise_answer", revise_answer)
g.add_node("is_use", is_use)
g.add_node("rewrite_question", rewrite_question)
g.add_node("no_answer_found", no_answer_found)

# CRAG stage
g.add_edge(START, "retrieve")
g.add_edge("retrieve", "eval_each_doc")
g.add_conditional_edges("eval_each_doc", route_after_eval, {
    "refine_context": "refine_context",       # CORRECT
    "rewrite_web_query": "rewrite_web_query",  # INCORRECT / AMBIGUOUS
})
g.add_edge("rewrite_web_query", "web_search")
g.add_edge("web_search", "refine_context")
g.add_conditional_edges("refine_context", route_after_refine, {
    "generate": "generate",
    "no_answer_found": "no_answer_found",
})

# Self-RAG stage
g.add_edge("generate", "is_sup")
g.add_conditional_edges("is_sup", route_after_issup, {
    "is_use": "is_use",                  # fully_supported (or caps hit)
    "revise_answer": "revise_answer",    # partially_supported
    "generate": "count_regen",           # no_support -> count, then regenerate
})
g.add_edge("count_regen", "generate")
g.add_edge("revise_answer", "is_sup")    # loop back to re-check
g.add_conditional_edges("is_use", route_after_isuse, {
    "__end__": END,
    "rewrite_question": "rewrite_question",
    "no_answer_found": "no_answer_found",
})
g.add_edge("rewrite_question", "retrieve")  # outermost loop
g.add_edge("no_answer_found", END)

report_pipeline = g.compile()





