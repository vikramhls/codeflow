"""File processing service — import, visibility, storage orchestration."""

import hashlib
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict

from app.models.repository import Repository, RepoStatus
from app.models.file import RepoFile, FileVisibility
from app.services import github_service, storage_service, summary_service, cache_service


# Language detection map
EXTENSION_LANGUAGE_MAP = {
    ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
    ".jsx": "JSX", ".tsx": "TSX", ".java": "Java", ".kt": "Kotlin",
    ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".php": "PHP",
    ".c": "C", ".cpp": "C++", ".cs": "C#", ".swift": "Swift",
    ".dart": "Dart", ".r": "R", ".scala": "Scala", ".lua": "Lua",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".less": "LESS",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
    ".xml": "XML", ".md": "Markdown", ".txt": "Text",
    ".sql": "SQL", ".sh": "Shell", ".bash": "Bash", ".ps1": "PowerShell",
    ".dockerfile": "Dockerfile", ".vue": "Vue", ".svelte": "Svelte",
}

# Skip these file extensions during import (binary/large files)
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".bmp", ".webp",
    ".mp3", ".mp4", ".avi", ".mov", ".wav",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".woff", ".woff2", ".ttf", ".eot",
    ".pyc", ".class", ".o", ".obj",
    ".lock",
}

# Max file size to import (500KB)
MAX_FILE_SIZE = 500_000


def detect_language(filename: str) -> str:
    """Detect programming language from file extension."""
    _, ext = os.path.splitext(filename.lower())
    return EXTENSION_LANGUAGE_MAP.get(ext, "")


def should_skip_file(path: str, size: int = 0) -> bool:
    """Check if a file should be skipped during import."""
    _, ext = os.path.splitext(path.lower())
    filename = os.path.basename(path).lower()

    # Skip by extension
    if ext in SKIP_EXTENSIONS:
        return True

    # Skip hidden files and directories
    parts = path.split("/")
    if any(part.startswith(".") and part not in (".env.example",) for part in parts):
        return True

    # Skip node_modules, __pycache__, etc.
    skip_dirs = {"node_modules", "__pycache__", ".git", "dist", "build", "vendor", ".next", "venv", ".venv"}
    if any(part in skip_dirs for part in parts):
        return True

    # Skip by size
    if size > MAX_FILE_SIZE:
        return True

    return False


async def import_repo_files(repo: Repository, access_token: str) -> int:
    """Import all files from a GitHub repository.

    Returns the number of files imported.
    """
    try:
        # Update status
        repo.status = RepoStatus.IMPORTING
        await repo.save()

        # Get the file tree
        tree = await github_service.get_repo_tree(
            access_token, repo.github_owner, repo.github_repo, repo.branch
        )

        imported_count = 0
        total_files = 0

        for item in tree:
            path = item.get("path", "")
            size = item.get("size", 0)

            if should_skip_file(path, size):
                continue

            total_files += 1

            try:
                # Fetch file content from GitHub
                content = await github_service.get_file_content(
                    access_token, repo.github_owner, repo.github_repo, path, repo.branch
                )

                if content is None:
                    continue

                filename = os.path.basename(path)
                _, ext = os.path.splitext(filename)
                language = detect_language(filename)
                content_hash = hashlib.sha256(content.encode()).hexdigest()

                # Storage key for Supabase
                storage_key = f"{repo.owner_id}/{str(repo.id)}/{path}"

                # Try to upload to Supabase
                uploaded = await storage_service.upload_file(storage_key, content)

                # Create file record
                repo_file = RepoFile(
                    repo_id=str(repo.id),
                    owner_id=repo.owner_id,
                    path=path,
                    filename=filename,
                    extension=ext,
                    language=language,
                    content_hash=content_hash,
                    storage_key=storage_key if uploaded else "",
                    size_bytes=len(content.encode("utf-8")),
                    content=content if not uploaded else None,  # Store in DB if Supabase fails
                    visibility=FileVisibility.PRIVATE,
                    is_listed=False,
                )
                await repo_file.insert()
                imported_count += 1

            except Exception as e:
                print(f"Error importing file {path}: {e}")
                continue

        # Update repo stats
        repo.status = RepoStatus.READY
        repo.total_files = imported_count
        repo.private_files_count = imported_count
        repo.public_files_count = 0
        repo.listed_files_count = 0
        repo.is_synced = True
        repo.last_synced_at = datetime.now(timezone.utc)
        repo.updated_at = datetime.now(timezone.utc)
        await repo.save()

        # Invalidate cache
        await cache_service.invalidate_repo_cache(str(repo.id))

        return imported_count

    except Exception as e:
        repo.status = RepoStatus.ERROR
        repo.error_message = str(e)
        await repo.save()
        raise


