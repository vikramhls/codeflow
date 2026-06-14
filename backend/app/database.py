"""Database initialization for MongoDB and Redis."""

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import redis.asyncio as aioredis
from typing import Optional
from redis.asyncio import Redis

from app.config import settings
from app.models.user import User
from app.models.repository import Repository
from app.models.file import RepoFile
from app.models.issue import Issue
from app.models.solution import Solution
from app.models.points import PointTransaction, Badge, UserBadge
from app.models.devops import DevOpsReportModel
from app.models.interview import MockInterviewModel

# Global connections
mongo_client: Optional[AsyncIOMotorClient] = None
redis_client: Optional[Redis] = None


async def init_db():
    """Initialize MongoDB connection and Beanie ODM."""
    global mongo_client
    mongo_client = AsyncIOMotorClient(settings.MONGODB_URL)
    database = mongo_client[settings.DATABASE_NAME]

    await init_beanie(
        database=database,
        document_models=[
            User,
            Repository,
            RepoFile,
            Issue,
            Solution,
            PointTransaction,
            Badge,
            UserBadge,
            DevOpsReportModel,
            MockInterviewModel,
        ],
    )

    return mongo_client


async def init_redis():
    """Initialize Redis connection."""
    global redis_client
    redis_client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    # Test connection
    await redis_client.ping()
    return redis_client


async def close_db():
    """Close MongoDB connection."""
    global mongo_client
    if mongo_client:
        mongo_client.close()


async def close_redis():
    """Close Redis connection."""
    global redis_client
    if redis_client:
        await redis_client.close()


def get_redis() -> aioredis.Redis:
    """Get Redis client instance."""
    return redis_client
