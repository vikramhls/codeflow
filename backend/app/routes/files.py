"""File management routes — visibility, listing, download, browse."""

from typing import Optional, List

from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.file import RepoFile, FileVisibility
from app.models.repository import Repository
from app.middleware.auth_middleware import get_current_user, get_optional_user
from app.services import file_service

router = APIRouter(tags=["Files"])


# ─── Request/Response schemas ─────────────────────────────────────────

class FileResponse(BaseModel):
    id: str
    repo_id: str
    path: str
    filename: str
    extension: str
    language: str
    size_bytes: int
    visibility: str
    is_listed: bool
    summary: Optional[str] = None
    route_info: Optional[list] = None
    download_count: int = 0
    view_count: int = 0
    created_at: str
    updated_at: str


class FileListResponse(BaseModel):
    files: list[FileResponse]
    total: int


class FileContentResponse(BaseModel):
    id: str
    path: str
    filename: str
    language: str
    content: str
    size_bytes: int


class UpdateVisibilityRequest(BaseModel):
    visibility: str = Field(..., description="'public' or 'private'")


class UpdateListingRequest(BaseModel):
    is_listed: bool


class BulkVisibilityRequest(BaseModel):
    file_ids: List[str]
    visibility: str = Field(..., description="'public' or 'private'")


class BulkListingRequest(BaseModel):
    file_ids: List[str]
    is_listed: bool


class ExploreFileResponse(BaseModel):
    id: str
    repo_id: str
    repo_name: str
    owner_username: str
    path: str
    filename: str
    language: str
    size_bytes: int
    summary: Optional[str] = None
    download_count: int = 0


# ─── Repo file routes ─────────────────────────────────────────────────

