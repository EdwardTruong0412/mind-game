import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TapEventSchema(BaseModel):
    cell_index: int = Field(..., ge=0, alias="cellIndex")
    expected_value: int = Field(..., alias="expectedValue")
    tapped_value: int = Field(..., alias="tappedValue")
    correct: bool
    timestamp_ms: int = Field(..., ge=0, alias="timestampMs")

    model_config = {"populate_by_name": True}


class SessionCreate(BaseModel):
    client_session_id: str = Field(..., min_length=1, max_length=255)
    grid_size: int = Field(..., ge=4, le=10)
    max_time: int = Field(..., ge=30, le=600)
    order_mode: str = Field(..., pattern=r"^(ASC|DESC)$")
    status: str = Field(..., pattern=r"^(completed|timeout|abandoned)$")
    completion_time_ms: int | None = Field(None, ge=0)
    mistakes: int = Field(0, ge=0)
    accuracy: float = Field(..., ge=0, le=100)
    tap_events: list[TapEventSchema]
    started_at: datetime
    completed_at: datetime | None = None


class SessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    client_session_id: str
    grid_size: int
    max_time: int
    order_mode: str
    status: str
    completion_time_ms: int | None
    mistakes: int
    accuracy: float | None
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailResponse(SessionResponse):
    tap_events: list[dict] | None


class BulkSyncRequest(BaseModel):
    sessions: list[SessionCreate] = Field(..., max_length=100)


class BulkSyncResponse(BaseModel):
    synced: int
    skipped: int
