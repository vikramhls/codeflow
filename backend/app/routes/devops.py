from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from app.models.user import User
from app.models.repository import Repository
from app.models.devops import DevOpsReportModel
from app.middleware.auth_middleware import get_current_user
from app.services import devops_service

router = APIRouter(prefix="/devops", tags=["DevOps Expert"])


class ReportResponse(BaseModel):
    repo_id: str
    repo_name: str
    status: Optional[str] = None
    report: Optional[dict] = None
    analyzed_at: Optional[str] = None


@router.post("/repos/{repo_id}/analyze")
async def start_analysis(
    repo_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Trigger the background DevOps Expert analysis."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    if repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    report_doc = await DevOpsReportModel.find_one(DevOpsReportModel.repo_id == repo_id)
    if not report_doc:
        report_doc = DevOpsReportModel(repo_id=repo_id, status="pending")
        await report_doc.insert()
    else:
        report_doc.status = "pending"
        report_doc.report = None
        await report_doc.save()

    background_tasks.add_task(devops_service.analyze_repo, repo_id)
    
    return {"message": "Analysis started"}


@router.get("/repos/{repo_id}/report", response_model=ReportResponse)
async def get_report(
    repo_id: str,
    current_user: User = Depends(get_current_user),
):
    """Fetch the DevOps Expert analysis report."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
        
    if repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    report_doc = await DevOpsReportModel.find_one(DevOpsReportModel.repo_id == repo_id)
    if not report_doc:
        raise HTTPException(status_code=404, detail="No report found")

    return ReportResponse(
        repo_id=repo_id,
        repo_name=repo.github_repo,
        status=report_doc.status,
        report=report_doc.report,
        analyzed_at=report_doc.analyzed_at.isoformat() if report_doc.analyzed_at else None
    )
