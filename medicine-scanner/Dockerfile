# Medicine scanner (FastAPI + Gemini Vision) — port 8002
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8002
# main.py has no uvicorn.run — the CLI command here is the only runner.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
