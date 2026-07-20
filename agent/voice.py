"""
voice.py — speech-to-text via Groq Whisper.
The /voice-chat endpoint transcribes the clip, then runs the SAME chat pipeline as text.
"""
from groq import Groq

from config import GROQ_API_KEY, WHISPER_MODEL

client = Groq(api_key=GROQ_API_KEY)


def transcribe(file_bytes: bytes, filename: str = "clip.webm") -> str:
    """Audio bytes -> transcript text (Groq whisper-large-v3)."""
    result = client.audio.transcriptions.create(
        model=WHISPER_MODEL,
        file=(filename, file_bytes),
        response_format="text",
    )
    # response_format="text" returns a plain string
    return (result if isinstance(result, str) else getattr(result, "text", "")).strip()
