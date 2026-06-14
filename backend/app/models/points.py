"""Points and badges models for gamification."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class TransactionType(str, Enum):
    """Point transaction types."""
    BUG_FOUND = "bug_found"
    SOLUTION_ACCEPTED = "solution_accepted"
    SOLUTION_REJECTED = "solution_rejected"
    REPO_IMPORTED = "repo_imported"
    ISSUE_CREATED = "issue_created"
    BONUS = "bonus"


class PointTransaction(Document):
    """Record of point awards/deductions."""

    user_id: Indexed(str)
    amount: int  # Positive = award, negative = deduction
    type: TransactionType
    reference_id: Optional[str] = None  # ID of related issue/solution
    description: str = ""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "point_transactions"


class Badge(Document):
    """Badge definition."""

    name: str
    description: str
    icon: str = "🏆"
    requirement_type: str = ""  # e.g., "solutions_accepted"
    requirement_value: int = 0  # e.g., 10

    class Settings:
        name = "badges"


class UserBadge(Document):
    """Badge earned by a user."""

    user_id: Indexed(str)
    badge_id: str
    earned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "user_badges"
