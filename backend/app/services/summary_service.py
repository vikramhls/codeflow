"""AI-powered file summary service using OpenRouter (free models)."""

from typing import Optional, List, Dict
import httpx

from app.config import settings


async def generate_file_summary(content: str, filename: str, language: str = "") -> str:
    """Generate an AI summary of a file's purpose and functionality.

    Uses OpenRouter API with free model (openai/gpt-oss-120b:free).
    Falls back to heuristic summary if API is unavailable.
    """
    if not settings.OPENROUTER_API_KEY or settings.OPENROUTER_API_KEY == "your-openrouter-api-key":
        return _heuristic_summary(content, filename, language)

    try:
        prompt = f"""Analyze this code file and provide a concise summary (2-4 sentences).
Include:
- What this file does (its main purpose)
- Key functions/classes/routes it contains
- Any important dependencies or patterns

Filename: {filename}
Language: {language or 'Unknown'}

```
{content[:8000]}
```

Respond with ONLY the summary, no markdown formatting."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a code analysis assistant. Provide concise, technical file summaries."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 300,
                    "temperature": 0.3,
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
            return data["choices"][0]["message"]["content"].strip()

    except Exception as e:
        print(f"AI summary generation failed: {e}")
        return _heuristic_summary(content, filename, language)


async def extract_route_info(content: str, filename: str, language: str = "") -> List[Dict]:
    """Extract API route information from a file.

    Uses OpenRouter API. Falls back to regex-based extraction.
    """
    if not settings.OPENROUTER_API_KEY or settings.OPENROUTER_API_KEY == "your-openrouter-api-key":
        return _heuristic_route_extraction(content, language)

    try:
        prompt = f"""Analyze this code file and extract all API routes/endpoints.
For each route, provide: method (GET/POST/PUT/DELETE/PATCH), path, handler function name, and a brief description.

Filename: {filename}
Language: {language or 'Unknown'}

```
{content[:8000]}
```

Respond as JSON array: [{{"method": "GET", "path": "/api/users", "handler": "get_users", "description": "Fetch all users"}}]
If no routes found, respond with: []"""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a code analysis assistant. Extract API route information and respond in JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 500,
                    "temperature": 0.1,
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
            result_text = data["choices"][0]["message"]["content"].strip()

            # Try to parse JSON from the response
            import json
            # Handle markdown code blocks
            if "```" in result_text:
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()

            return json.loads(result_text)

    except Exception as e:
        print(f"AI route extraction failed: {e}")
        return _heuristic_route_extraction(content, language)


async def generate_repo_summary(files_info: List[Dict]) -> str:
    """Generate an overall repository summary from file information.

    Uses OpenRouter API. Falls back to basic summary.
    """
    if not settings.OPENROUTER_API_KEY or settings.OPENROUTER_API_KEY == "your-openrouter-api-key":
        return _heuristic_repo_summary(files_info)

    try:
        files_list = "\n".join(
            [f"- {f['path']} ({f.get('language', 'unknown')}): {f.get('summary', 'no summary')}"
             for f in files_info[:50]]  # Limit to 50 files
        )

        prompt = f"""Based on these files and their summaries, provide a concise repository overview (3-5 sentences).

Files:
{files_list}

Describe the project's purpose, architecture, and key technologies used."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a code analysis assistant. Provide concise project summaries."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 400,
                    "temperature": 0.3,
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
            return data["choices"][0]["message"]["content"].strip()

    except Exception as e:
        print(f"AI repo summary failed: {e}")
        return _heuristic_repo_summary(files_info)


async def analyze_solution(issue_description: str, file_patch: str, solution_description: str) -> str:
    """Analyze a proposed solution and return an automated code review comment."""
    if not settings.OPENROUTER_API_KEY or settings.OPENROUTER_API_KEY == "your-openrouter-api-key":
        return "⚠️ Automated AI Code Review is currently unavailable (API key not configured)."

    try:
        prompt = f"""You are an expert AI code reviewer. Analyze the proposed solution for an issue.

Issue Description:
{issue_description}

Solver's Description:
{solution_description}

Code Patch:
```diff
{file_patch or "No code patch provided."}
```

Provide a brief, constructive code review comment (2-3 paragraphs max).
If there are obvious bugs, security flaws, or style issues, point them out kindly.
If the solution looks good, say so! Do NOT use markdown headings, just plain text with basic markdown (bold/code)."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a helpful and expert code reviewer."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 400,
                    "temperature": 0.3,
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
            return data["choices"][0]["message"]["content"].strip()

    except Exception as e:
        print(f"AI solution analysis failed: {e}")
        return f"⚠️ Automated AI Code Review failed to process this solution."


# ─── Fallback heuristics ──────────────────────────────────────────────

def _heuristic_summary(content: str, filename: str, language: str) -> str:
    """Generate a basic summary using heuristics when AI is unavailable."""
    lines = content.split("\n")
    line_count = len(lines)

    # Count functions/classes
    func_count = sum(1 for line in lines if line.strip().startswith(("def ", "function ", "func ", "fn ")))
    class_count = sum(1 for line in lines if line.strip().startswith(("class ", "struct ", "interface ")))
    import_count = sum(1 for line in lines if line.strip().startswith(("import ", "from ", "require(", "#include", "using ")))

    parts = [f"{filename} is a {language or 'code'} file with {line_count} lines."]

    if class_count:
        parts.append(f"Contains {class_count} class(es).")
    if func_count:
        parts.append(f"Contains {func_count} function(s).")
    if import_count:
        parts.append(f"Has {import_count} import(s).")

    return " ".join(parts)


def _heuristic_route_extraction(content: str, language: str) -> List[Dict]:
    """Extract routes using regex patterns when AI is unavailable."""
    import re
    routes = []

    # FastAPI/Flask patterns
    patterns = [
        r'@(?:app|router)\.(get|post|put|delete|patch)\(["\']([^"\']+)',
        r'@(?:app|router)\.route\(["\']([^"\']+)["\'].*methods=\[([^\]]+)',
        r'app\.(get|post|put|delete|patch)\(["\']([^"\']+)',
    ]

    for pattern in patterns:
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for match in matches:
            groups = match.groups()
            if len(groups) >= 2:
                routes.append({
                    "method": groups[0].upper(),
                    "path": groups[1],
                    "handler": "unknown",
                    "description": "",
                })

    return routes


def _heuristic_repo_summary(files_info: List[Dict]) -> str:
    """Generate a basic repo summary from file info."""
    total = len(files_info)
    languages = {}
    for f in files_info:
        lang = f.get("language", "Unknown")
        languages[lang] = languages.get(lang, 0) + 1

    top_langs = sorted(languages.items(), key=lambda x: x[1], reverse=True)[:3]
    lang_str = ", ".join([f"{lang} ({count})" for lang, count in top_langs])

    return f"Repository with {total} files. Primary languages: {lang_str}."
