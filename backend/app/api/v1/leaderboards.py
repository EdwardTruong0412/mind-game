from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_optional_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.leaderboard import LeaderboardResponse
from app.services.leaderboard import LeaderboardService

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])


@router.get("/daily", response_model=LeaderboardResponse)
async def get_daily_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    grid_size: int = Query(5, ge=4, le=10),
    order_mode: str = Query("ASC", pattern=r"^(ASC|DESC)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> LeaderboardResponse:
    """Get today's leaderboard rankings."""
    service = LeaderboardService(db)
    return await service.get_daily(
        grid_size=grid_size,
        order_mode=order_mode,
        target_date=date.today(),
        limit=limit,
        offset=offset,
        current_user_id=current_user.id if current_user else None,
    )


@router.get("/daily/{target_date}", response_model=LeaderboardResponse)
async def get_daily_leaderboard_by_date(
    target_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    grid_size: int = Query(5, ge=4, le=10),
    order_mode: str = Query("ASC", pattern=r"^(ASC|DESC)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> LeaderboardResponse:
    """Get leaderboard rankings for a specific date."""
    service = LeaderboardService(db)
    return await service.get_daily(
        grid_size=grid_size,
        order_mode=order_mode,
        target_date=target_date,
        limit=limit,
        offset=offset,
        current_user_id=current_user.id if current_user else None,
    )


@router.get("/all-time", response_model=LeaderboardResponse)
async def get_all_time_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    grid_size: int = Query(5, ge=4, le=10),
    order_mode: str = Query("ASC", pattern=r"^(ASC|DESC)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> LeaderboardResponse:
    """Get all-time best leaderboard rankings."""
    service = LeaderboardService(db)
    return await service.get_all_time(
        grid_size=grid_size,
        order_mode=order_mode,
        limit=limit,
        offset=offset,
        current_user_id=current_user.id if current_user else None,
    )
