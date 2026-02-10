from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.user import UserRepository
from app.schemas.auth import (
    ConfirmRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    ResetPasswordRequest,
    SocialAuthRequest,
    TokenResponse,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Register a new user account."""
    auth_service = AuthService()
    cognito_sub = await auth_service.register(
        email=body.email,
        password=body.password,
        display_name=body.display_name,
    )

    # Create user in local database
    user_repo = UserRepository(db)
    await user_repo.create(
        cognito_sub=cognito_sub,
        email=body.email,
        display_name=body.display_name,
    )

    return MessageResponse(
        message="Registration successful. Please check your email for a verification code."
    )


@router.post("/confirm", response_model=MessageResponse)
async def confirm(body: ConfirmRequest) -> MessageResponse:
    """Confirm email with verification code."""
    auth_service = AuthService()
    await auth_service.confirm_sign_up(
        email=body.email,
        confirmation_code=body.confirmation_code,
    )
    return MessageResponse(message="Email confirmed successfully. You can now log in.")


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Log in and receive JWT tokens."""
    auth_service = AuthService()
    tokens = await auth_service.login(email=body.email, password=body.password)
    return TokenResponse(**tokens)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(body: RefreshRequest) -> RefreshResponse:
    """Refresh access token using refresh token."""
    auth_service = AuthService()
    tokens = await auth_service.refresh_token(refresh_token=body.refresh_token)
    return RefreshResponse(**tokens)


@router.post("/logout", response_model=MessageResponse)
async def logout(authorization: str = Header()) -> MessageResponse:
    """Invalidate all user tokens (global sign out)."""
    token = authorization.replace("Bearer ", "")
    auth_service = AuthService()
    await auth_service.logout(access_token=token)
    return MessageResponse(message="Logged out successfully")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest) -> MessageResponse:
    """Initiate password reset flow."""
    auth_service = AuthService()
    await auth_service.forgot_password(email=body.email)
    return MessageResponse(
        message="If an account with that email exists, a reset code has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest) -> MessageResponse:
    """Complete password reset with verification code."""
    auth_service = AuthService()
    await auth_service.reset_password(
        email=body.email,
        confirmation_code=body.confirmation_code,
        new_password=body.new_password,
    )
    return MessageResponse(message="Password reset successfully. You can now log in.")


@router.post("/social/google", response_model=TokenResponse)
async def social_google(
    body: SocialAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate via Google OAuth (exchange Cognito authorization code)."""
    return await _handle_social_auth(body.code, db)


@router.post("/social/apple", response_model=TokenResponse)
async def social_apple(
    body: SocialAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate via Apple Sign In (exchange Cognito authorization code)."""
    return await _handle_social_auth(body.code, db)


async def _handle_social_auth(
    code: str,
    db: AsyncSession,
) -> TokenResponse:
    """Shared logic for social auth: exchange code, ensure user exists."""
    from app.config import get_settings
    from app.core.security import verify_token

    settings = get_settings()
    auth_service = AuthService()

    # Use first callback URL as redirect_uri
    redirect_uri = settings.cognito_callback_urls[0] if settings.cognito_callback_urls else ""
    tokens = await auth_service.exchange_code_for_tokens(code, redirect_uri)

    # Decode id_token to get user attributes
    claims = await verify_token(tokens["id_token"])
    cognito_sub = claims["sub"]
    email = claims.get("email", "")
    display_name = claims.get("name", claims.get("email", "User"))

    # Ensure user exists in local DB
    user_repo = UserRepository(db)
    user = await user_repo.get_by_cognito_sub(cognito_sub)
    if user is None:
        await user_repo.create(
            cognito_sub=cognito_sub,
            email=email,
            display_name=display_name,
        )

    return TokenResponse(**tokens)
