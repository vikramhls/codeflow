"""Redis caching service."""

import json
from typing import Optional, Any

from app.database import get_redis


async def cache_get(key: str) -> Optional[Any]:
    """Get a value from Redis cache."""
    redis = get_redis()
    if not redis:
        return None

    try:
        value = await redis.get(key)
        if value:
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        return None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Set a value in Redis cache with TTL (default 5 minutes)."""
    redis = get_redis()
    if not redis:
        return False

    try:
        if isinstance(value, (dict, list)):
            value = json.dumps(value, default=str)
        await redis.set(key, value, ex=ttl)
        return True
    except Exception:
        return False


async def cache_delete(key: str) -> bool:
    """Delete a key from Redis cache."""
    redis = get_redis()
    if not redis:
        return False

    try:
        await redis.delete(key)
        return True
    except Exception:
        return False


async def cache_delete_pattern(pattern: str) -> bool:
    """Delete all keys matching a pattern."""
    redis = get_redis()
    if not redis:
        return False

    try:
        keys = []
        async for key in redis.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis.delete(*keys)
        return True
    except Exception:
        return False


# Specific cache key builders
def user_cache_key(user_id: str) -> str:
    return f"user:{user_id}"


def repo_cache_key(repo_id: str) -> str:
    return f"repo:{repo_id}"


def repo_files_cache_key(repo_id: str) -> str:
    return f"repo_files:{repo_id}"


def file_summary_cache_key(file_id: str) -> str:
    return f"file_summary:{file_id}"


def github_tree_cache_key(owner: str, repo: str, branch: str) -> str:
    return f"gh_tree:{owner}/{repo}/{branch}"


async def invalidate_repo_cache(repo_id: str):
    """Invalidate all caches related to a repository."""
    await cache_delete(repo_cache_key(repo_id))
    await cache_delete(repo_files_cache_key(repo_id))
    await cache_delete_pattern(f"file_summary:*")
