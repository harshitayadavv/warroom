# LOCATION: backend/main.py
# FastAPI application entry point
# Run with: uvicorn main:app --reload --port 8000

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

logging.basicConfig(
    level=logging.INFO if os.getenv("DEBUG") == "true" else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🔥 WarRoom backend starting...")

    # Test Groq connection
    try:
        from services.groq_client import chat
        _, usage = await chat(
            messages=[{"role": "user", "content": "ping"}],
            model="llama-3.1-8b-instant",
            max_tokens=5,
        )
        logger.info(f"✅ Groq connected — {usage['latency_ms']}ms")
    except Exception as e:
        logger.error(f"❌ Groq connection failed: {e}")

    # Test Redis
    try:
        from services.redis_client import get_redis
        r = await get_redis()
        await r.ping()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.warning(f"⚠️  Redis unavailable — using in-memory fallback: {e}")

    yield
    logger.info("WarRoom backend shutting down.")


app = FastAPI(
    title="WarRoom API",
    description="Multi-Agent Strategic Debate Arena",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from routers import debates, ws
app.include_router(debates.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {
        "status":  "online",
        "version": "1.0.0",
        "service": "WarRoom Backend",
    }


@app.get("/")
async def root():
    return {"message": "⚔️  WarRoom API — Multi-Agent Debate Arena"}