import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    client_session_id: Mapped[str] = mapped_column(String(255))
    grid_size: Mapped[int] = mapped_column(Integer)
    max_time: Mapped[int] = mapped_column(Integer)
    order_mode: Mapped[str] = mapped_column(String(10))  # ASC or DESC
    status: Mapped[str] = mapped_column(String(20))  # completed, timeout, abandoned
    completion_time_ms: Mapped[int | None] = mapped_column(Integer)
    mistakes: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float | None] = mapped_column(Float)
    tap_events: Mapped[list | None] = mapped_column(JSONB)
    started_at: Mapped[datetime] = mapped_column()
    completed_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user = relationship("User", back_populates="sessions")

    __table_args__ = (
        UniqueConstraint("user_id", "client_session_id", name="uq_session_user_client"),
        Index(
            "idx_sessions_leaderboard",
            "grid_size",
            "order_mode",
            "status",
            "completion_time_ms",
            postgresql_where=(status == "completed"),
        ),
        Index("idx_sessions_user_started", "user_id", "started_at"),
    )
