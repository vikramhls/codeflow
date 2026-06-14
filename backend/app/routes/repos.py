"""Repository management routes."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.repository import Repository, RepoStatus
from app.models.file import RepoFile, FileVisibility
from app.middleware.auth_middleware import get_current_user
from app.services import github_service, file_service
from app.utils.helpers import is_valid_github_url

router = APIRouter(prefix="/repos", tags=["Repositories"])


# ─── Request/Response schemas ─────────────────────────────────────────

class ImportRepoRequest(BaseModel):
    github_url: str = Field(..., description="GitHub repository URL")
    branch: Optional[str] = Field(None, description="Branch to import (defaults to repo's default branch)")


class RepoResponse(BaseModel):
    id: str
    github_url: str
    github_owner: str
    github_repo: str
    branch: str
    description: Optional[str] = None
    language: Optional[str] = None
    stars: int = 0
    forks: int = 0
    status: str
    error_message: Optional[str] = None
    is_synced: bool
    last_synced_at: Optional[datetime] = None
    total_files: int
    public_files_count: int
    private_files_count: int
    listed_files_count: int
    created_at: datetime
    updated_at: datetime


class RepoListResponse(BaseModel):
    repos: list[RepoResponse]
    total: int


class BulkVisibilityRequest(BaseModel):
    visibility: str = Field(..., description="'public' or 'private'")
    list_files: bool = Field(False, description="Also mark all public files as listed on Explore")


# ─── Routes ────────────────────────────────────────────────────────────

@router.post("/import", response_model=RepoResponse, status_code=status.HTTP_201_CREATED)
async def import_repository(
    body: ImportRepoRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Import a GitHub repository.

    Parses the GitHub URL, fetches repo metadata, and starts
    importing all files in the background.
    """
    # Validate URL
    if not is_valid_github_url(body.github_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GitHub URL. Expected: https://github.com/owner/repo",
        )

    # Parse owner and repo
    try:
        owner, repo_name = github_service.parse_github_url(body.github_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Check if already imported
    existing = await Repository.find_one(
        Repository.owner_id == str(current_user.id),
        Repository.github_owner == owner,
        Repository.github_repo == repo_name,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository {owner}/{repo_name} is already imported",
        )

    # Fetch repo info from GitHub
    try:
        repo_info = await github_service.get_repo_info(
            current_user.access_token, owner, repo_name
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch repository from GitHub: {str(e)}",
        )

    # Determine branch
    branch = body.branch or repo_info.get("default_branch", "main")

    # Create repository record
    repo = Repository(
        owner_id=str(current_user.id),
        github_url=body.github_url.strip().rstrip("/"),
        github_owner=owner,
        github_repo=repo_name,
        branch=branch,
        description=repo_info.get("description"),
        language=repo_info.get("language"),
        stars=repo_info.get("stargazers_count", 0),
        forks=repo_info.get("forks_count", 0),
        status=RepoStatus.IMPORTING,
    )
    await repo.insert()

    # Update user stats
    current_user.repos_imported += 1
    current_user.updated_at = datetime.now(timezone.utc)
    await current_user.save()

    # Start file import in background
    background_tasks.add_task(
        file_service.import_repo_files, repo, current_user.access_token
    )

    return _repo_to_response(repo)


@router.get("/my", response_model=RepoListResponse)
async def list_my_repos(current_user: User = Depends(get_current_user)):
    """List all repositories imported by the current user."""
    repos = await Repository.find(
        Repository.owner_id == str(current_user.id)
    ).sort("-created_at").to_list()

    return RepoListResponse(
        repos=[_repo_to_response(r) for r in repos],
        total=len(repos),
    )


@router.get("/{repo_id}", response_model=RepoResponse)
async def get_repository(
    repo_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get repository details."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    return _repo_to_response(repo)


@router.post("/{repo_id}/sync", response_model=RepoResponse)
async def sync_repository(
    repo_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Re-sync a repository with GitHub (fetch latest files)."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    if repo.status == RepoStatus.IMPORTING:
        raise HTTPException(status_code=400, detail="Repository is already being imported")

    # Delete existing files
    await RepoFile.find(RepoFile.repo_id == str(repo.id)).delete()

    # Reset status
    repo.status = RepoStatus.SYNCING
    repo.error_message = None
    await repo.save()

    # Re-import in background
    background_tasks.add_task(
        file_service.import_repo_files, repo, current_user.access_token
    )

    return _repo_to_response(repo)


@router.post("/{repo_id}/generate-summaries")
async def generate_summaries(
    repo_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Generate AI summaries for all files in a repository."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    if repo.status != RepoStatus.READY:
        raise HTTPException(status_code=400, detail="Repository is not ready")

    # Generate summaries in background
    background_tasks.add_task(
        file_service.generate_file_summaries, str(repo.id)
    )

    return {"message": "Summary generation started", "repo_id": str(repo.id)}


@router.patch("/{repo_id}/visibility")
async def bulk_set_visibility(
    repo_id: str,
    body: BulkVisibilityRequest,
    current_user: User = Depends(get_current_user),
):
    """Bulk-set visibility for all files in a repository.

    Sets every file to 'public' or 'private'. When setting to public,
    you can also mark all files as listed on the Explore page.
    """
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        new_vis = FileVisibility(body.visibility)
    except ValueError:
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    files = await RepoFile.find(RepoFile.repo_id == str(repo.id)).to_list()

    for f in files:
        f.visibility = new_vis
        if new_vis == FileVisibility.PUBLIC and body.list_files:
            f.is_listed = True
        elif new_vis == FileVisibility.PRIVATE:
            f.is_listed = False  # can't be listed if private
        f.updated_at = datetime.now(timezone.utc)
        await f.save()

    # Refresh repo file counts
    public_count = sum(1 for f in files if f.visibility == FileVisibility.PUBLIC)
    listed_count = sum(1 for f in files if f.is_listed)
    repo.public_files_count = public_count
    repo.private_files_count = len(files) - public_count
    repo.listed_files_count = listed_count
    repo.updated_at = datetime.now(timezone.utc)
    await repo.save()

    return {
        "message": f"All {len(files)} files set to {new_vis.value}",
        "public_files_count": public_count,
        "private_files_count": len(files) - public_count,
        "listed_files_count": listed_count,
    }


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repo_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete an imported repository and all its files."""
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if repo.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete all files
    await RepoFile.find(RepoFile.repo_id == str(repo.id)).delete()

    # Delete repo
    await repo.delete()

    # Update user stats
    current_user.repos_imported = max(0, current_user.repos_imported - 1)
    await current_user.save()


# ─── Helpers ───────────────────────────────────────────────────────────

def _repo_to_response(repo: Repository) -> RepoResponse:
    return RepoResponse(
        id=str(repo.id),
        github_url=repo.github_url,
        github_owner=repo.github_owner,
        github_repo=repo.github_repo,
        branch=repo.branch,
        description=repo.description,
        language=repo.language,
        stars=repo.stars,
        forks=repo.forks,
        status=repo.status.value,
        error_message=repo.error_message,
        is_synced=repo.is_synced,
        last_synced_at=repo.last_synced_at,
        total_files=repo.total_files,
        public_files_count=repo.public_files_count,
        private_files_count=repo.private_files_count,
        listed_files_count=repo.listed_files_count,
        created_at=repo.created_at,
        updated_at=repo.updated_at,
    )
