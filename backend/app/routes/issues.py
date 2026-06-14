"""Issue/query routes — create queries on files, manage issues."""

from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.repository import Repository
from app.models.file import RepoFile
from app.middleware.auth_middleware import get_current_user, get_optional_user

router = APIRouter(prefix="/issues", tags=["Issues"])


# ─── Request/Response schemas ─────────────────────────────────────────

class CreateIssueRequest(BaseModel):
    repo_id: str
    file_id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=5000)
    priority: Optional[str] = "medium"
    bounty_points: int = Field(0, ge=0, le=1000)
    tags: List[str] = Field(default_factory=list)


class UpdateIssueRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    bounty_points: Optional[int] = None
    tags: Optional[List[str]] = None


class IssueResponse(BaseModel):
    id: str
    repo_id: str
    file_id: Optional[str] = None
    author_id: str
    author_username: str = ""
    title: str
    description: str
    status: str
    priority: str
    bounty_points: int
    tags: List[str]
    solutions_count: int
    file_path: Optional[str] = None
    repo_name: str = ""
    created_at: datetime
    updated_at: datetime


class IssueListResponse(BaseModel):
    issues: list[IssueResponse]
    total: int

class PledgeRequest(BaseModel):
    amount: int


# ─── Routes ────────────────────────────────────────────────────────────

@router.post("/", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(
    body: CreateIssueRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a new issue/query on a file or repository."""
    # Verify repo exists
    repo = await Repository.get(body.repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Verify file exists (if specified)
    file_path = None
    if body.file_id:
        file = await RepoFile.get(body.file_id)
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        if file.repo_id != body.repo_id:
            raise HTTPException(status_code=400, detail="File does not belong to this repository")
        file_path = file.path

    # Parse priority
    try:
        priority = IssuePriority(body.priority)
    except ValueError:
        priority = IssuePriority.MEDIUM

    issue = Issue(
        repo_id=body.repo_id,
        file_id=body.file_id,
        author_id=str(current_user.id),
        title=body.title,
        description=body.description,
        priority=priority,
        bounty_points=body.bounty_points,
        tags=body.tags,
    )
    await issue.insert()

    # Update user stats
    current_user.issues_created += 1
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()

    return await _issue_to_response(issue)


@router.get("/", response_model=IssueListResponse)
async def list_issues(
    repo_id: Optional[str] = Query(None),
    file_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    author_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_optional_user),
):
    """List issues with optional filters."""
    query_filters = []

    if repo_id:
        query_filters.append(Issue.repo_id == repo_id)
    if file_id:
        query_filters.append(Issue.file_id == file_id)
    if status_filter:
        query_filters.append(Issue.status == status_filter)
    if author_id:
        query_filters.append(Issue.author_id == author_id)

    issues = await Issue.find(
        *query_filters
    ).sort("-created_at").skip(skip).limit(limit).to_list()

    total = await Issue.find(*query_filters).count()

    return IssueListResponse(
        issues=[await _issue_to_response(i) for i in issues],
        total=total,
    )


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(
    issue_id: str,
    current_user: User = Depends(get_optional_user),
):
    """Get issue details."""
    issue = await Issue.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    return await _issue_to_response(issue)


@router.patch("/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: str,
    body: UpdateIssueRequest,
    current_user: User = Depends(get_current_user),
):
    """Update an issue. Only the author or repo owner can update."""
    issue = await Issue.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Check permissions
    is_author = issue.author_id == str(current_user.id)
    repo = await Repository.get(issue.repo_id)
    is_repo_owner = repo and repo.owner_id == str(current_user.id)

    if not is_author and not is_repo_owner:
        raise HTTPException(status_code=403, detail="Access denied")

    # Apply updates
    if body.title is not None:
        issue.title = body.title
    if body.description is not None:
        issue.description = body.description
    if body.status is not None:
        try:
            issue.status = IssueStatus(body.status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    if body.priority is not None:
        try:
            issue.priority = IssuePriority(body.priority)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid priority")
    if body.bounty_points is not None:
        issue.bounty_points = body.bounty_points
    if body.tags is not None:
        issue.tags = body.tags

    issue.updated_at = datetime.now(timezone.utc)
    await issue.save()

    return await _issue_to_response(issue)


@router.post("/{issue_id}/pledge")
async def pledge_bounty(
    issue_id: str,
    body: PledgeRequest,
    current_user: User = Depends(get_current_user),
):
    """Pledge points to an issue to increase its bounty."""
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Pledge amount must be positive")
    
    if current_user.points < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient points")

    issue = await Issue.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Deduct from user
    current_user.points -= body.amount
    await current_user.save()

    # Add to issue
    issue.bounty_points += body.amount
    await issue.save()

    return {"message": "Pledge successful", "new_bounty": issue.bounty_points}


@router.delete("/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_issue(
    issue_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete an issue. Only the author or repo owner can delete."""
    issue = await Issue.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    is_author = issue.author_id == str(current_user.id)
    repo = await Repository.get(issue.repo_id)
    is_repo_owner = repo and repo.owner_id == str(current_user.id)

    if not is_author and not is_repo_owner:
        raise HTTPException(status_code=403, detail="Access denied")

    await issue.delete()


# ─── Helpers ───────────────────────────────────────────────────────────

async def _issue_to_response(issue: Issue) -> IssueResponse:
    # Get author username
    author = await User.get(issue.author_id)
    author_username = author.username if author else "unknown"

    # Get file path
    file_path = None
    if issue.file_id:
        file = await RepoFile.get(issue.file_id)
        if file:
            file_path = file.path

    # Get repo name
    repo = await Repository.get(issue.repo_id)
    repo_name = f"{repo.github_owner}/{repo.github_repo}" if repo else "unknown"

    return IssueResponse(
        id=str(issue.id),
        repo_id=issue.repo_id,
        file_id=issue.file_id,
        author_id=issue.author_id,
        author_username=author_username,
        title=issue.title,
        description=issue.description,
        status=issue.status.value,
        priority=issue.priority.value,
        bounty_points=issue.bounty_points,
        tags=issue.tags,
        solutions_count=issue.solutions_count,
        file_path=file_path,
        repo_name=repo_name,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
    )
