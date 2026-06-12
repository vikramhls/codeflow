import json
import httpx
from typing import Optional, Dict

from app.config import settings
from app.database import get_redis
from app.models.file import RepoFile
from app.services.rag_service import search_codebase, index_repository

async def generate_and_cache_knowledge(repo_id: str):
    """Generate high-level architecture and feature map, cache in Redis."""
    redis = get_redis()
    
    # 1. Build ChromaDB index first
    await index_repository(repo_id)

    # 2. Fetch top 5 largest files for context to build architecture map
    files = await RepoFile.find(RepoFile.repo_id == repo_id).sort("-size_bytes").limit(5).to_list()
    file_summaries = "\n".join([f"{f.path}: {f.summary or ''}" for f in files])
    
    if settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY != "your-openrouter-api-key":
        prompt = f"""Analyze this repository context and return exactly two things in JSON:
1. "architecture_summary": A 3 sentence summary of the tech stack and main entry points.
2. "feature_map": An array of features (e.g. "Authentication", "Database") with a short description and likely files.

Codebase context:
{file_summaries}

Return ONLY valid JSON with keys "architecture_summary" (string) and "feature_map" (array of objects with 'feature' and 'description').
"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [
                            {"role": "system", "content": "You are a senior software architect. Output JSON only."},
                            {"role": "user", "content": prompt},
                        ],
                        "max_tokens": 1500,
                        "temperature": 0.2,
                    },
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"].strip()
                if content.startswith("```json"):
                    content = content.split("```json")[1]
                if content.endswith("```"):
                    content = content.rsplit("```", 1)[0]
                content = content.strip()
                
                parsed = json.loads(content)
                
                if redis:
                    try:
                        await redis.set(f"repo:{repo_id}:architecture", parsed.get("architecture_summary", ""))
                        await redis.set(f"repo:{repo_id}:features", json.dumps(parsed.get("feature_map", [])))
                    except Exception as redis_e:
                        print(f"Warning: Redis cache failed: {redis_e}")
                    
        except Exception as e:
            print(f"Failed to generate knowledge graph: {e}")

async def ask_repository(repo_id: str, query: str) -> Dict[str, str]:
    """Perform RAG search: get code snippets + Redis context, send to LLM."""
    
    # 1. Fetch from Redis
    architecture = ""
    redis = get_redis()
    if redis:
        try:
            architecture = await redis.get(f"repo:{repo_id}:architecture") or ""
        except Exception as e:
            print(f"Warning: Redis fetch failed: {e}")
        
    # 2. Vector Search (ChromaDB)
    snippets = await search_codebase(repo_id, query, top_k=3)
    
    snippet_text = ""
    for s in snippets:
        snippet_text += f"\n--- {s['path']} ---\n{s['content']}\n"
        
    if not snippet_text:
        snippet_text = "No relevant code snippets found in ChromaDB."

    if settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY != "your-openrouter-api-key":
        prompt = f"""You are a Repository Intelligence Assistant answering questions about the codebase.
Use the following context to answer the user's question accurately. Be concise, and cite the file paths provided.

Repository Architecture:
{architecture}

Relevant Code Snippets:
{snippet_text}

Question: {query}
"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [
                            {"role": "system", "content": "You are a helpful programming assistant."},
                            {"role": "user", "content": prompt},
                        ],
                        "max_tokens": 1000,
                        "temperature": 0.3,
                    },
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                answer = response.json()["choices"][0]["message"]["content"].strip()
                return {"answer": answer, "snippets": snippets}
        except Exception as e:
            print(f"Failed to query LLM: {e}")
            return {"answer": f"Error contacting AI: {str(e)}", "snippets": snippets}
    
    return {"answer": "AI is not configured. Here are the snippets I found.", "snippets": snippets}
