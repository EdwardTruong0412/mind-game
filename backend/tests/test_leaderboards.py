import uuid
from datetime import date

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_daily_leaderboard_empty(client: AsyncClient) -> None:
    """Test that empty daily leaderboard returns empty list."""
    response = await client.get("/api/v1/leaderboards/daily?grid_size=5&order_mode=ASC")
    assert response.status_code == 200
    data = response.json()
    assert data["data"] == []
    assert data["meta"]["total_entries"] == 0


@pytest.mark.asyncio
async def test_daily_leaderboard_with_sessions(client: AsyncClient) -> None:
    """Test that completed sessions show up on leaderboard."""
    # Create a completed session
    await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 28500,
            "mistakes": 0,
            "accuracy": 100,
            "tap_events": [],
            "started_at": "2025-01-15T10:30:00Z",
            "completed_at": "2025-01-15T10:30:28.500Z",
        },
    )

    response = await client.get("/api/v1/leaderboards/daily?grid_size=5&order_mode=ASC")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["best_time_ms"] == 28500
    assert data["data"][0]["rank"] == 1


@pytest.mark.asyncio
async def test_daily_leaderboard_best_time_only(client: AsyncClient) -> None:
    """Test that leaderboard shows only the best time per user per day."""
    # Create two sessions — leaderboard should only show the faster one
    await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 35000,  # Slower
            "mistakes": 2,
            "accuracy": 92.59,
            "tap_events": [],
            "started_at": "2025-01-15T10:00:00Z",
            "completed_at": "2025-01-15T10:00:35Z",
        },
    )

    await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 25000,  # Faster
            "mistakes": 0,
            "accuracy": 100,
            "tap_events": [],
            "started_at": "2025-01-15T11:00:00Z",
            "completed_at": "2025-01-15T11:00:25Z",
        },
    )

    response = await client.get("/api/v1/leaderboards/daily?grid_size=5&order_mode=ASC")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["best_time_ms"] == 25000  # Should be the faster time


@pytest.mark.asyncio
async def test_daily_leaderboard_current_user(client: AsyncClient) -> None:
    """Test that current user's rank is included in response."""
    await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 28500,
            "mistakes": 0,
            "accuracy": 100,
            "tap_events": [],
            "started_at": "2025-01-15T10:30:00Z",
            "completed_at": "2025-01-15T10:30:28.500Z",
        },
    )

    response = await client.get("/api/v1/leaderboards/daily?grid_size=5&order_mode=ASC")
    data = response.json()
    assert data["current_user"] is not None
    assert data["current_user"]["rank"] == 1
    assert data["current_user"]["best_time_ms"] == 28500


@pytest.mark.asyncio
async def test_all_time_leaderboard(client: AsyncClient) -> None:
    """Test all-time leaderboard."""
    await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 28500,
            "mistakes": 0,
            "accuracy": 100,
            "tap_events": [],
            "started_at": "2025-01-15T10:30:00Z",
            "completed_at": "2025-01-15T10:30:28.500Z",
        },
    )

    response = await client.get("/api/v1/leaderboards/all-time?grid_size=5&order_mode=ASC")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1


@pytest.mark.asyncio
async def test_leaderboard_timeout_not_included(client: AsyncClient) -> None:
    """Test that timeout sessions don't appear on leaderboard."""
    await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "timeout",
            "completion_time_ms": None,
            "mistakes": 5,
            "accuracy": 50,
            "tap_events": [],
            "started_at": "2025-01-15T10:30:00Z",
            "completed_at": None,
        },
    )

    response = await client.get("/api/v1/leaderboards/daily?grid_size=5&order_mode=ASC")
    assert response.status_code == 200
    assert response.json()["data"] == []
