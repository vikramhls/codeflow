"""Solution submission routes — submit bug fixes, review, sync to GitHub."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.issue import Issue, IssueStatus
from app.models.solution import Solution, SolutionReview, SolutionStatus
from app.models.repository import Repository
from app.models.points import PointTransaction, TransactionType
from app.middleware.auth_middleware import get_current_user, get_optional_user
from app.services import storage_service

router = APIRouter(prefix="/solutions", tags=["Solutions"])


# ─── Request/Response schemas ─────────────────────────────────────────

class CreateSolutionRequest(BaseModel):
    description: str = Field(..., min_length=10, max_length=5000)
    file_patch: Optional[str] = None


class ReviewSolutionRequest(BaseModel):
    status: str = Field(..., description="'accepted' or 'rejected'")
    notes: str = Field("", max_length=2000)
    points_to_award: int = Field(0, ge=0, le=1000)


class SolutionResponse(BaseModel):
    id: str
    issue_id: str
    author_id: str
    author_username: str = ""
    repo_id: str
    description: str
    file_patch: Optional[str] = None
    uploaded_filename: Optional[str] = None
    status: str
    review: Optional[dict] = None
    points_awarded: int
    is_synced_to_github: bool
    github_pr_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class SolutionListResponse(BaseModel):
    solutions: list[SolutionResponse]
    total: int


# ─── Routes ────────────────────────────────────────────────────────────

@router.post(
    "/issues/{issue_id}/submit",
    response_model=SolutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_solution(
    issue_id: str,
    description: str = Form(...),
    file_patch: Optional[str] = Form(None),
    uploaded_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    """Submit a bug fix solution for an issue.

    Can include a text description, code patch, and/or an uploaded file.
    """
    # Verify issue exists
    issue = await Issue.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.status == IssueStatus.CLOSED:
        raise HTTPException(status_code=400, detail="This issue is closed")

    # Handle file upload
    uploaded_file_key = None
    uploaded_filename = None
    if uploaded_file:
        uploaded_filename = uploaded_file.filename
        file_content = await uploaded_file.read()
        storage_key = f"solutions/{str(current_user.id)}/{issue_id}/{uploaded_filename}"

        uploaded = await storage_service.upload_file(
            storage_key, file_content.decode("utf-8", errors="replace")
        )
        if uploaded:
            uploaded_file_key = storage_key

    solution = Solution(
        issue_id=issue_id,
        author_id=str(current_user.id),
        repo_id=issue.repo_id,
        description=description,
        file_patch=file_patch,
        uploaded_file_key=uploaded_file_key,
        uploaded_filename=uploaded_filename,
    )
    await solution.insert()

    # Update issue
    issue.solutions_count += 1
    if issue.status == IssueStatus.OPEN:
        issue.status = IssueStatus.IN_PROGRESS
    issue.updated_at = datetime.now(timezone.utc)
    await issue.save()

    # Update user stats
    current_user.solutions_submitted += 1
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()

    return await _solution_to_response(solution)


@router.get("/issues/{issue_id}/list", response_model=SolutionListResponse)
async def list_solutions(
    issue_id: str,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_optional_user),
):
    """List all solutions for an issue."""
    issue = await Issue.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    query_filters = [Solution.issue_id == issue_id]
    if status_filter:
        query_filters.append(Solution.status == status_filter)

    solutions = await Solution.find(*query_filters).sort("-created_at").to_list()

    return SolutionListResponse(
        solutions=[await _solution_to_response(s) for s in solutions],
        total=len(solutions),
    )


@router.get("/{solution_id}", response_model=SolutionResponse)
async def get_solution(
    solution_id: str,
    current_user: User = Depends(get_optional_user),
):
    """Get solution details."""
    solution = await Solution.get(solution_id)
    if not solution:
        raise HTTPException(status_code=404, detail="Solution not found")

    return await _solution_to_response(solution)


@router.patch("/{solution_id}/review", response_model=SolutionResponse)
async def review_solution(
    solution_id: str,
    body: ReviewSolutionRequest,
    current_user: User = Depends(get_current_user),
):
    """Accept or reject a solution. Only the repo owner can review."""
    solution = await Solution.get(solution_id)
    if not solution:
        raise HTTPException(status_code=404, detail="Solution not found")

    # Verify reviewer is repo owner
    issue = await Issue.get(solution.issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Related issue not found")

    repo = await Repository.get(issue.repo_id)
    if not repo or repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only the repo owner can review solutions")

    # Parse status
    try:
        review_status = SolutionStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'rejected'")

    if review_status not in (SolutionStatus.ACCEPTED, SolutionStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'rejected'")

    # Create review
    solution.status = review_status
    solution.review = SolutionReview(
        reviewer_id=str(current_user.id),
        status=review_status,
        notes=body.notes,
    )
    solution.updated_at = datetime.now(timezone.utc)

    # Award points if accepted
    if review_status == SolutionStatus.ACCEPTED:
        points = body.points_to_award or issue.bounty_points or 10
        solution.points_awarded = points

        # Update solution author's points
        author = await User.get(solution.author_id)
        if author:
            author.points += points
            author.solutions_accepted += 1
            author.updated_at = datetime.now(timezone.utc)
            await author.save()

            # Create point transaction
            transaction = PointTransaction(
                user_id=solution.author_id,
                amount=points,
                type=TransactionType.SOLUTION_ACCEPTED,
                reference_id=str(solution.id),
                description=f"Solution accepted for issue: {issue.title}",
            )
            await transaction.insert()

        # Update issue status
        issue.status = IssueStatus.RESOLVED
        issue.updated_at = datetime.now(timezone.utc)
        await issue.save()

    await solution.save()

    return await _solution_to_response(solution)


@router.post("/{solution_id}/sync-github")
async def sync_solution_to_github(
    solution_id: str,
    current_user: User = Depends(get_current_user),
):
    """Sync an accepted solution to GitHub (create a commit/PR).

    Only the repo owner can trigger this for accepted solutions.
    """
    solution = await Solution.get(solution_id)
    if not solution:
        raise HTTPException(status_code=404, detail="Solution not found")

    if solution.status != SolutionStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Only accepted solutions can be synced to GitHub")

    # Verify repo owner
    issue = await Issue.get(solution.issue_id)
    repo = await Repository.get(issue.repo_id)
    if not repo or repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Only the repo owner can sync to GitHub")

    # TODO: Implement GitHub PR creation via GitHub API
    # This would use the file_patch content to create a commit/PR

    return {
        "message": "GitHub sync is not yet implemented. This will create a PR with the solution's changes.",
        "solution_id": str(solution.id),
        "status": "pending_implementation",
    }


# ─── Helpers ───────────────────────────────────────────────────────────

async def _solution_to_response(solution: Solution) -> SolutionResponse:
    author = await User.get(solution.author_id)
    author_username = author.username if author else "unknown"

    return SolutionResponse(
        id=str(solution.id),
        issue_id=solution.issue_id,
        author_id=solution.author_id,
        author_username=author_username,
        repo_id=solution.repo_id,
        description=solution.description,
        file_patch=solution.file_patch,
        uploaded_filename=solution.uploaded_filename,
        status=solution.status.value,
        review=solution.review.model_dump() if solution.review else None,
        points_awarded=solution.points_awarded,
        is_synced_to_github=solution.is_synced_to_github,
        github_pr_url=solution.github_pr_url,
        created_at=solution.created_at,
        updated_at=solution.updated_at,
    )
