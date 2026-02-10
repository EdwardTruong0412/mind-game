import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    theme: str = "system"
    hapticFeedback: bool = True
    soundEffects: bool = False
    showHints: bool = False
    showFixationDot: bool = True
    defaultGridSize: int = Field(5, ge=4, le=10)
    defaultMaxTime: int = Field(120, ge=30, le=600)


class UserStatsSchema(BaseModel):
    totalSessions: int = 0
    completedSessions: int = 0
    currentStreak: int = 0
    longestStreak: int = 0
    lastPlayedAt: datetime | None = None
    bestTimes: dict[str, int] = {}
    avgTimes: dict[str, int] = {}


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str | None
    display_name: str | None
    avatar_url: str | None
    preferences: UserPreferences
    stats: UserStatsSchema
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublicResponse(BaseModel):
    id: uuid.UUID
    display_name: str | None
    avatar_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=100)
    avatar_url: str | None = Field(None, max_length=500)


class UpdatePreferencesRequest(BaseModel):
    theme: str | None = None
    hapticFeedback: bool | None = None
    soundEffects: bool | None = None
    showHints: bool | None = None
    showFixationDot: bool | None = None
    defaultGridSize: int | None = Field(None, ge=4, le=10)
    defaultMaxTime: int | None = Field(None, ge=30, le=600)
