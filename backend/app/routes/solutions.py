"""Solution submission routes — submit bug fixes, review, sync to GitHub."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.issue import Issue, IssueStatus
from app.models.solution import Solution, SolutionReview, SolutionStatus, SolutionComment
from app.models.repository import Repository
from app.models.file import RepoFile
from app.models.points import PointTransaction, TransactionType
from app.middleware.auth_middleware import get_current_user, get_optional_user
from app.services import storage_service, github_service, summary_service

router = APIRouter(prefix="/solutions", tags=["Solutions"])


# ─── Request/Response schemas ─────────────────────────────────────────

class CreateSolutionRequest(BaseModel):
    description: str = Field(..., min_length=10, max_length=5000)
    file_patch: Optional[str] = None


class ReviewSolutionRequest(BaseModel):
    status: str = Field(..., description="'accepted' or 'rejected'")
    notes: str = Field("", max_length=2000)
    points_to_award: int = Field(0, ge=0, le=1000)


class SolutionCommentResponse(BaseModel):
    author_id: str
    author_username: str
    body: str
    created_at: datetime


class SolutionResponse(BaseModel):
    id: str
    issue_id: str
    author_id: str
    author_username: str = ""
    repo_id: str
    description: str
    file_patch: Optional[str] = None
    requested_points: int = 0
    uploaded_filename: Optional[str] = None
    status: str
    review: Optional[dict] = None
    points_awarded: int
    is_synced_to_github: bool
    github_pr_url: Optional[str] = None
    comments: list[SolutionCommentResponse] = []
    created_at: datetime
    updated_at: datetime


class SolutionListResponse(BaseModel):
    solutions: list[SolutionResponse]
    total: int


class AddCommentRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


# ─── Routes ────────────────────────────────────────────────────────────

@router.post(
    "/issues/{issue_id}/submit",
    response_model=SolutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_solution(
    issue_id: str,
    background_tasks: BackgroundTasks,
    description: str = Form(...),
    file_patch: Optional[str] = Form(None),
    requested_points: int = Form(0),
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
        requested_points=requested_points,
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

    # Trigger AI review in background
    async def perform_ai_review(sol_id: str, issue_desc: str, patch: str, sol_desc: str):
        ai_comment = await summary_service.analyze_solution(issue_desc, patch, sol_desc)
        # Fetch fresh to avoid conflicts
        sol = await Solution.get(sol_id)
        if sol:
            sol.comments.append(SolutionComment(
                author_id="ai",
                author_username="CodeFlow AI",
                body=ai_comment
            ))
            await sol.save()

    background_tasks.add_task(
        perform_ai_review,
        str(solution.id),
        issue.description,
        file_patch or "",
        description
    )

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
        points = solution.requested_points or body.points_to_award or issue.bounty_points or 10
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


@router.post("/{solution_id}/comments", response_model=SolutionResponse)
async def add_comment(
    solution_id: str,
    body: AddCommentRequest,
    current_user: User = Depends(get_current_user),
):
    """Add a comment to a solution (open to any authenticated user)."""
    solution = await Solution.get(solution_id)
    if not solution:
        raise HTTPException(status_code=404, detail="Solution not found")

    comment = SolutionComment(
        author_id=str(current_user.id),
        author_username=current_user.username,
        body=body.body,
    )
    solution.comments.append(comment)
    solution.updated_at = datetime.now(timezone.utc)
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
        
    if not issue.file_id:
        raise HTTPException(status_code=400, detail="Cannot sync repo-level issues without a specific file. (Only file-specific issues are supported for automatic PRs right now).")
        
    if not solution.file_patch:
        raise HTTPException(status_code=400, detail="This solution does not contain a file patch.")
        
    repo_file = await RepoFile.get(issue.file_id)
    if not repo_file:
        raise HTTPException(status_code=404, detail="The file linked to this issue was not found.")

    try:
        # 1. Get default branch SHA
        base_sha = await github_service.get_branch_ref(
            current_user.access_token, repo.github_owner, repo.github_repo, repo.branch
        )
        
        # 2. Create new branch
        new_branch_name = f"codeflow-fix-{solution.id}"
        await github_service.create_branch(
            current_user.access_token, repo.github_owner, repo.github_repo, new_branch_name, base_sha
        )
        
        # 3. Get current file SHA (to update it)
        file_sha = await github_service.get_file_sha(
            current_user.access_token, repo.github_owner, repo.github_repo, repo_file.path, repo.branch
        )
        
        # 4. Update file on the new branch
        commit_message = f"Fix issue: {issue.title}\n\nSubmitted via CodeFlow."
        await github_service.update_file(
            current_user.access_token, repo.github_owner, repo.github_repo, repo_file.path, 
            commit_message, solution.file_patch, new_branch_name, file_sha
        )
        
        # 5. Create Pull Request
        pr_title = f"Fix: {issue.title}"
        pr_body = f"This Pull Request contains a verified solution from CodeFlow.\n\n**Issue:** {issue.title}\n**Solver:** (CodeFlow User ID: {solution.author_id})\n**Description:** {solution.description}"
        pr_url = await github_service.create_pull_request(
            current_user.access_token, repo.github_owner, repo.github_repo, pr_title, pr_body, new_branch_name, repo.branch
        )
        
        # Save to DB
        solution.is_synced_to_github = True
        solution.github_pr_url = pr_url
        solution.updated_at = datetime.now(timezone.utc)
        await solution.save()

        return await _solution_to_response(solution)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync with GitHub API: {str(e)}")


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
        requested_points=solution.requested_points,
        uploaded_filename=solution.uploaded_filename,
        status=solution.status.value,
        review=solution.review.model_dump() if solution.review else None,
        points_awarded=solution.points_awarded,
        is_synced_to_github=solution.is_synced_to_github,
        github_pr_url=solution.github_pr_url,
        comments=[
            SolutionCommentResponse(
                author_id=c.author_id,
                author_username=c.author_username,
                body=c.body,
                created_at=c.created_at,
            )
            for c in solution.comments
        ],
        created_at=solution.created_at,
        updated_at=solution.updated_at,
    )
