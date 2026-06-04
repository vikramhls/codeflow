"""Solution model for bug fix submissions."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class SolutionStatus(str, Enum):
    """Solution review status."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class SolutionReview(BaseModel):
    """Embedded review for a solution."""
    reviewer_id: str
    status: SolutionStatus
    notes: str = ""
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Solution(Document):
    """Solution document - a bug fix submission for an issue."""

    issue_id: Indexed(str)  # Issue ID
    author_id: Indexed(str)  # User who submitted
    repo_id: str = ""  # Repository ID (for easy querying)

    description: str
    file_patch: Optional[str] = None  # Diff/patch content
    uploaded_file_key: Optional[str] = None  # Supabase key for uploaded file
    uploaded_filename: Optional[str] = None

    # Review
    status: SolutionStatus = SolutionStatus.PENDING
    review: Optional[SolutionReview] = None
    points_awarded: int = 0

    # GitHub sync
    is_synced_to_github: bool = False
    github_pr_url: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "solutions"
        use_state_management = True

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Fixed the null pointer in auth handler",
                "status": "pending",
            }
        }
