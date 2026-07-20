"""
LLM instances — Groq for everything text (embeddings live in rag-service, not here).
fast_llm  = cheap + quick  -> graders, router, safety gate, rewrites
strong_llm = best quality  -> final answer generation, assistant chat
"""
from langchain_groq import ChatGroq

from config import GROQ_API_KEY, FAST_MODEL, STRONG_MODEL

fast_llm = ChatGroq(model=FAST_MODEL, temperature=0, api_key=GROQ_API_KEY)
strong_llm = ChatGroq(model=STRONG_MODEL, temperature=0, api_key=GROQ_API_KEY)
