"""GitHub OAuth authentication routes."""

import json
from urllib.parse import urlencode
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.models.user import User
from app.services import github_service
from app.middleware.auth_middleware import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])



# ─── Response schemas ──────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    github_id: int
    username: str
    email: str | None = None
    name: str | None = None
    avatar_url: str
    bio: str | None = None
    github_url: str
    points: int
    repos_imported: int
    issues_created: int
    solutions_submitted: int
    solutions_accepted: int
    created_at: datetime
    last_login: datetime


# ─── Routes ────────────────────────────────────────────────────────────

@router.get("/github/login")
async def github_login():
    """Redirect to GitHub OAuth authorization page."""
    url = await github_service.get_authorize_url()
    return RedirectResponse(url=url)


@router.get("/github/callback")
async def github_callback(code: str = Query(...), state: str = Query(default="")):
    """Handle GitHub OAuth callback.

    Exchanges the authorization code for an access token,
    fetches user profile, creates/updates user in DB, and returns JWT tokens.
    """
    try:
        # Exchange code for GitHub access token
        github_token = await github_service.exchange_code_for_token(code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to authenticate with GitHub: {str(e)}",
        )

    # Fetch GitHub user profile
    try:
        profile = await github_service.get_user_profile(github_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch GitHub profile: {str(e)}",
        )

    github_id = profile["id"]
    username = profile["login"]

    # Try to get email
    email = profile.get("email")
    if not email:
        try:
            emails = await github_service.get_user_emails(github_token)
            primary = next((e for e in emails if e.get("primary")), None)
            if primary:
                email = primary["email"]
        except Exception:
            pass

    # Find or create user
    user = await User.find_one(User.github_id == github_id)

    if user:
        # Update existing user
        user.username = username
        user.email = email
        user.name = profile.get("name")
        user.avatar_url = profile.get("avatar_url", "")
        user.bio = profile.get("bio")
        user.github_url = profile.get("html_url", "")
        user.access_token = github_token
        user.last_login = datetime.now(timezone.utc)
        user.updated_at = datetime.now(timezone.utc)
        await user.save()
    else:
        # Create new user
        user = User(
            github_id=github_id,
            username=username,
            email=email,
            name=profile.get("name"),
            avatar_url=profile.get("avatar_url", ""),
            bio=profile.get("bio"),
            github_url=profile.get("html_url", ""),
            access_token=github_token,
        )
        await user.insert()

    # Generate JWT tokens
    token_data = {"sub": str(user.id), "username": user.username}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # ── Redirect to frontend with tokens in query params ──────────────
    user_payload = {
        "id": str(user.id),
        "username": user.username,
        "avatar_url": user.avatar_url,
        "email": user.email or "",
        "name": user.name or "",
    }

    params = urlencode({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": json.dumps(user_payload),
    })

    frontend_callback = f"{settings.FRONTEND_URL}/auth/callback?{params}"
    return RedirectResponse(url=frontend_callback)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(body: RefreshRequest):
    """Refresh an expired access token using a refresh token."""
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token type. Expected refresh token.",
        )

    user_id = payload.get("sub")
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    token_data = {"sub": str(user.id), "username": user.username}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": str(user.id),
            "username": user.username,
            "avatar_url": user.avatar_url,
            "email": user.email,
            "name": user.name,
        },
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    return UserResponse(
        id=str(current_user.id),
        github_id=current_user.github_id,
        username=current_user.username,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        bio=current_user.bio,
        github_url=current_user.github_url,
        points=current_user.points,
        repos_imported=current_user.repos_imported,
        issues_created=current_user.issues_created,
        solutions_submitted=current_user.solutions_submitted,
        solutions_accepted=current_user.solutions_accepted,
        created_at=current_user.created_at,
        last_login=current_user.last_login,
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout the current user (client should discard tokens)."""
    return {"message": "Logged out successfully"}
