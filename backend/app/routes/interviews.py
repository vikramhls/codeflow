from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict

from app.models.user import User
from app.models.repository import Repository
from app.models.interview import MockInterviewModel
from app.middleware.auth_middleware import get_current_user
from app.services import interview_service

router = APIRouter(prefix="/interviews", tags=["Mock Interview"])


class InterviewResponse(BaseModel):
    repo_id: str
    repo_name: str
    status: str
    questions: Optional[List[Dict[str, str]]] = None


@router.post("/repos/{repo_id}/generate", response_model=InterviewResponse)
async def generate_interview(
    repo_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Generate or fetch a mock interview for the repo."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    interview_doc = await MockInterviewModel.find_one(MockInterviewModel.repo_id == repo_id)
    
    if interview_doc and interview_doc.status == "done":
        # Cache hit! Return immediately
        return InterviewResponse(
            repo_id=repo_id,
            repo_name=repo.github_repo,
            status=interview_doc.status,
            questions=interview_doc.questions
        )
        
    if not interview_doc:
        interview_doc = MockInterviewModel(repo_id=repo_id, status="pending")
        await interview_doc.insert()
        background_tasks.add_task(interview_service.generate_interview, repo_id)
    elif interview_doc.status == "failed":
        interview_doc.status = "pending"
        await interview_doc.save()
        background_tasks.add_task(interview_service.generate_interview, repo_id)

    return InterviewResponse(
        repo_id=repo_id,
        repo_name=repo.github_repo,
        status="pending",
        questions=None
    )


@router.get("/repos/{repo_id}", response_model=InterviewResponse)
async def get_interview(
    repo_id: str,
    current_user: User = Depends(get_current_user),
):
    """Fetch the status of the mock interview."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    interview_doc = await MockInterviewModel.find_one(MockInterviewModel.repo_id == repo_id)
    if not interview_doc:
        raise HTTPException(status_code=404, detail="No interview found")

    return InterviewResponse(
        repo_id=repo_id,
        repo_name=repo.github_repo,
        status=interview_doc.status,
        questions=interview_doc.questions
    )
