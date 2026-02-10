"""
Auth endpoint tests.

Note: Auth endpoints are thin wrappers around AWS Cognito.
Full integration tests require a running Cognito instance.
These tests verify request validation and error handling.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_validation(client: AsyncClient) -> None:
    """Test that registration validates input."""
    # Missing fields
    response = await client.post("/api/v1/auth/register", json={})
    assert response.status_code == 422

    # Invalid email
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": "Password1",
            "display_name": "Test",
        },
    )
    assert response.status_code == 422

    # Password too short
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@test.com",
            "password": "short",
            "display_name": "Test",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_validation(client: AsyncClient) -> None:
    """Test that login validates input."""
    response = await client.post("/api/v1/auth/login", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_confirm_validation(client: AsyncClient) -> None:
    """Test that confirm validates input."""
    response = await client.post(
        "/api/v1/auth/confirm",
        json={"email": "test@test.com", "confirmation_code": ""},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_reset_password_validation(client: AsyncClient) -> None:
    """Test that reset password validates input."""
    response = await client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "test@test.com",
            "confirmation_code": "123456",
            "new_password": "short",  # Too short
        },
    )
    assert response.status_code == 422
