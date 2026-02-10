import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.leaderboard import LeaderboardRepository
from app.schemas.leaderboard import (
    CurrentUserRank,
    LeaderboardEntry,
    LeaderboardMeta,
    LeaderboardResponse,
)


class LeaderboardService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = LeaderboardRepository(db)

    async def get_daily(
        self,
        grid_size: int,
        order_mode: str,
        target_date: date,
        limit: int = 50,
        offset: int = 0,
        current_user_id: uuid.UUID | None = None,
    ) -> LeaderboardResponse:
        rows, total = await self.repo.get_daily_rankings(
            grid_size=grid_size,
            order_mode=order_mode,
            target_date=target_date,
            limit=limit,
            offset=offset,
        )

        entries = [
            LeaderboardEntry(
                rank=offset + i + 1,
                user_id=entry.user_id,
                display_name=display_name,
                best_time_ms=entry.best_time_ms,
                date=entry.date,
            )
            for i, (entry, display_name) in enumerate(rows)
        ]

        current_user = None
        if current_user_id:
            rank_data = await self.repo.get_user_rank_daily(
                current_user_id, grid_size, order_mode, target_date
            )
            if rank_data:
                current_user = CurrentUserRank(rank=rank_data[0], best_time_ms=rank_data[1])

        return LeaderboardResponse(
            data=entries,
            meta=LeaderboardMeta(
                grid_size=grid_size,
                order_mode=order_mode,
                date=target_date,
                total_entries=total,
            ),
            current_user=current_user,
        )

    async def get_all_time(
        self,
        grid_size: int,
        order_mode: str,
        limit: int = 50,
        offset: int = 0,
        current_user_id: uuid.UUID | None = None,
    ) -> LeaderboardResponse:
        rows, total = await self.repo.get_all_time_rankings(
            grid_size=grid_size,
            order_mode=order_mode,
            limit=limit,
            offset=offset,
        )

        entries = [
            LeaderboardEntry(
                rank=offset + i + 1,
                user_id=user_id,
                display_name=display_name,
                best_time_ms=best_time_ms,
                date=date.today(),  # Placeholder for all-time
            )
            for i, (user_id, display_name, best_time_ms) in enumerate(rows)
        ]

        return LeaderboardResponse(
            data=entries,
            meta=LeaderboardMeta(
                grid_size=grid_size,
                order_mode=order_mode,
                total_entries=total,
            ),
            current_user=None,  # Could be added if needed
        )
