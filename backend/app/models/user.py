import uuid
from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

DEFAULT_PREFERENCES = {
    "theme": "system",
    "hapticFeedback": True,
    "soundEffects": False,
    "showHints": False,
    "showFixationDot": True,
    "defaultGridSize": 5,
    "defaultMaxTime": 120,
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cognito_sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    preferences: Mapped[dict] = mapped_column(JSONB, default=DEFAULT_PREFERENCES)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(onupdate=func.now())

    sessions = relationship("TrainingSession", back_populates="user", cascade="all, delete-orphan")
    stats = relationship("UserStats", back_populates="user", uselist=False, cascade="all, delete-orphan")
    leaderboard_entries = relationship("DailyLeaderboard", back_populates="user", cascade="all, delete-orphan")
