"""
Medicine Scanner — FastAPI entrypoint (PocketPharma side).

  GET  /health          -> liveness + DB check
  POST /scan            -> upload medicine photo -> identify -> cheaper generics
  POST /generics        -> generics for a known brand name (cached)

Run:  uvicorn main:app --reload --port 8002   (from the medicine-scanner directory)
"""
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from typing import Optional

import config
import vision
from database import test_connection
from generics import find_generics
from schemas import GenericsRequest, GenericsResponse, ScanResponse

app = FastAPI(
    title="Health Companion - Medicine Scanner",
    description="Identify a medicine from a photo and suggest cheaper generic alternatives.",
    version="1.0.0",
)

# CORS: allow the browser frontend (Vite :5173) to call this service directly.
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    print("[Medicine Scanner] starting up...")
    test_connection()


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "database": "connected" if test_connection() else "disconnected",
        "gemini": "configured" if config.GEMINI_API_KEY else "not_configured",
    }


@app.post("/scan", response_model=ScanResponse)
async def scan(
    file: UploadFile = File(...),
    patientId: Optional[str] = Form(None),  # optional, for future scan history
):
    """
    Goals 15-17: upload photo -> identify brand (Gemini Vision) -> cheaper generics + prices.
    """
    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(status_code=400, detail="Only JPG/PNG/WEBP images are accepted.")

    image_bytes = await file.read()

    # 1. Identify the medicine from the image.
    identified = vision.identify_medicine(image_bytes)
    if identified is None:
        raise HTTPException(
            status_code=503,
            detail="Could not identify the medicine (Gemini not configured or request failed).",
        )
    if not identified.get("brandName") and not identified.get("genericName"):
        # Gemini responded but couldn't read the box.
        return ScanResponse(
            identified=identified,
            alternatives=[],
            cached=False,
            disclaimer=config.DISCLAIMER,
        )

    # 2. Find cheaper generics for the identified brand (cached per drug).
    brand = identified.get("brandName") or identified.get("genericName")
    result = find_generics(brand, identified.get("composition"))

    return ScanResponse(
        identified=identified,
        alternatives=result["alternatives"],
        cached=result["cached"],
        disclaimer=config.DISCLAIMER,
    )


@app.post("/generics", response_model=GenericsResponse)
def generics(req: GenericsRequest):
    """Goal 17/42: generics for a brand name you already know (cached)."""
    result = find_generics(req.brandName)
    return GenericsResponse(
        brandName=req.brandName,
        alternatives=result["alternatives"],
        cached=result["cached"],
        disclaimer=config.DISCLAIMER,
    )
