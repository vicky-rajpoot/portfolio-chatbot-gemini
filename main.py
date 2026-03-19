"""
Gemini RAG Chatbot — FastAPI Backend
-------------------------------------
- Embeds all docs in /docs folder once at startup (in memory)
- Exposes POST /api/chat  →  { message, history } → { reply }
- Serves the widget JS at GET /widget.js
- CORS-ready so your frontend page can call from any origin

Run:
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
import math
import json
import httpx
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Config  (edit these or put them in .env)
# ──────────────────────────────────────────────
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
EMBED_MODEL      = "gemini-embedding-2-preview"
CHAT_MODEL       = "gemini-2.5-flash-lite"
DOCS_FOLDER      = Path("docs")           # put your PDFs / .txt / .md here
CHUNK_SIZE       = 500                    # words per chunk
CHUNK_OVERLAP    = 80                     # word overlap between chunks
TOP_K            = 5                      # how many chunks to send to Gemini
MAX_HISTORY      = 10                     # max conversation turns kept
TEMPERATURE      = 0.3

# Your custom system prompt — tell the bot who it is and what it knows
SYSTEM_PROMPT = """You are a helpful assistant for this website.
Answer questions accurately and concisely using the document context provided.
If the answer is not in the context, say so politely — do not make things up.
Be friendly, professional, and to the point.
Format responses with markdown where it helps readability."""

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

# ──────────────────────────────────────────────
# In-memory knowledge base
# ──────────────────────────────────────────────
knowledge_base: list[dict] = []   # [{text, embedding, source}]


# ──────────────────────────────────────────────
# Text helpers
# ──────────────────────────────────────────────
def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        if len(chunk.strip()) > 60:
            chunks.append(chunk)
        i += size - overlap
    return chunks


def extract_text_from_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            log.warning("pypdf not installed — skipping %s. Run: pip install pypdf", path.name)
            return ""
    elif suffix in (".txt", ".md", ".markdown"):
        return path.read_text(encoding="utf-8", errors="ignore")
    else:
        log.warning("Unsupported file type: %s", path.name)
        return ""


# ──────────────────────────────────────────────
# Gemini API calls
# ──────────────────────────────────────────────
async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed a list of strings using Gemini Embedding 2."""
    embeddings = []
    async with httpx.AsyncClient(timeout=30) as client:
        for text in texts:
            url = f"{GEMINI_BASE}/models/{EMBED_MODEL}:embedContent?key={GEMINI_API_KEY}"
            body = {
                "model": f"models/{EMBED_MODEL}",
                "content": {"parts": [{"text": text}]},
                "taskType": "RETRIEVAL_DOCUMENT",
            }
            res = await client.post(url, json=body)
            res.raise_for_status()
            embeddings.append(res.json()["embedding"]["values"])
    return embeddings


async def embed_query(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=15) as client:
        url = f"{GEMINI_BASE}/models/{EMBED_MODEL}:embedContent?key={GEMINI_API_KEY}"
        body = {
            "model": f"models/{EMBED_MODEL}",
            "content": {"parts": [{"text": text}]},
            "taskType": "RETRIEVAL_QUERY",
        }
        res = await client.post(url, json=body)
        res.raise_for_status()
        return res.json()["embedding"]["values"]


async def chat_with_gemini(system: str, messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        url = f"{GEMINI_BASE}/models/{CHAT_MODEL}:generateContent?key={GEMINI_API_KEY}"
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": messages,
            "generationConfig": {
                "temperature": TEMPERATURE,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 1024,
            },
        }
        res = await client.post(url, json=body)
        res.raise_for_status()
        data = res.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


# ──────────────────────────────────────────────
# Vector search
# ──────────────────────────────────────────────
def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    return dot / (mag_a * mag_b + 1e-10)


def retrieve(query_embedding: list[float], k: int = TOP_K) -> list[dict]:
    scored = [
        {**item, "score": cosine_similarity(query_embedding, item["embedding"])}
        for item in knowledge_base
    ]
    return sorted(scored, key=lambda x: x["score"], reverse=True)[:k]


# ──────────────────────────────────────────────
# Startup — load & embed all docs
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    if not GEMINI_API_KEY:
        log.error("GEMINI_API_KEY is not set. Set it in .env or environment.")
    else:
        await load_knowledge_base()
    yield


async def load_knowledge_base():
    global knowledge_base
    knowledge_base = []
    DOCS_FOLDER.mkdir(exist_ok=True)
    files = list(DOCS_FOLDER.iterdir())
    if not files:
        log.warning("No files found in /docs — chatbot will rely on system prompt only.")
        return

    all_chunks, all_sources = [], []
    for path in files:
        if path.is_file():
            text = extract_text_from_file(path)
            if not text.strip():
                continue
            chunks = chunk_text(text)
            log.info("  %s → %d chunks", path.name, len(chunks))
            all_chunks.extend(chunks)
            all_sources.extend([path.name] * len(chunks))

    if not all_chunks:
        log.warning("No text extracted from any file.")
        return

    log.info("Embedding %d chunks with Gemini Embedding 2...", len(all_chunks))
    embeddings = await embed_texts(all_chunks)
    knowledge_base = [
        {"text": chunk, "embedding": emb, "source": src}
        for chunk, emb, src in zip(all_chunks, embeddings, all_sources)
    ]
    log.info("Knowledge base ready: %d chunks from %d files.", len(knowledge_base), len(files))


# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────
app = FastAPI(title="Gemini RAG Chatbot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # restrict to your domain in production, e.g. ["https://yoursite.com"]
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Request / Response models
# ──────────────────────────────────────────────
class Turn(BaseModel):
    role: str    # "user" or "model"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Turn] = []

class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = []


# ──────────────────────────────────────────────
# Chat endpoint
# ──────────────────────────────────────────────
@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(503, "API key not configured on server.")

    message = req.message.strip()
    if not message:
        raise HTTPException(400, "Empty message.")

    # Retrieve relevant chunks
    sources = []
    context_block = ""
    if knowledge_base:
        q_emb = await embed_query(message)
        top_chunks = retrieve(q_emb)
        sources = list({c["source"] for c in top_chunks})
        context_block = "\n\n---\n\n".join(
            f"[{c['source']}]\n{c['text']}" for c in top_chunks
        )

    # Build system prompt with context injected
    system = SYSTEM_PROMPT
    if context_block:
        system += f"\n\n=== RELEVANT DOCUMENT CONTEXT ===\n{context_block}\n================================="

    # Build conversation history for Gemini (trim to MAX_HISTORY turns)
    history = req.history[-MAX_HISTORY * 2:]
    messages = [
        {"role": turn.role, "parts": [{"text": turn.content}]}
        for turn in history
    ]
    messages.append({"role": "user", "parts": [{"text": message}]})

    reply = await chat_with_gemini(system, messages)
    return ChatResponse(reply=reply, sources=sources)


# ──────────────────────────────────────────────
# Serve the embeddable widget JS
# ──────────────────────────────────────────────
@app.get("/widget.js")
async def serve_widget():
    js_path = Path("static/widget.js")
    if not js_path.exists():
        raise HTTPException(404, "Widget not found.")
    return FileResponse(js_path, media_type="application/javascript")


@app.get("/health")
async def health():
    return {"status": "ok", "chunks": len(knowledge_base)}
