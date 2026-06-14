from datetime import datetime
from typing import Optional, List, Dict

from beanie import Document
from pydantic import Field


class MockInterviewModel(Document):
    """Stores the AI-generated Mock Interview questions for a repository."""
    
    repo_id: str = Field(..., description="ID of the associated Repository")
    status: str = Field(default="pending", description="Status of the generation (pending, done, failed)")
    questions: Optional[List[Dict[str, str]]] = Field(default=None, description="List of questions and context")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="When the interview was generated")

    class Settings:
        name = "mock_interviews"
