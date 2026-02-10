import uuid

import pytest
from httpx import AsyncClient

from app.models.user import User


@pytest.mark.asyncio
async def test_create_session(client: AsyncClient) -> None:
    """Test creating a training session."""
    response = await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 28500,
            "mistakes": 3,
            "accuracy": 89.29,
            "tap_events": [
                {
                    "cellIndex": 12,
                    "expectedValue": 1,
                    "tappedValue": 1,
                    "correct": True,
                    "timestampMs": 450,
                }
            ],
            "started_at": "2025-01-15T10:30:00Z",
            "completed_at": "2025-01-15T10:30:28.500Z",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["grid_size"] == 5
    assert data["status"] == "completed"
    assert data["completion_time_ms"] == 28500


@pytest.mark.asyncio
async def test_create_session_idempotent(client: AsyncClient) -> None:
    """Test that creating the same session twice returns existing."""
    client_id = str(uuid.uuid4())
    payload = {
        "client_session_id": client_id,
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
    }

    response1 = await client.post("/api/v1/sessions", json=payload)
    assert response1.status_code == 201

    response2 = await client.post("/api/v1/sessions", json=payload)
    assert response2.status_code == 201
    assert response1.json()["id"] == response2.json()["id"]


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient) -> None:
    """Test listing sessions with pagination."""
    # Create a few sessions
    for i in range(3):
        await client.post(
            "/api/v1/sessions",
            json={
                "client_session_id": str(uuid.uuid4()),
                "grid_size": 5,
                "max_time": 120,
                "order_mode": "ASC",
                "status": "completed",
                "completion_time_ms": 28500 + i * 1000,
                "mistakes": i,
                "accuracy": 100 - i * 5,
                "tap_events": [],
                "started_at": f"2025-01-1{5+i}T10:30:00Z",
                "completed_at": f"2025-01-1{5+i}T10:30:28.500Z",
            },
        )

    response = await client.get("/api/v1/sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 3
    assert data["meta"]["total"] == 3


@pytest.mark.asyncio
async def test_list_sessions_filter(client: AsyncClient) -> None:
    """Test filtering sessions by grid_size."""
    for gs in [5, 5, 6]:
        await client.post(
            "/api/v1/sessions",
            json={
                "client_session_id": str(uuid.uuid4()),
                "grid_size": gs,
                "max_time": 120,
                "order_mode": "ASC",
                "status": "completed",
                "completion_time_ms": 30000,
                "mistakes": 0,
                "accuracy": 100,
                "tap_events": [],
                "started_at": "2025-01-15T10:30:00Z",
                "completed_at": "2025-01-15T10:30:30Z",
            },
        )

    response = await client.get("/api/v1/sessions?grid_size=5")
    assert response.status_code == 200
    assert response.json()["meta"]["total"] == 2


@pytest.mark.asyncio
async def test_get_session_detail(client: AsyncClient) -> None:
    """Test getting a session with tap events."""
    create_resp = await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 28500,
            "mistakes": 1,
            "accuracy": 96.15,
            "tap_events": [
                {
                    "cellIndex": 0,
                    "expectedValue": 1,
                    "tappedValue": 1,
                    "correct": True,
                    "timestampMs": 500,
                },
                {
                    "cellIndex": 5,
                    "expectedValue": 2,
                    "tappedValue": 3,
                    "correct": False,
                    "timestampMs": 1200,
                },
            ],
            "started_at": "2025-01-15T10:30:00Z",
            "completed_at": "2025-01-15T10:30:28.500Z",
        },
    )
    session_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/sessions/{session_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["tap_events"] is not None
    assert len(data["tap_events"]) == 2


@pytest.mark.asyncio
async def test_delete_session(client: AsyncClient) -> None:
    """Test deleting a session."""
    create_resp = await client.post(
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
    session_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/sessions/{session_id}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/sessions/{session_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_session(client: AsyncClient) -> None:
    """Test deleting a session that doesn't exist."""
    response = await client.delete(f"/api/v1/sessions/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_bulk_sync(client: AsyncClient) -> None:
    """Test bulk syncing sessions."""
    sessions = [
        {
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 5,
            "max_time": 120,
            "order_mode": "ASC",
            "status": "completed",
            "completion_time_ms": 28500 + i * 1000,
            "mistakes": 0,
            "accuracy": 100,
            "tap_events": [],
            "started_at": f"2025-01-1{5+i}T10:30:00Z",
            "completed_at": f"2025-01-1{5+i}T10:30:28.500Z",
        }
        for i in range(5)
    ]

    response = await client.post("/api/v1/sessions/sync", json={"sessions": sessions})
    assert response.status_code == 200
    data = response.json()
    assert data["synced"] == 5
    assert data["skipped"] == 0


@pytest.mark.asyncio
async def test_session_validation(client: AsyncClient) -> None:
    """Test that invalid sessions are rejected."""
    # Grid size too small
    response = await client.post(
        "/api/v1/sessions",
        json={
            "client_session_id": str(uuid.uuid4()),
            "grid_size": 2,
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
    assert response.status_code == 422
