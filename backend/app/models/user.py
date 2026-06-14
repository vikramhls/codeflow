"""User model for GitHub-authenticated users."""

from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class User(Document):
    """User document - represents a GitHub-authenticated user."""

    github_id: Indexed(int, unique=True)
    username: Indexed(str, unique=True)
    email: Optional[str] = None
    name: Optional[str] = None
    avatar_url: str = ""
    bio: Optional[str] = None
    github_url: str = ""
    access_token: str = ""  # GitHub access token (encrypted in production)

    # Platform stats
    points: int = 0
    repos_imported: int = 0
    issues_created: int = 0
    solutions_submitted: int = 0
    solutions_accepted: int = 0
    # Gamification
    current_streak: int = 0
    highest_streak: int = 0
    last_active_date: Optional[datetime] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
        use_state_management = True

    class Config:
        json_schema_extra = {
            "example": {
                "github_id": 12345678,
                "username": "johndoe",
                "email": "john@example.com",
                "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
            }
        }
