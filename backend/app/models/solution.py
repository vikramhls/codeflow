"""Solution model for bug fix submissions."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class SolutionStatus(str, Enum):
    """Solution review status."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class SolutionCreate(BaseModel):
    """Schema for submitting a new solution."""
    description: str
    file_patch: Optional[str] = None
    requested_points: int = 0


class SolutionReview(BaseModel):
    """Embedded review for a solution."""
    reviewer_id: str
    status: SolutionStatus
    notes: str = ""
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SolutionComment(BaseModel):
    """Embedded comment on a solution (e.g. solver notes, follow-up discussion)."""
    author_id: str
    author_username: str
    body: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Solution(Document):
    """Solution document - a bug fix submission for an issue."""

    issue_id: Indexed(str)  # Issue ID
    author_id: Indexed(str)  # User who submitted
    repo_id: str = ""  # Repository ID (for easy querying)

    description: str
    file_patch: Optional[str] = None  # Diff/patch content
    uploaded_file_key: Optional[str] = None  # Supabase key for uploaded file
    uploaded_filename: Optional[str] = None

    # Bidding
    requested_points: int = 0

    # Review
    status: SolutionStatus = SolutionStatus.PENDING
    review: Optional[SolutionReview] = None
    points_awarded: int = 0

    # Comments (embedded, ordered by created_at)
    comments: List[SolutionComment] = Field(default_factory=list)

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
