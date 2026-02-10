import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import (
    UpdatePreferencesRequest,
    UpdateProfileRequest,
    UserPreferences,
    UserProfileResponse,
    UserPublicResponse,
    UserStatsSchema,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Get current user's profile with preferences and stats."""
    user_repo = UserRepository(db)
    stats = await user_repo.get_stats(current_user.id)

    stats_data = UserStatsSchema()
    if stats:
        stats_data = UserStatsSchema(
            totalSessions=stats.total_sessions,
            completedSessions=stats.completed_sessions,
            currentStreak=stats.current_streak,
            longestStreak=stats.longest_streak,
            lastPlayedAt=stats.last_played_at,
            bestTimes=stats.best_times or {},
            avgTimes=stats.avg_times or {},
        )

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        avatar_url=current_user.avatar_url,
        preferences=UserPreferences(**(current_user.preferences or {})),
        stats=stats_data,
        created_at=current_user.created_at,
    )


@router.patch("/me", response_model=UserProfileResponse)
async def update_my_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """Update current user's display name or avatar."""
    user_repo = UserRepository(db)
    await user_repo.update_profile(
        user=current_user,
        display_name=body.display_name,
        avatar_url=body.avatar_url,
    )
    # Re-fetch full profile
    return await get_my_profile(current_user=current_user, db=db)


@router.patch("/me/preferences", response_model=UserPreferences)
async def update_my_preferences(
    body: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferences:
    """Update user preferences (partial merge)."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return UserPreferences(**(current_user.preferences or {}))

    user_repo = UserRepository(db)
    updated = await user_repo.update_preferences(current_user, updates)
    return UserPreferences(**updated)


@router.get("/{user_id}", response_model=UserPublicResponse)
async def get_public_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> UserPublicResponse:
    """Get a user's public profile (for leaderboard)."""
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise NotFoundError("User not found")

    return UserPublicResponse(
        id=user.id,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )
