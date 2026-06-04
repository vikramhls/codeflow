"""Repository model for imported GitHub repositories."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from beanie import Document, Indexed, Link
from pydantic import Field

from app.models.user import User


class RepoStatus(str, Enum):
    """Repository import status."""
    IMPORTING = "importing"
    READY = "ready"
    SYNCING = "syncing"
    ERROR = "error"


class Repository(Document):
    """Repository document - represents an imported GitHub repository."""

    owner_id: Indexed(str)  # User ID as string
    github_url: str  # Full GitHub repo URL
    github_owner: str  # GitHub username/org
    github_repo: str  # Repository name
    branch: str = "main"
    description: Optional[str] = None
    language: Optional[str] = None  # Primary language
    stars: int = 0
    forks: int = 0

    # Import status
    status: RepoStatus = RepoStatus.IMPORTING
    error_message: Optional[str] = None

    # Sync info
    is_synced: bool = False
    last_synced_at: Optional[datetime] = None

    # File counts
    total_files: int = 0
    public_files_count: int = 0
    private_files_count: int = 0
    listed_files_count: int = 0

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "repositories"
        use_state_management = True

    class Config:
        json_schema_extra = {
            "example": {
                "github_url": "https://github.com/johndoe/my-project",
                "github_owner": "johndoe",
                "github_repo": "my-project",
                "branch": "main",
                "status": "ready",
            }
        }
