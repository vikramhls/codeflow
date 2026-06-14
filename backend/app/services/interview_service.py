import json
import httpx
from typing import Optional

from app.config import settings
from app.models.interview import MockInterviewModel
from app.models.file import RepoFile

async def generate_interview(repo_id: str):
    """Background task to generate mock interview questions for a repo."""
    interview_doc = await MockInterviewModel.find_one(MockInterviewModel.repo_id == repo_id)
    if not interview_doc:
        return

    try:
        # Fetch up to 5 largest files for context
        files = await RepoFile.find(RepoFile.repo_id == repo_id).sort("-size_bytes").limit(5).to_list()
        
        file_summaries = []
        for f in files:
            file_summaries.append(f"{f.path}: {f.summary or 'No summary available'}")
        
        files_context = "\n".join(file_summaries)
        
        empty_json = '''{
  "questions": [
    {
      "question": "Why did you choose this architecture in main.py over alternative X?",
      "context": "main.py seems to be the entry point.",
      "ideal_answer": "A strong answer should discuss the trade-offs of the architecture, focusing on scalability and specific decisions made in the code."
    }
  ]
}'''

        questions_data = None
        
        if settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY != "your-openrouter-api-key":
            prompt = f"""You are a tough Senior Engineering Interviewer. Analyze the following codebase context (the largest files in the repository) and generate exactly 3 hard technical interview questions specifically about the design, scalability, and code choices.
Return ONLY valid JSON matching this exact structure:
{empty_json}

Codebase context:
{files_context}
"""
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                        json={
                            "model": settings.OPENROUTER_MODEL,
                            "messages": [
                                {"role": "system", "content": "You are a tough technical interviewer. Output only JSON."},
                                {"role": "user", "content": prompt},
                            ],
                            "max_tokens": 1000,
                            "temperature": 0.4,
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
                    parsed = json.loads(content)
                    questions_data = parsed.get("questions", [])
            except Exception as e:
                print(f"Interview AI failed: {e}")
        
        if not questions_data:
            # Fallback heuristic
            questions_data = [
                {
                    "question": "What is the Big O time complexity of your most critical function?",
                    "context": "General algorithmic check",
                    "ideal_answer": "Discuss the worst-case and average-case time complexities."
                },
                {
                    "question": "How would your current database schema handle 10x the amount of users?",
                    "context": "Scalability check",
                    "ideal_answer": "Discuss sharding, indexing, or moving to a read-replica setup."
                },
                {
                    "question": "If you had 1 more month to work on this, what technical debt would you refactor first?",
                    "context": "Architecture check",
                    "ideal_answer": "Identify the messiest part of the codebase and explain how you would clean it up."
                }
            ]
            
        interview_doc.questions = questions_data
        interview_doc.status = "done"
        await interview_doc.save()

    except Exception as e:
        print(f"Error generating interview: {e}")
        interview_doc.status = "failed"
        await interview_doc.save()
