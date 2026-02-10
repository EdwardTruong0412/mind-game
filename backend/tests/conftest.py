import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_current_user, get_optional_user
from app.config import Settings, get_settings
from app.core.database import Base, get_db
from app.main import app
from app.models.leaderboard import UserStats
from app.models.user import DEFAULT_PREFERENCES, User

# Test database URL — uses a separate test database
TEST_DATABASE_URL = "postgresql+asyncpg://schulte:localdev@localhost:5432/schulte_test"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create tables, provide a session, then drop tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_factory() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        id=uuid.uuid4(),
        cognito_sub="test-cognito-sub-123",
        email="test@example.com",
        display_name="Test User",
        preferences=DEFAULT_PREFERENCES,
    )
    db_session.add(user)

    stats = UserStats(user_id=user.id)
    db_session.add(stats)

    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def client(
    db_session: AsyncSession,
    test_user: User,
) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client with auth and DB overrides."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def override_get_current_user() -> User:
        return test_user

    async def override_get_optional_user() -> User | None:
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_optional_user] = override_get_optional_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
