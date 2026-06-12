from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict

from app.models.user import User
from app.models.repository import Repository
from app.middleware.auth_middleware import get_current_user
from app.services import knowledge_service

router = APIRouter(prefix="/knowledge", tags=["Repository Knowledge"])

class AskRequest(BaseModel):
    query: str

class AskResponse(BaseModel):
    answer: str
    snippets: List[Dict[str, str]]

@router.post("/repos/{repo_id}/index")
async def index_knowledge(
    repo_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Trigger background job to build embeddings and Redis graph."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    background_tasks.add_task(knowledge_service.generate_and_cache_knowledge, repo_id)
    return {"message": "Indexing started in background."}

@router.post("/repos/{repo_id}/ask", response_model=AskResponse)
async def ask_knowledge(
    repo_id: str,
    req: AskRequest,
    current_user: User = Depends(get_current_user),
):
    """Ask a question to the repository via RAG."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    result = await knowledge_service.ask_repository(repo_id, req.query)
    
    return AskResponse(
        answer=result.get("answer", ""),
        snippets=result.get("snippets", [])
    )
