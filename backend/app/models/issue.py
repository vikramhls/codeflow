"""Issue model for queries and bug reports on files."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List
from beanie import Document, Indexed
from pydantic import Field


class IssueStatus(str, Enum):
    """Issue status."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IssuePriority(str, Enum):
    """Issue priority level."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Issue(Document):
    """Issue document - a query or bug report on a file."""

    repo_id: Indexed(str)  # Repository ID
    file_id: Optional[str] = None  # Optional: specific file
    author_id: Indexed(str)  # User who created the issue

    title: str
    description: str  # The query/problem description
    status: IssueStatus = IssueStatus.OPEN
    priority: IssuePriority = IssuePriority.MEDIUM

    # Bounty
    bounty_points: int = 0
    tags: List[str] = Field(default_factory=list)

    # Counts
    solutions_count: int = 0

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "issues"
        use_state_management = True

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Bug in authentication flow",
                "description": "The login function fails when...",
                "status": "open",
                "priority": "medium",
                "bounty_points": 50,
            }
        }
