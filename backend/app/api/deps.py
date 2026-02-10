import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AuthenticationError
from app.core.security import verify_token
from app.models.user import User
from app.repositories.user import UserRepository


async def get_session(
    db: AsyncGenerator[AsyncSession, None] = Depends(get_db),
) -> AsyncSession:
    return db  # type: ignore[return-value]


async def get_current_user(
    authorization: Annotated[str, Header()],
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT token, return the authenticated user."""
    if not authorization.startswith("Bearer "):
        raise AuthenticationError("Invalid authorization header format")

    token = authorization[7:]
    claims = await verify_token(token)

    cognito_sub = claims.get("sub")
    if not cognito_sub:
        raise AuthenticationError("Token missing subject claim")

    user_repo = UserRepository(db)
    user = await user_repo.get_by_cognito_sub(cognito_sub)
    if user is None:
        raise AuthenticationError("User not found")

    return user


async def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optionally extract user from JWT. Returns None if not authenticated."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    try:
        token = authorization[7:]
        claims = await verify_token(token)
        cognito_sub = claims.get("sub")
        if not cognito_sub:
            return None

        user_repo = UserRepository(db)
        return await user_repo.get_by_cognito_sub(cognito_sub)
    except Exception:
        return None
