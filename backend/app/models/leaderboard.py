import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DailyLeaderboard(Base):
    __tablename__ = "daily_leaderboards"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("training_sessions.id", ondelete="CASCADE"))
    grid_size: Mapped[int] = mapped_column(Integer)
    order_mode: Mapped[str] = mapped_column(String(10))
    best_time_ms: Mapped[int] = mapped_column(Integer)
    date: Mapped[date] = mapped_column(Date, index=True)

    user = relationship("User", back_populates="leaderboard_entries")
    session = relationship("TrainingSession")

    __table_args__ = (
        UniqueConstraint("user_id", "grid_size", "order_mode", "date", name="uq_daily_user_config"),
        Index("idx_daily_ranking", "date", "grid_size", "order_mode", "best_time_ms"),
    )


class UserStats(Base):
    __tablename__ = "user_stats"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    total_sessions: Mapped[int] = mapped_column(Integer, default=0)
    completed_sessions: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column()
    best_times: Mapped[dict] = mapped_column(JSONB, default=dict)
    avg_times: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="stats")
