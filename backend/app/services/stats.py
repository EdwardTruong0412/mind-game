import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leaderboard import UserStats
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository


class StatsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.session_repo = SessionRepository(db)

    async def update_on_session_save(
        self,
        user_id: uuid.UUID,
        grid_size: int,
        order_mode: str,
        status: str,
        completion_time_ms: int | None,
    ) -> None:
        """Update user stats after a session is saved."""
        stats = await self.user_repo.get_stats(user_id)
        if stats is None:
            stats = UserStats(user_id=user_id)
            self.db.add(stats)
            await self.db.flush()

        stats.total_sessions += 1

        if status == "completed" and completion_time_ms is not None:
            stats.completed_sessions += 1

            # Update best time
            key = f"{grid_size}-{order_mode}"
            best_times = dict(stats.best_times)
            if key not in best_times or completion_time_ms < best_times[key]:
                best_times[key] = completion_time_ms
            stats.best_times = best_times

            # Recalculate average time
            completed = await self.session_repo.get_completed_for_config(
                user_id, grid_size, order_mode
            )
            if completed:
                avg = sum(
                    s.completion_time_ms for s in completed if s.completion_time_ms
                ) / len(completed)
                avg_times = dict(stats.avg_times)
                avg_times[key] = round(avg)
                stats.avg_times = avg_times

            # Update streak
            now = datetime.now(UTC)
            new_streak = _calculate_streak(stats.last_played_at, stats.current_streak, now)
            stats.current_streak = new_streak
            if new_streak > stats.longest_streak:
                stats.longest_streak = new_streak
            stats.last_played_at = now

        await self.db.flush()

    async def full_recalculate(self, user_id: uuid.UUID) -> None:
        """Full recalculation of all stats from session history. Used after deletes."""
        stats = await self.user_repo.get_stats(user_id)
        if stats is None:
            return

        total, completed = await self.session_repo.count_for_user(user_id)
        stats.total_sessions = total
        stats.completed_sessions = completed

        # Recalculate best/avg times for all configs
        best_times: dict[str, int] = {}
        avg_times: dict[str, int] = {}

        # Get all unique configs for this user
        from sqlalchemy import distinct, select

        from app.models.session import TrainingSession

        configs_result = await self.db.execute(
            select(
                distinct(TrainingSession.grid_size),
                TrainingSession.order_mode,
            ).where(
                TrainingSession.user_id == user_id,
                TrainingSession.status == "completed",
            )
        )

        for grid_size, order_mode in configs_result.all():
            key = f"{grid_size}-{order_mode}"
            sessions = await self.session_repo.get_completed_for_config(
                user_id, grid_size, order_mode
            )
            times = [s.completion_time_ms for s in sessions if s.completion_time_ms]
            if times:
                best_times[key] = min(times)
                avg_times[key] = round(sum(times) / len(times))

        stats.best_times = best_times
        stats.avg_times = avg_times

        # Recalculate streak from scratch — simplified: just reset based on last session
        from app.models.session import TrainingSession

        last_session_result = await self.db.execute(
            select(TrainingSession.started_at)
            .where(
                TrainingSession.user_id == user_id,
                TrainingSession.status == "completed",
            )
            .order_by(TrainingSession.started_at.desc())
            .limit(1)
        )
        last_row = last_session_result.first()
        if last_row:
            stats.last_played_at = last_row[0]
            now = datetime.now(UTC)
            days_since = (now.date() - last_row[0].date()).days
            if days_since <= 1:
                stats.current_streak = max(stats.current_streak, 1)
            else:
                stats.current_streak = 0
        else:
            stats.last_played_at = None
            stats.current_streak = 0

        await self.db.flush()


def _calculate_streak(
    last_played_at: datetime | None,
    current_streak: int,
    now: datetime,
) -> int:
    """Calculate the new streak value."""
    if last_played_at is None:
        return 1

    today = now.date()
    last_date = last_played_at.date()
    days_diff = (today - last_date).days

    if days_diff == 0:
        return max(current_streak, 1)
    elif days_diff == 1:
        return current_streak + 1
    else:
        return 1
