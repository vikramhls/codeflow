"""Common utility functions."""

import re
from datetime import datetime, timezone


def utc_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def sanitize_string(text: str, max_length: int = 1000) -> str:
    """Sanitize and truncate a string."""
    if not text:
        return ""
    # Remove null bytes
    text = text.replace("\x00", "")
    # Truncate
    return text[:max_length].strip()


def is_valid_github_url(url: str) -> bool:
    """Validate if a string is a valid GitHub repository URL."""
    pattern = r'^(https?://)?(www\.)?github\.com/[\w\-\.]+/[\w\-\.]+/?$'
    return bool(re.match(pattern, url.strip()))


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def truncate_content(content: str, max_chars: int = 5000) -> str:
    """Truncate content with ellipsis."""
    if len(content) <= max_chars:
        return content
    return content[:max_chars] + "\n... (truncated)"
