"""Initial schema - users, sessions, leaderboards, stats

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cognito_sub", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("preferences", postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("cognito_sub", name="uq_users_cognito_sub"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_cognito_sub", "users", ["cognito_sub"])
    op.create_index("ix_users_email", "users", ["email"])

    # Training sessions table
    op.create_table(
        "training_sessions",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("client_session_id", sa.String(255), nullable=False),
        sa.Column("grid_size", sa.Integer(), nullable=False),
        sa.Column("max_time", sa.Integer(), nullable=False),
        sa.Column("order_mode", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("completion_time_ms", sa.Integer(), nullable=True),
        sa.Column("mistakes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("tap_events", postgresql.JSONB(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_training_sessions"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_training_sessions_user_id_users", ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "client_session_id", name="uq_session_user_client"),
    )
    op.create_index("idx_sessions_user_started", "training_sessions", ["user_id", "started_at"])
    op.create_index(
        "idx_sessions_leaderboard",
        "training_sessions",
        ["grid_size", "order_mode", "status", "completion_time_ms"],
        postgresql_where=sa.text("status = 'completed'"),
    )

    # Daily leaderboards table
    op.create_table(
        "daily_leaderboards",
        sa.Column("id", sa.Uuid(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("grid_size", sa.Integer(), nullable=False),
        sa.Column("order_mode", sa.String(10), nullable=False),
        sa.Column("best_time_ms", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_daily_leaderboards"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_daily_leaderboards_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["training_sessions.id"], name="fk_daily_leaderboards_session_id_training_sessions", ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "grid_size", "order_mode", "date", name="uq_daily_user_config"),
    )
    op.create_index("ix_daily_leaderboards_user_id", "daily_leaderboards", ["user_id"])
    op.create_index("ix_daily_leaderboards_date", "daily_leaderboards", ["date"])
    op.create_index("idx_daily_ranking", "daily_leaderboards", ["date", "grid_size", "order_mode", "best_time_ms"])

    # User stats table
    op.create_table(
        "user_stats",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("total_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("best_times", postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column("avg_times", postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", name="pk_user_stats"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_stats_user_id_users", ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("user_stats")
    op.drop_table("daily_leaderboards")
    op.drop_table("training_sessions")
    op.drop_table("users")
