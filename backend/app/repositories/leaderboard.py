import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leaderboard import DailyLeaderboard
from app.models.user import User


class LeaderboardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_daily_entry(
        self,
        user_id: uuid.UUID,
        grid_size: int,
        order_mode: str,
        target_date: date,
    ) -> DailyLeaderboard | None:
        result = await self.db.execute(
            select(DailyLeaderboard).where(
                DailyLeaderboard.user_id == user_id,
                DailyLeaderboard.grid_size == grid_size,
                DailyLeaderboard.order_mode == order_mode,
                DailyLeaderboard.date == target_date,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_daily_entry(
        self,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        grid_size: int,
        order_mode: str,
        best_time_ms: int,
        target_date: date,
    ) -> DailyLeaderboard:
        existing = await self.get_daily_entry(user_id, grid_size, order_mode, target_date)

        if existing is None:
            entry = DailyLeaderboard(
                user_id=user_id,
                session_id=session_id,
                grid_size=grid_size,
                order_mode=order_mode,
                best_time_ms=best_time_ms,
                date=target_date,
            )
            self.db.add(entry)
            await self.db.flush()
            return entry

        if best_time_ms < existing.best_time_ms:
            existing.best_time_ms = best_time_ms
            existing.session_id = session_id
            await self.db.flush()

        return existing

    async def get_daily_rankings(
        self,
        grid_size: int,
        order_mode: str,
        target_date: date,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[tuple[DailyLeaderboard, str | None]], int]:
        """Returns list of (entry, display_name) tuples and total count."""
        query = (
            select(DailyLeaderboard, User.display_name)
            .join(User, DailyLeaderboard.user_id == User.id)
            .where(
                DailyLeaderboard.date == target_date,
                DailyLeaderboard.grid_size == grid_size,
                DailyLeaderboard.order_mode == order_mode,
            )
            .order_by(DailyLeaderboard.best_time_ms.asc())
        )

        # Count
        count_query = (
            select(func.count())
            .select_from(DailyLeaderboard)
            .where(
                DailyLeaderboard.date == target_date,
                DailyLeaderboard.grid_size == grid_size,
                DailyLeaderboard.order_mode == order_mode,
            )
        )
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Fetch page
        result = await self.db.execute(query.offset(offset).limit(limit))
        rows = [(row[0], row[1]) for row in result.all()]

        return rows, total

    async def get_all_time_rankings(
        self,
        grid_size: int,
        order_mode: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[tuple[uuid.UUID, str | None, int]], int]:
        """Returns list of (user_id, display_name, best_time_ms) and total count."""
        # Subquery: best time per user across all dates
        subq = (
            select(
                DailyLeaderboard.user_id,
                func.min(DailyLeaderboard.best_time_ms).label("best_time_ms"),
            )
            .where(
                DailyLeaderboard.grid_size == grid_size,
                DailyLeaderboard.order_mode == order_mode,
            )
            .group_by(DailyLeaderboard.user_id)
            .subquery()
        )

        query = (
            select(subq.c.user_id, User.display_name, subq.c.best_time_ms)
            .join(User, subq.c.user_id == User.id)
            .order_by(subq.c.best_time_ms.asc())
        )

        # Count
        count_query = select(func.count()).select_from(subq)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        result = await self.db.execute(query.offset(offset).limit(limit))
        rows = [(row[0], row[1], row[2]) for row in result.all()]

        return rows, total

    async def get_user_rank_daily(
        self,
        user_id: uuid.UUID,
        grid_size: int,
        order_mode: str,
        target_date: date,
    ) -> tuple[int, int] | None:
        """Returns (rank, best_time_ms) or None if user has no entry."""
        entry = await self.get_daily_entry(user_id, grid_size, order_mode, target_date)
        if entry is None:
            return None

        # Count how many entries are faster
        faster_count = await self.db.execute(
            select(func.count()).where(
                DailyLeaderboard.date == target_date,
                DailyLeaderboard.grid_size == grid_size,
                DailyLeaderboard.order_mode == order_mode,
                DailyLeaderboard.best_time_ms < entry.best_time_ms,
            )
        )
        rank = faster_count.scalar_one() + 1
        return rank, entry.best_time_ms

    async def delete_for_session(self, session_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(DailyLeaderboard).where(DailyLeaderboard.session_id == session_id)
        )
        entry = result.scalar_one_or_none()
        if entry:
            await self.db.delete(entry)
            await self.db.flush()
