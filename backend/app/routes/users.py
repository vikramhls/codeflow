"""User profile and dashboard routes."""

from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from beanie import PydanticObjectId

from app.models.user import User
from app.models.repository import Repository
from app.models.issue import Issue
from app.models.solution import Solution, SolutionStatus
from app.models.points import PointTransaction
from app.middleware.auth_middleware import get_current_user, get_optional_user

router = APIRouter(prefix="/users", tags=["Users"])


# ─── Response schemas ──────────────────────────────────────────────────

class PublicUserResponse(BaseModel):
    id: str
    username: str
    avatar_url: str
    bio: Optional[str] = None
    github_url: str
    points: int
    repos_imported: int
    solutions_accepted: int
    created_at: str


class DashboardResponse(BaseModel):
    user: dict
    stats: dict
    recent_repos: list
    recent_issues: list
    recent_solutions: list
    point_history: list


class LeaderboardEntry(BaseModel):
    id: str
    rank: int
    username: str
    avatar_url: str
    points: int
    solutions_accepted: int


class UserSolutionResponse(BaseModel):
    id: str
    issue_id: str
    issue_title: str
    repo_name: str
    description: str
    points_awarded: int
    github_pr_url: Optional[str] = None
    created_at: str



# ─── Routes ────────────────────────────────────────────────────────────

@router.get("/me/dashboard", response_model=DashboardResponse)
async def get_dashboard(current_user: User = Depends(get_current_user)):
    """Get the current user's dashboard with stats and recent activity."""

    # Recent repos
    repos = await Repository.find(
        Repository.owner_id == str(current_user.id)
    ).sort("-created_at").limit(5).to_list()

    # Recent issues created
    issues = await Issue.find(
        Issue.author_id == str(current_user.id)
    ).sort("-created_at").limit(5).to_list()

    # Recent solutions submitted
    solutions = await Solution.find(
        Solution.author_id == str(current_user.id)
    ).sort("-created_at").limit(5).to_list()

    # Point history
    point_history = await PointTransaction.find(
        PointTransaction.user_id == str(current_user.id)
    ).sort("-created_at").limit(10).to_list()

    # Total stats
    total_issues = await Issue.find(
        Issue.author_id == str(current_user.id)
    ).count()

    total_solutions = await Solution.find(
        Solution.author_id == str(current_user.id)
    ).count()

    accepted_solutions = await Solution.find(
        Solution.author_id == str(current_user.id),
        Solution.status == SolutionStatus.ACCEPTED,
    ).count()

    return DashboardResponse(
        user={
            "id": str(current_user.id),
            "username": current_user.username,
            "avatar_url": current_user.avatar_url,
            "email": current_user.email,
            "name": current_user.name,
            "points": current_user.points,
        },
        stats={
            "repos_imported": current_user.repos_imported,
            "total_issues": total_issues,
            "total_solutions": total_solutions,
            "accepted_solutions": accepted_solutions,
            "points": current_user.points,
        },
        recent_repos=[
            {
                "id": str(r.id),
                "name": f"{r.github_owner}/{r.github_repo}",
                "status": r.status.value,
                "total_files": r.total_files,
                "created_at": str(r.created_at),
            }
            for r in repos
        ],
        recent_issues=[
            {
                "id": str(i.id),
                "title": i.title,
                "status": i.status.value,
                "bounty_points": i.bounty_points,
                "solutions_count": i.solutions_count,
                "created_at": str(i.created_at),
            }
            for i in issues
        ],
        recent_solutions=[
            {
                "id": str(s.id),
                "issue_id": s.issue_id,
                "status": s.status.value,
                "points_awarded": s.points_awarded,
                "created_at": str(s.created_at),
            }
            for s in solutions
        ],
        point_history=[
            {
                "id": str(p.id),
                "amount": p.amount,
                "type": p.type.value,
                "description": p.description,
                "created_at": str(p.created_at),
            }
            for p in point_history
        ],
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
):
    """Get the platform leaderboard ranked by points."""
    users = await User.find().sort("-points").limit(limit).to_list()

    return [
        LeaderboardEntry(
            id=str(u.id),
            rank=idx + 1,
            username=u.username,
            avatar_url=u.avatar_url,
            points=u.points,
            solutions_accepted=u.solutions_accepted,
        )
        for idx, u in enumerate(users)
    ]


@router.get("/{user_id}", response_model=PublicUserResponse)
async def get_user_profile(
    user_id: PydanticObjectId,
    current_user: User = Depends(get_optional_user),
):
    """Get a user's public profile."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return PublicUserResponse(
        id=str(user.id),
        username=user.username,
        avatar_url=user.avatar_url,
        bio=user.bio,
        github_url=user.github_url,
        points=user.points,
        repos_imported=user.repos_imported,
        solutions_accepted=user.solutions_accepted,
        created_at=str(user.created_at),
    )


@router.get("/{user_id}/solutions", response_model=list[UserSolutionResponse])
async def get_user_solutions(
    user_id: PydanticObjectId,
):
    """Get the accepted solutions for a user to display on their portfolio."""
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    solutions = await Solution.find(
        Solution.author_id == user_id,
        Solution.status == SolutionStatus.ACCEPTED
    ).sort("-created_at").to_list()

    response_list = []
    for s in solutions:
        issue = await Issue.get(s.issue_id)
        repo_name = "Unknown Repo"
        issue_title = "Unknown Issue"
        if issue:
            issue_title = issue.title
            repo = await Repository.get(issue.repo_id)
            if repo:
                repo_name = f"{repo.github_owner}/{repo.github_repo}"

        response_list.append(UserSolutionResponse(
            id=str(s.id),
            issue_id=s.issue_id,
            issue_title=issue_title,
            repo_name=repo_name,
            description=s.description,
            points_awarded=s.points_awarded,
            github_pr_url=s.github_pr_url,
            created_at=str(s.created_at)
        ))

    return response_list
