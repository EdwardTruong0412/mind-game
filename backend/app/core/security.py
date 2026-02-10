import time
from typing import Any

import httpx
from jose import JWTError, jwk, jwt

from app.config import get_settings
from app.core.exceptions import AuthenticationError

# Cache JWKS keys in memory
_jwks_cache: dict[str, Any] = {}
_jwks_cache_time: float = 0
_JWKS_CACHE_TTL = 86400  # 24 hours


async def _get_jwks() -> dict[str, Any]:
    """Fetch and cache Cognito JWKS (JSON Web Key Set)."""
    global _jwks_cache, _jwks_cache_time

    if _jwks_cache and (time.time() - _jwks_cache_time) < _JWKS_CACHE_TTL:
        return _jwks_cache

    settings = get_settings()
    async with httpx.AsyncClient() as client:
        response = await client.get(settings.cognito_jwks_url)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = time.time()
        return _jwks_cache


def _get_public_key(jwks: dict[str, Any], kid: str) -> Any:
    """Find the matching public key from JWKS by key ID."""
    for key_data in jwks.get("keys", []):
        if key_data["kid"] == kid:
            return jwk.construct(key_data)
    raise AuthenticationError("Unable to find matching key")


async def verify_token(token: str) -> dict[str, Any]:
    """Verify a Cognito JWT access token and return its claims."""
    settings = get_settings()

    try:
        # Decode header to get kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise AuthenticationError("Token missing key ID")

        # Get JWKS and find matching key
        jwks = await _get_jwks()
        public_key = _get_public_key(jwks, kid)

        # Verify and decode token
        claims: dict[str, Any] = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            issuer=settings.cognito_issuer,
            options={"verify_at_hash": False},
        )

        # Verify token_use
        if claims.get("token_use") not in ("access", "id"):
            raise AuthenticationError("Invalid token use")

        return claims

    except JWTError as e:
        raise AuthenticationError(f"Token verification failed: {e}") from e
