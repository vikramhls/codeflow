from datetime import datetime
from typing import Optional, Dict, Any

from beanie import Document
from pydantic import Field


class DevOpsReportModel(Document):
    """Stores the AI-generated DevOps architecture blueprint for a repository."""
    
    repo_id: str = Field(..., description="ID of the associated Repository")
    status: str = Field(default="pending", description="Status of the analysis (pending, done, failed)")
    report: Optional[Dict[str, Any]] = Field(default=None, description="The parsed JSON report output")
    analyzed_at: Optional[datetime] = Field(default=None, description="When the analysis was completed")

    class Settings:
        name = "devops_reports"
