"""CodeBounty API — Main FastAPI Application."""
# Trigger server reload

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, init_redis, close_db, close_redis

# Import all routers
from app.routes.auth import router as auth_router
from app.routes.repos import router as repos_router
from app.routes.files import router as files_router
from app.routes.issues import router as issues_router
from app.routes.solutions import router as solutions_router
from app.routes.users import router as users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # ── Startup ──
    print("Starting CodeBounty API...")

    # Initialize MongoDB
    try:
        await init_db()
        print("MongoDB connected")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        raise

    # Initialize Redis
    try:
        await init_redis()
        print("Redis connected")
    except Exception as e:
        print(f"Redis connection failed (caching disabled): {e}")

    print("CodeBounty API is ready!")
    print(f"API docs: http://localhost:8000/docs")

    yield

    # ── Shutdown ──
    print("Shutting down CodeBounty API...")
    await close_db()
    await close_redis()
    print("Goodbye!")


# ─── Create FastAPI app ───────────────────────────────────────────────

app = FastAPI(
    title="CodeBounty API",
    description="""
**CodeBounty** — A platform for collaborative code review and bug bounties.

### Features
- 🔐 GitHub OAuth authentication
- 📦 Import GitHub repositories
- 🔒 Control file visibility (public/private)
- 📋 List files on the platform for community review
- 🐛 Create issues and queries on code files
- 🔧 Submit bug fix solutions
- ⭐ Earn points and badges for accepted solutions
- 🤖 AI-powered file summaries
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS Middleware ──────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Include Routers ─────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(repos_router)
app.include_router(files_router)
app.include_router(issues_router)
app.include_router(solutions_router)
app.include_router(users_router)


# ─── Health Check ─────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    """API root — health check."""
    return {
        "name": "CodeBounty API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check endpoint."""
    from app.database import mongo_client, redis_client

    health = {
        "status": "healthy",
        "services": {
            "api": "up",
            "mongodb": "unknown",
            "redis": "unknown",
        },
    }

    # Check MongoDB
    try:
        if mongo_client:
            await mongo_client.admin.command("ping")
            health["services"]["mongodb"] = "up"
        else:
            health["services"]["mongodb"] = "down"
    except Exception:
        health["services"]["mongodb"] = "down"
        health["status"] = "degraded"

    # Check Redis
    try:
        if redis_client:
            await redis_client.ping()
            health["services"]["redis"] = "up"
        else:
            health["services"]["redis"] = "down"
    except Exception:
        health["services"]["redis"] = "down"
        health["status"] = "degraded"

    return health