async def generate_file_summaries(repo_id: str) -> int:
    """Generate AI summaries for all files in a repository.

    Returns the number of summaries generated.
    """
    files = await RepoFile.find(RepoFile.repo_id == repo_id).to_list()
    count = 0

    for file in files:
        try:
            content = await get_file_content(file)
            if not content:
                continue

            # Generate summary
            summary = await summary_service.generate_file_summary(
                content, file.filename, file.language
            )
            file.summary = summary

            # Extract routes for API files
            if file.language in ("Python", "JavaScript", "TypeScript", "Go", "Java"):
                route_info = await summary_service.extract_route_info(
                    content, file.filename, file.language
                )
                if route_info:
                    file.route_info = route_info

            file.updated_at = datetime.now(timezone.utc)
            await file.save()
            count += 1

        except Exception as e:
            print(f"Error generating summary for {file.path}: {e}")
            continue

    return count


async def get_file_content(file: RepoFile) -> Optional[str]:
    """Get file content from Supabase or DB fallback."""
    # Try DB content first (fallback storage)
    if file.content:
        return file.content

    # Try Supabase
    if file.storage_key:
        content = await storage_service.download_file(file.storage_key)
        if content:
            return content

    return None


async def update_visibility(
    file: RepoFile, visibility: FileVisibility
) -> RepoFile:
    """Update a file's visibility setting."""
    old_visibility = file.visibility
    file.visibility = visibility
    file.updated_at = datetime.now(timezone.utc)
    await file.save()

    # Update repo counts
    if old_visibility != visibility:
        repo = await Repository.get(file.repo_id)
        if repo:
            if visibility == FileVisibility.PUBLIC:
                repo.public_files_count += 1
                repo.private_files_count -= 1
            else:
                repo.public_files_count -= 1
                repo.private_files_count += 1
            repo.updated_at = datetime.now(timezone.utc)
            await repo.save()

    return file


async def update_listing(file: RepoFile, is_listed: bool) -> RepoFile:
    """Update whether a file is listed on the platform."""
    old_listed = file.is_listed
    file.is_listed = is_listed
    file.updated_at = datetime.now(timezone.utc)
    await file.save()

    # Update repo counts
    if old_listed != is_listed:
        repo = await Repository.get(file.repo_id)
        if repo:
            if is_listed:
                repo.listed_files_count += 1
            else:
                repo.listed_files_count -= 1
            repo.updated_at = datetime.now(timezone.utc)
            await repo.save()

    return file


async def bulk_update_visibility(
    file_ids: List[str], visibility: FileVisibility, owner_id: str
) -> int:
    """Bulk update visibility for multiple files. Returns count updated."""
    count = 0
    for file_id in file_ids:
        file = await RepoFile.get(file_id)
        if file and file.owner_id == owner_id:
            await update_visibility(file, visibility)
            count += 1
    return count


async def bulk_update_listing(
    file_ids: List[str], is_listed: bool, owner_id: str
) -> int:
    """Bulk update listing status for multiple files. Returns count updated."""
    count = 0
    for file_id in file_ids:
        file = await RepoFile.get(file_id)
        if file and file.owner_id == owner_id:
            await update_listing(file, is_listed)
            count += 1
    return count
