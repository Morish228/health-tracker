# Medicine Scanner Service (PocketPharma)

Standalone FastAPI microservice: identify a medicine from a **photo** and suggest
**cheaper generic alternatives** with approximate prices. Kept separate from the
backend/rag-service so concerns don't mix — it only shares the MongoDB instance
(its own `medicinecache` collection).

## Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | liveness + DB + Gemini status |
| POST | `/scan` | upload photo → identify brand → cheaper generics (goals 15-17) |
| POST | `/generics` | generics for a known brand name (goal 17, cached) |

## How it works
1. **Identify** (`vision.py`) — Gemini Vision reads the box → `{brandName, genericName, composition, estimatedBrandPrice}`.
2. **Generics** (`generics.py`) — asks Gemini for cheaper same-ingredient alternatives, **cached by normalized brand name** in `medicinecache` so the same drug never calls Gemini twice (goal 42).
3. Every response carries a disclaimer — identification + prices are AI estimates, not clinical/retail truth (accepted limitation #8).

## Setup & run
```bash
cd medicine-scanner
python -m venv venv
venv\Scripts\activate            # Windows (source venv/bin/activate on mac/linux)
pip install -r requirements.txt
copy .env.example .env           # add GEMINI_API_KEY (or rely on ../backend/.env)
uvicorn main:app --reload --port 8002
```

## Try it
```bash
# Scan a photo
curl -X POST http://localhost:8002/scan -F "file=@/path/to/medicine.jpg"

# Generics for a known brand
curl -X POST http://localhost:8002/generics -H "Content-Type: application/json" \
  -d "{\"brandName\": \"Crocin\"}"
```

## Ports across the project
- backend (Node): 5000
- rag-service: 8000
- agent-service: 8001
- **medicine-scanner: 8002**

## Graceful degradation
Without `GEMINI_API_KEY`, `/scan` returns 503 (can't identify) and `/generics`
returns an empty list — the service still runs and won't crash.
