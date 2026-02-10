import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_my_profile(client: AsyncClient) -> None:
    """Test getting current user profile."""
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"
    assert "preferences" in data
    assert "stats" in data
    assert data["stats"]["totalSessions"] == 0


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient) -> None:
    """Test updating display name."""
    response = await client.patch(
        "/api/v1/users/me",
        json={"display_name": "New Name"},
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "New Name"


@pytest.mark.asyncio
async def test_update_preferences(client: AsyncClient) -> None:
    """Test updating preferences (partial merge)."""
    response = await client.patch(
        "/api/v1/users/me/preferences",
        json={"theme": "dark", "defaultGridSize": 7},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "dark"
    assert data["defaultGridSize"] == 7
    # Other preferences should remain at defaults
    assert data["hapticFeedback"] is True


@pytest.mark.asyncio
async def test_update_preferences_validation(client: AsyncClient) -> None:
    """Test that invalid preferences are rejected."""
    response = await client.patch(
        "/api/v1/users/me/preferences",
        json={"defaultGridSize": 15},  # max is 10
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_public_profile(client: AsyncClient, test_user) -> None:
    """Test getting a public profile."""
    response = await client.get(f"/api/v1/users/{test_user.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Test User"
    # Should NOT contain email or preferences
    assert "email" not in data
    assert "preferences" not in data


@pytest.mark.asyncio
async def test_get_nonexistent_user(client: AsyncClient) -> None:
    """Test getting a user that doesn't exist."""
    response = await client.get(f"/api/v1/users/{uuid.uuid4()}")
    assert response.status_code == 404
