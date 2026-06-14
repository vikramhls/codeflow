"""GitHub API service for OAuth and repository operations."""

import base64
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

import httpx

from app.config import settings


GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_URL = "https://api.github.com"


async def get_authorize_url(state: Optional[str] = None) -> str:
    """Generate GitHub OAuth authorization URL."""
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "read:user user:email repo",
        "state": state or "codebounty",
    }
    return f"{GITHUB_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> str:
    """Exchange OAuth authorization code for access token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            raise Exception(f"GitHub OAuth error: {data['error_description']}")

        return data["access_token"]


async def get_user_profile(access_token: str) -> Dict[str, Any]:
    """Fetch GitHub user profile."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        response.raise_for_status()
        return response.json()


async def get_user_emails(access_token: str) -> List[Dict[str, Any]]:
    """Fetch GitHub user emails."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/user/emails",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        response.raise_for_status()
        return response.json()


async def get_repo_info(access_token: str, owner: str, repo: str) -> Dict[str, Any]:
    """Fetch repository metadata."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        response.raise_for_status()
        return response.json()


async def get_repo_tree(
    access_token: str, owner: str, repo: str, branch: str = "main"
) -> List[Dict[str, Any]]:
    """Fetch complete repository file tree (recursive)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        response.raise_for_status()
        data = response.json()

        # Filter only blobs (files), not trees (directories)
        files = [
            item for item in data.get("tree", []) if item.get("type") == "blob"
        ]
        return files


async def get_file_content(
    access_token: str, owner: str, repo: str, path: str, branch: str = "main"
) -> Optional[str]:
    """Fetch a single file's content from GitHub (base64 decoded)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{path}?ref={branch}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )

        if response.status_code == 404:
            return None

        response.raise_for_status()
        data = response.json()

        if data.get("encoding") == "base64" and data.get("content"):
            try:
                return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            except Exception:
                return None

        return None


async def get_default_branch(access_token: str, owner: str, repo: str) -> str:
    """Get the default branch of a repository."""
    repo_info = await get_repo_info(access_token, owner, repo)
    return repo_info.get("default_branch", "main")


async def get_branch_ref(access_token: str, owner: str, repo: str, branch: str) -> str:
    """Get the SHA of a branch."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}/git/refs/heads/{branch}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        response.raise_for_status()
        return response.json()["object"]["sha"]


async def create_branch(access_token: str, owner: str, repo: str, new_branch: str, sha: str) -> None:
    """Create a new branch from a SHA."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}/git/refs",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
            json={
                "ref": f"refs/heads/{new_branch}",
                "sha": sha,
            }
        )
        response.raise_for_status()


async def get_file_sha(access_token: str, owner: str, repo: str, path: str, branch: str) -> Optional[str]:
    """Get the SHA of a specific file."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{path}?ref={branch}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json().get("sha")


async def update_file(
    access_token: str, owner: str, repo: str, path: str, message: str, content: str, branch: str, sha: Optional[str]
) -> None:
    """Create or update a file on a specific branch."""
    async with httpx.AsyncClient() as client:
        payload = {
            "message": message,
            "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha
            
        response = await client.put(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{path}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
            json=payload,
        )
        response.raise_for_status()


async def create_pull_request(
    access_token: str, owner: str, repo: str, title: str, body: str, head: str, base: str
) -> str:
    """Create a pull request and return its HTML URL."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
            json={
                "title": title,
                "body": body,
                "head": head,
                "base": base,
            }
        )
        response.raise_for_status()
        return response.json()["html_url"]



def parse_github_url(url: str) -> tuple[str, str]:
    """Parse a GitHub URL to extract owner and repo name.

    Supports formats:
        - https://github.com/owner/repo
        - https://github.com/owner/repo.git
        - github.com/owner/repo
        - owner/repo
    """
    url = url.strip().rstrip("/")

    # Remove .git suffix
    if url.endswith(".git"):
        url = url[:-4]

    # Remove protocol and domain
    if "github.com" in url:
        parts = url.split("github.com/")[-1].split("/")
    else:
        parts = url.split("/")

    if len(parts) < 2:
        raise ValueError(f"Invalid GitHub URL: {url}")

    owner = parts[0]
    repo = parts[1]

    if not owner or not repo:
        raise ValueError(f"Invalid GitHub URL: {url}")

    return owner, repo
