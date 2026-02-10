import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import TrainingSession


class SessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, session_id: uuid.UUID) -> TrainingSession | None:
        result = await self.db.execute(
            select(TrainingSession).where(TrainingSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_by_client_id(
        self, user_id: uuid.UUID, client_session_id: str
    ) -> TrainingSession | None:
        result = await self.db.execute(
            select(TrainingSession).where(
                TrainingSession.user_id == user_id,
                TrainingSession.client_session_id == client_session_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: uuid.UUID, data: dict) -> TrainingSession:
        session = TrainingSession(user_id=user_id, **data)
        self.db.add(session)
        await self.db.flush()
        return session

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        per_page: int = 20,
        grid_size: int | None = None,
        order_mode: str | None = None,
        status: str | None = None,
    ) -> tuple[list[TrainingSession], int]:
        query = select(TrainingSession).where(TrainingSession.user_id == user_id)

        if grid_size is not None:
            query = query.where(TrainingSession.grid_size == grid_size)
        if order_mode is not None:
            query = query.where(TrainingSession.order_mode == order_mode)
        if status is not None:
            query = query.where(TrainingSession.status == status)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Fetch page
        query = query.order_by(TrainingSession.started_at.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)
        result = await self.db.execute(query)

        return list(result.scalars().all()), total

    async def delete(self, session: TrainingSession) -> None:
        await self.db.delete(session)
        await self.db.flush()

    async def get_completed_for_config(
        self,
        user_id: uuid.UUID,
        grid_size: int,
        order_mode: str,
    ) -> list[TrainingSession]:
        result = await self.db.execute(
            select(TrainingSession).where(
                TrainingSession.user_id == user_id,
                TrainingSession.grid_size == grid_size,
                TrainingSession.order_mode == order_mode,
                TrainingSession.status == "completed",
            )
        )
        return list(result.scalars().all())

    async def count_for_user(self, user_id: uuid.UUID) -> tuple[int, int]:
        """Returns (total_sessions, completed_sessions)."""
        total_result = await self.db.execute(
            select(func.count()).where(TrainingSession.user_id == user_id)
        )
        total = total_result.scalar_one()

        completed_result = await self.db.execute(
            select(func.count()).where(
                TrainingSession.user_id == user_id,
                TrainingSession.status == "completed",
            )
        )
        completed = completed_result.scalar_one()

        return total, completed
