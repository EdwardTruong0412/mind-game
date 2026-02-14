import uuid
from datetime import date as Date

from pydantic import BaseModel, Field


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: uuid.UUID
    display_name: str | None
    best_time_ms: int
    date: Date

    model_config = {"from_attributes": True}


class CurrentUserRank(BaseModel):
    rank: int
    best_time_ms: int


class LeaderboardMeta(BaseModel):
    grid_size: int
    order_mode: str
    date: Date | None = None
    total_entries: int


class LeaderboardResponse(BaseModel):
    data: list[LeaderboardEntry]
    meta: LeaderboardMeta
    current_user: CurrentUserRank | None = None


class LeaderboardQuery(BaseModel):
    grid_size: int = Field(5, ge=4, le=10)
    order_mode: str = Field("ASC", pattern=r"^(ASC|DESC)$")
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)
