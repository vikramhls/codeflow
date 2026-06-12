import json
import httpx
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.models.devops import DevOpsReportModel
from app.models.file import RepoFile
from app.models.repository import Repository

async def analyze_repo(repo_id: str):
    """Background task to generate a DevOps blueprint for a repository."""
    report_doc = await DevOpsReportModel.find_one(DevOpsReportModel.repo_id == repo_id)
    if not report_doc:
        return

    try:
        # Fetch up to 100 files for context
        files = await RepoFile.find(RepoFile.repo_id == repo_id).limit(100).to_list()
        
        file_summaries = []
        languages = {}
        total_size = 0
        
        for f in files:
            total_size += f.size_bytes
            lang = f.language or "unknown"
            languages[lang] = languages.get(lang, 0) + 1
            if len(file_summaries) < 50:
                file_summaries.append(f"{f.path} ({lang}): {f.summary or 'No summary'}")
        
        files_context = "\n".join(file_summaries)
        
        # Base JSON structure
        empty_json = '''{
  "architecture_type": "microservices",
  "architecture_reasoning": "",
  "servers": {
    "web": {"count": 2, "type": "t3.medium", "specs": "2 vCPU, 4GB RAM", "purpose": "App serving"}
  },
  "load_balancer": {"needed": true, "type": "ALB", "reason": "Distribute traffic"},
  "database": {"engine": "PostgreSQL", "type": "RDS", "storage_gb": 50, "replicas": 1, "backup_strategy": "Daily", "connection_pool": 100},
  "caching": {"needed": false, "service": "Redis", "type": "None", "use_cases": []},
  "estimated_monthly_cost": {
    "low_traffic": {"amount": "$50", "users": "1k"},
    "medium_traffic": {"amount": "$200", "users": "10k"},
    "high_traffic": {"amount": "$1000", "users": "100k"}
  },
  "bottlenecks": [],
  "scaling_recommendations": [],
  "ci_cd_suggestions": [],
  "security_notes": [],
  "summary": "Generated architecture."
}'''

        report_data = None
        
        if settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY != "your-openrouter-api-key":
            prompt = f"""You are an expert Cloud/DevOps Architect. Analyze the following codebase context and design a deployment blueprint.
Return ONLY valid JSON matching this exact structure:
{empty_json}

Codebase context (up to 50 files):
{files_context}
"""
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                        json={
                            "model": settings.OPENROUTER_MODEL,
                            "messages": [
                                {"role": "system", "content": "You are a DevOps expert. Output only JSON."},
                                {"role": "user", "content": prompt},
                            ],
                            "max_tokens": 1500,
                            "temperature": 0.2,
                        },
                        headers={
                            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "http://localhost:8000",
                            "X-Title": "CodeBounty",
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    if content.startswith("```json"):
                        content = content.split("```json")[1]
                    if content.endswith("```"):
                        content = content.rsplit("```", 1)[0]
                    content = content.strip()
                    report_data = json.loads(content)
                    
                    # Add meta
                    report_data["_meta"] = {
                        "generated_by": "ai",
                        "model": settings.OPENROUTER_MODEL,
                        "detected_stack": { "frameworks": [], "databases": [], "infrastructure": [] },
                        "languages": languages,
                        "file_count": len(files),
                        "total_size_bytes": total_size,
                        "route_count": 0,
                        "generated_at": datetime.now(timezone.utc).isoformat()
                    }
            except Exception as e:
                print(f"DevOps AI failed: {e}")
        
        if not report_data:
            # Fallback heuristic logic
            report_data = json.loads(empty_json)
            report_data["_meta"] = {
                "generated_by": "heuristic engine",
                "model": None,
                "detected_stack": { "frameworks": [], "databases": [], "infrastructure": [] },
                "languages": languages,
                "file_count": len(files),
                "total_size_bytes": total_size,
                "route_count": 0,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
        report_doc.report = report_data
        report_doc.status = "done"
        report_doc.analyzed_at = datetime.now(timezone.utc)
        await report_doc.save()

    except Exception as e:
        print(f"Error generating DevOps report: {e}")
        report_doc.status = "failed"
        await report_doc.save()