@router.get("/repos/{repo_id}/files", response_model=FileListResponse)
async def list_repo_files(
    repo_id: str,
    visibility: Optional[str] = Query(None, description="Filter by visibility"),
    is_listed: Optional[bool] = Query(None, description="Filter by listing status"),
    language: Optional[str] = Query(None, description="Filter by language"),
    current_user: User = Depends(get_current_user),
):
    """List all files in a repository.

    Owners see all files. Others only see public + listed files.
    """
    repo = await Repository.get(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    is_owner = repo.owner_id == str(current_user.id)

    # Build query
    query_filters = [RepoFile.repo_id == repo_id]

    if not is_owner:
        # Non-owners only see public listed files
        query_filters.append(RepoFile.visibility == FileVisibility.PUBLIC)
        query_filters.append(RepoFile.is_listed == True)
    else:
        # Owner can filter
        if visibility:
            query_filters.append(RepoFile.visibility == visibility)
        if is_listed is not None:
            query_filters.append(RepoFile.is_listed == is_listed)

    if language:
        query_filters.append(RepoFile.language == language)

    files = await RepoFile.find(*query_filters).sort("path").to_list()

    return FileListResponse(
        files=[_file_to_response(f) for f in files],
        total=len(files),
    )


# ─── Single file operations ───────────────────────────────────────────

@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: str,
    current_user: User = Depends(get_optional_user),
):
    """Get file details and summary.

    Public files: anyone can see.
    Private files: only owner can see.
    """
    file = await RepoFile.get(file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    is_owner = current_user and file.owner_id == str(current_user.id)

    if file.visibility == FileVisibility.PRIVATE and not is_owner:
        raise HTTPException(status_code=403, detail="This file is private")

    # Increment view count
    file.view_count += 1
    await file.save()

    return _file_to_response(file)


@router.get("/files/{file_id}/content")
async def get_file_content(
    file_id: str,
    current_user: User = Depends(get_optional_user),
):
    """Get file content.

    Public files: anyone can download.
    Private files: only owner can view content.
    """
    file = await RepoFile.get(file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    is_owner = current_user and file.owner_id == str(current_user.id)

    if file.visibility == FileVisibility.PRIVATE and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="This file is private. Only the summary is available.",
        )

    content = await file_service.get_file_content(file)
    if not content:
        raise HTTPException(status_code=404, detail="File content not available")

    return FileContentResponse(
        id=str(file.id),
        path=file.path,
        filename=file.filename,
        language=file.language,
        content=content,
        size_bytes=file.size_bytes,
    )


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_optional_user),
):
    """Download a file's raw content.

    Public files: anyone can download.
    Private files: only owner.
    """
    file = await RepoFile.get(file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    is_owner = current_user and file.owner_id == str(current_user.id)

    if file.visibility == FileVisibility.PRIVATE and not is_owner:
        raise HTTPException(status_code=403, detail="This file is private")

    content = await file_service.get_file_content(file)
    if not content:
        raise HTTPException(status_code=404, detail="File content not available")

    # Increment download count
    file.download_count += 1
    await file.save()

    return PlainTextResponse(
        content=content,
        headers={"Content-Disposition": f'attachment; filename="{file.filename}"'},
    )


@router.get("/files/{file_id}/summary")
async def get_file_summary(
    file_id: str,
    current_user: User = Depends(get_optional_user),
):
    """Get the AI-generated summary of a file.

    Available for both public and private files (summary only, not content).
    """
    file = await RepoFile.get(file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "id": str(file.id),
        "path": file.path,
        "filename": file.filename,
        "language": file.language,
        "summary": file.summary or "No summary available. Generate summaries from the repository page.",
        "route_info": file.route_info,
    }


# ─── Visibility & Listing management ──────────────────────────────────

@router.patch("/files/{file_id}/visibility", response_model=FileResponse)
async def update_file_visibility(
    file_id: str,
    body: UpdateVisibilityRequest,
    current_user: User = Depends(get_current_user),
):
    """Toggle a file's visibility (public/private). Owner only."""
    file = await RepoFile.get(file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        visibility = FileVisibility(body.visibility)
    except ValueError:
        raise HTTPException(status_code=400, detail="Visibility must be 'public' or 'private'")

    file = await file_service.update_visibility(file, visibility)
    return _file_to_response(file)


@router.patch("/files/{file_id}/listing", response_model=FileResponse)
async def update_file_listing(
    file_id: str,
    body: UpdateListingRequest,
    current_user: User = Depends(get_current_user),
):
    """Toggle whether a file is listed on the platform. Owner only."""
    file = await RepoFile.get(file_id)
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.owner_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    file = await file_service.update_listing(file, body.is_listed)
    return _file_to_response(file)


@router.patch("/files/bulk-visibility")
async def bulk_update_visibility(
    body: BulkVisibilityRequest,
    current_user: User = Depends(get_current_user),
):
    """Bulk update visibility for multiple files. Owner only."""
    try:
        visibility = FileVisibility(body.visibility)
    except ValueError:
        raise HTTPException(status_code=400, detail="Visibility must be 'public' or 'private'")

    count = await file_service.bulk_update_visibility(
        body.file_ids, visibility, str(current_user.id)
    )
    return {"updated": count, "total_requested": len(body.file_ids)}


@router.patch("/files/bulk-listing")
async def bulk_update_listing(
    body: BulkListingRequest,
    current_user: User = Depends(get_current_user),
):
    """Bulk update listing status for multiple files. Owner only."""
    count = await file_service.bulk_update_listing(
        body.file_ids, body.is_listed, str(current_user.id)
    )
    return {"updated": count, "total_requested": len(body.file_ids)}


# ─── Explore (public browse) ──────────────────────────────────────────

@router.get("/explore", response_model=list[ExploreFileResponse])
async def explore_files(
    language: Optional[str] = Query(None, description="Filter by language"),
    search: Optional[str] = Query(None, description="Search filename"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_optional_user),
):
    """Browse all publicly listed files across the platform."""
    query_filters = [
        RepoFile.visibility == FileVisibility.PUBLIC,
        RepoFile.is_listed == True,
    ]

    if language:
        query_filters.append(RepoFile.language == language)

    if search:
        query_filters.append(
            RepoFile.filename == {"$regex": search, "$options": "i"}
        )

    files = await RepoFile.find(
        *query_filters
    ).sort("-download_count").skip(skip).limit(limit).to_list()

    # Enrich with repo and owner info
    results = []
    for file in files:
        repo = await Repository.get(file.repo_id)
        owner = None
        if repo:
            from app.models.user import User as UserModel
            owner = await UserModel.get(repo.owner_id)

        results.append(ExploreFileResponse(
            id=str(file.id),
            repo_id=file.repo_id,
            repo_name=f"{repo.github_owner}/{repo.github_repo}" if repo else "unknown",
            owner_username=owner.username if owner else "unknown",
            path=file.path,
            filename=file.filename,
            language=file.language,
            size_bytes=file.size_bytes,
            summary=file.summary,
            download_count=file.download_count,
        ))

    return results


# ─── Helpers ───────────────────────────────────────────────────────────

def _file_to_response(file: RepoFile) -> FileResponse:
    return FileResponse(
        id=str(file.id),
        repo_id=file.repo_id,
        path=file.path,
        filename=file.filename,
        extension=file.extension,
        language=file.language,
        size_bytes=file.size_bytes,
        visibility=file.visibility.value,
        is_listed=file.is_listed,
        summary=file.summary,
        route_info=file.route_info,
        download_count=file.download_count,
        view_count=file.view_count,
        created_at=str(file.created_at),
        updated_at=str(file.updated_at),
    )
