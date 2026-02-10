import uuid
from datetime import UTC, date, datetime

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import TrainingSession
from app.repositories.leaderboard import LeaderboardRepository
from app.repositories.session import SessionRepository
from app.schemas.session import SessionCreate
from app.services.stats import StatsService

logger = structlog.get_logger()


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.session_repo = SessionRepository(db)
        self.leaderboard_repo = LeaderboardRepository(db)
        self.stats_service = StatsService(db)

    async def create_session(
        self, user_id: uuid.UUID, data: SessionCreate
    ) -> tuple[TrainingSession, bool]:
        """
        Create a training session. Returns (session, created).
        If session with same client_session_id exists, returns existing (idempotent).
        """
        existing = await self.session_repo.get_by_client_id(
            user_id, data.client_session_id
        )
        if existing:
            return existing, False

        # Serialize tap events
        tap_events = [e.model_dump(by_alias=True) for e in data.tap_events]

        session = await self.session_repo.create(
            user_id=user_id,
            data={
                "client_session_id": data.client_session_id,
                "grid_size": data.grid_size,
                "max_time": data.max_time,
                "order_mode": data.order_mode,
                "status": data.status,
                "completion_time_ms": data.completion_time_ms,
                "mistakes": data.mistakes,
                "accuracy": data.accuracy,
                "tap_events": tap_events,
                "started_at": data.started_at,
                "completed_at": data.completed_at,
            },
        )

        # Update stats and leaderboard for completed sessions
        if data.status == "completed" and data.completion_time_ms is not None:
            await self.stats_service.update_on_session_save(
                user_id=user_id,
                grid_size=data.grid_size,
                order_mode=data.order_mode,
                status=data.status,
                completion_time_ms=data.completion_time_ms,
            )

            today = date.today()
            await self.leaderboard_repo.upsert_daily_entry(
                user_id=user_id,
                session_id=session.id,
                grid_size=data.grid_size,
                order_mode=data.order_mode,
                best_time_ms=data.completion_time_ms,
                target_date=today,
            )
        else:
            # Non-completed sessions still increment total_sessions
            await self.stats_service.update_on_session_save(
                user_id=user_id,
                grid_size=data.grid_size,
                order_mode=data.order_mode,
                status=data.status,
                completion_time_ms=None,
            )

        logger.info(
            "session_created",
            user_id=str(user_id),
            session_id=str(session.id),
            grid_size=data.grid_size,
            status=data.status,
        )
        return session, True

    async def get_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> TrainingSession | None:
        session = await self.session_repo.get_by_id(session_id)
        if session and session.user_id == user_id:
            return session
        return None

    async def list_sessions(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        per_page: int = 20,
        grid_size: int | None = None,
        order_mode: str | None = None,
        status: str | None = None,
    ) -> tuple[list[TrainingSession], int]:
        return await self.session_repo.list_for_user(
            user_id=user_id,
            page=page,
            per_page=per_page,
            grid_size=grid_size,
            order_mode=order_mode,
            status=status,
        )

    async def delete_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        session = await self.session_repo.get_by_id(session_id)
        if not session or session.user_id != user_id:
            return False

        # Remove leaderboard entry if this session was referenced
        await self.leaderboard_repo.delete_for_session(session_id)

        await self.session_repo.delete(session)

        # Recalculate stats from scratch
        await self.stats_service.full_recalculate(user_id)

        logger.info("session_deleted", user_id=str(user_id), session_id=str(session_id))
        return True

    async def bulk_sync(
        self, user_id: uuid.UUID, sessions: list[SessionCreate]
    ) -> tuple[int, int]:
        """Bulk sync sessions. Returns (synced, skipped)."""
        synced = 0
        skipped = 0

        for session_data in sessions:
            _, created = await self.create_session(user_id, session_data)
            if created:
                synced += 1
            else:
                skipped += 1

        logger.info(
            "bulk_sync_complete",
            user_id=str(user_id),
            synced=synced,
            skipped=skipped,
        )
        return synced, skipped
