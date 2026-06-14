"""Supabase storage service for file content storage."""

from typing import Optional
from app.config import settings

# Supabase client (lazy init)
_supabase_client = None
BUCKET_NAME = "repo-files"


def _get_client():
    """Get or create Supabase client."""
    global _supabase_client
    if _supabase_client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return None
        try:
            from supabase import create_client
            _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception as e:
            print(f"Warning: Supabase client init failed: {e}")
            return None
    return _supabase_client


async def upload_file(key: str, content: str, content_type: str = "text/plain") -> bool:
    """Upload file content to Supabase storage."""
    client = _get_client()
    if not client:
        return False

    try:
        content_bytes = content.encode("utf-8") if isinstance(content, str) else content
        client.storage.from_(BUCKET_NAME).upload(
            path=key,
            file=content_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        return True
    except Exception as e:
        print(f"Supabase upload error: {e}")
        return False


async def download_file(key: str) -> Optional[str]:
    """Download file content from Supabase storage."""
    client = _get_client()
    if not client:
        return None

    try:
        response = client.storage.from_(BUCKET_NAME).download(key)
        return response.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Supabase download error: {e}")
        return None


async def delete_file(key: str) -> bool:
    """Delete a file from Supabase storage."""
    client = _get_client()
    if not client:
        return False

    try:
        client.storage.from_(BUCKET_NAME).remove([key])
        return True
    except Exception as e:
        print(f"Supabase delete error: {e}")
        return False


async def get_public_url(key: str) -> Optional[str]:
    """Get a public URL for a stored file."""
    client = _get_client()
    if not client:
        return None

    try:
        result = client.storage.from_(BUCKET_NAME).get_public_url(key)
        return result
    except Exception:
        return None
