"""File model for repository files with visibility control."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class FileVisibility(str, Enum):
    """File visibility setting."""
    PUBLIC = "public"
    PRIVATE = "private"


class RouteInfo(BaseModel):
    """Extracted route information from API files."""
    method: str = ""
    path: str = ""
    handler: str = ""
    description: Optional[str] = None


class RepoFile(Document):
    """RepoFile document - represents a single file from a repository."""

    repo_id: Indexed(str)  # Repository ID as string
    owner_id: Indexed(str)  # User ID as string
    path: str  # Full path in repo (e.g., "src/routes/api.py")
    filename: str  # Just the filename
    extension: str = ""  # File extension (e.g., ".py")
    language: str = ""  # Detected language

    # Content
    content_hash: str = ""  # SHA hash of content
    storage_key: str = ""  # Supabase storage key
    size_bytes: int = 0
    content: Optional[str] = None  # Stored directly for small files

    # Visibility & Listing
    visibility: FileVisibility = FileVisibility.PRIVATE
    is_listed: bool = False  # Whether shown on public platform

    # AI Summary
    summary: Optional[str] = None
    route_info: Optional[List[dict]] = None  # Extracted routes for API files

    # Stats
    download_count: int = 0
    view_count: int = 0

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "repo_files"
        use_state_management = True

    class Config:
        json_schema_extra = {
            "example": {
                "path": "src/main.py",
                "filename": "main.py",
                "extension": ".py",
                "language": "Python",
                "visibility": "private",
                "is_listed": False,
            }
        }
