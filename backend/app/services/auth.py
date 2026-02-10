from typing import Any

import boto3
import structlog
from botocore.exceptions import ClientError

from app.config import get_settings
from app.core.exceptions import AuthenticationError, CognitoError, ConflictError, ForbiddenError

logger = structlog.get_logger()


def _get_cognito_client() -> Any:
    settings = get_settings()
    return boto3.client("cognito-idp", region_name=settings.cognito_region)


class AuthService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = _get_cognito_client()

    async def register(self, email: str, password: str, display_name: str) -> str:
        """Register a new user in Cognito. Returns the cognito sub."""
        try:
            response = self.client.sign_up(
                ClientId=self.settings.cognito_client_id,
                Username=email,
                Password=password,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "custom:display_name", "Value": display_name},
                ],
            )
            return response["UserSub"]
        except ClientError as e:
            code = e.response["Error"]["Code"]
            message = e.response["Error"]["Message"]
            if code == "UsernameExistsException":
                raise ConflictError(detail="An account with this email already exists")
            if code == "InvalidPasswordException":
                raise AuthenticationError(detail=f"Password does not meet requirements: {message}")
            logger.error("cognito_register_error", code=code, message=message)
            raise CognitoError(detail=message)

    async def confirm_sign_up(self, email: str, confirmation_code: str) -> None:
        """Confirm a user's email with the verification code."""
        try:
            self.client.confirm_sign_up(
                ClientId=self.settings.cognito_client_id,
                Username=email,
                ConfirmationCode=confirmation_code,
            )
        except ClientError as e:
            code = e.response["Error"]["Code"]
            message = e.response["Error"]["Message"]
            if code in ("CodeMismatchException", "ExpiredCodeException"):
                raise AuthenticationError(detail="Invalid or expired confirmation code")
            logger.error("cognito_confirm_error", code=code, message=message)
            raise CognitoError(detail=message)

    async def login(self, email: str, password: str) -> dict[str, Any]:
        """Authenticate user and return tokens."""
        try:
            response = self.client.initiate_auth(
                ClientId=self.settings.cognito_client_id,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={
                    "USERNAME": email,
                    "PASSWORD": password,
                },
            )
            result = response["AuthenticationResult"]
            return {
                "access_token": result["AccessToken"],
                "id_token": result["IdToken"],
                "refresh_token": result["RefreshToken"],
                "expires_in": result["ExpiresIn"],
            }
        except ClientError as e:
            code = e.response["Error"]["Code"]
            message = e.response["Error"]["Message"]
            if code == "NotAuthorizedException":
                raise AuthenticationError(detail="Incorrect email or password")
            if code == "UserNotConfirmedException":
                raise ForbiddenError(detail="Email address not confirmed")
            if code == "UserNotFoundException":
                # Don't reveal that the user doesn't exist
                raise AuthenticationError(detail="Incorrect email or password")
            logger.error("cognito_login_error", code=code, message=message)
            raise CognitoError(detail=message)

    async def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        """Refresh access and id tokens."""
        try:
            response = self.client.initiate_auth(
                ClientId=self.settings.cognito_client_id,
                AuthFlow="REFRESH_TOKEN_AUTH",
                AuthParameters={
                    "REFRESH_TOKEN": refresh_token,
                },
            )
            result = response["AuthenticationResult"]
            return {
                "access_token": result["AccessToken"],
                "id_token": result["IdToken"],
                "expires_in": result["ExpiresIn"],
            }
        except ClientError as e:
            code = e.response["Error"]["Code"]
            message = e.response["Error"]["Message"]
            if code == "NotAuthorizedException":
                raise AuthenticationError(detail="Invalid or expired refresh token")
            logger.error("cognito_refresh_error", code=code, message=message)
            raise CognitoError(detail=message)

    async def logout(self, access_token: str) -> None:
        """Globally sign out user (invalidate all tokens)."""
        try:
            self.client.global_sign_out(AccessToken=access_token)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            message = e.response["Error"]["Message"]
            if code == "NotAuthorizedException":
                # Token already invalid, treat as success
                return
            logger.error("cognito_logout_error", code=code, message=message)
            raise CognitoError(detail=message)

    async def forgot_password(self, email: str) -> None:
        """Initiate password reset. Always returns success to prevent enumeration."""
        try:
            self.client.forgot_password(
                ClientId=self.settings.cognito_client_id,
                Username=email,
            )
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "UserNotFoundException":
                # Don't reveal that the user doesn't exist
                return
            message = e.response["Error"]["Message"]
            logger.error("cognito_forgot_password_error", code=code, message=message)
            raise CognitoError(detail=message)

    async def reset_password(
        self, email: str, confirmation_code: str, new_password: str
    ) -> None:
        """Complete password reset with verification code."""
        try:
            self.client.confirm_forgot_password(
                ClientId=self.settings.cognito_client_id,
                Username=email,
                ConfirmationCode=confirmation_code,
                Password=new_password,
            )
        except ClientError as e:
            code = e.response["Error"]["Code"]
            message = e.response["Error"]["Message"]
            if code in ("CodeMismatchException", "ExpiredCodeException"):
                raise AuthenticationError(detail="Invalid or expired confirmation code")
            if code == "InvalidPasswordException":
                raise AuthenticationError(detail=f"Password does not meet requirements: {message}")
            logger.error("cognito_reset_password_error", code=code, message=message)
            raise CognitoError(detail=message)

    async def exchange_code_for_tokens(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """Exchange an authorization code for tokens (used for social login)."""
        import httpx

        token_url = (
            f"https://{self.settings.cognito_user_pool_id.split('_')[0]}"
            f".auth.{self.settings.cognito_region}.amazoncognito.com/oauth2/token"
        )

        # Cognito hosted domain is project-scoped
        settings = self.settings
        domain = f"schulte-app-{settings.app_environment}"
        token_url = (
            f"https://{domain}.auth.{settings.cognito_region}.amazoncognito.com"
            f"/oauth2/token"
        )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.cognito_client_id,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                logger.error("cognito_code_exchange_error", status=response.status_code, body=response.text)
                raise CognitoError(detail="Failed to exchange authorization code")

            data = response.json()
            return {
                "access_token": data["access_token"],
                "id_token": data["id_token"],
                "refresh_token": data.get("refresh_token", ""),
                "expires_in": data.get("expires_in", 3600),
            }
