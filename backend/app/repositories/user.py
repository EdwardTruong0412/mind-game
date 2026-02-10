import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leaderboard import UserStats
from app.models.user import DEFAULT_PREFERENCES, User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_cognito_sub(self, cognito_sub: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.cognito_sub == cognito_sub)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(
        self,
        cognito_sub: str,
        email: str,
        display_name: str,
    ) -> User:
        user = User(
            cognito_sub=cognito_sub,
            email=email,
            display_name=display_name,
            preferences=DEFAULT_PREFERENCES,
        )
        self.db.add(user)
        await self.db.flush()

        # Create empty stats row
        stats = UserStats(user_id=user.id)
        self.db.add(stats)
        await self.db.flush()

        return user

    async def update_profile(
        self,
        user: User,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> User:
        if display_name is not None:
            user.display_name = display_name
        if avatar_url is not None:
            user.avatar_url = avatar_url
        await self.db.flush()
        return user

    async def update_preferences(self, user: User, updates: dict) -> dict:
        current = dict(user.preferences)
        current.update(updates)
        user.preferences = current
        await self.db.flush()
        return current

    async def get_stats(self, user_id: uuid.UUID) -> UserStats | None:
        result = await self.db.execute(
            select(UserStats).where(UserStats.user_id == user_id)
        )
        return result.scalar_one_or_none()
