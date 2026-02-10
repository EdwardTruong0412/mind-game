from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str = Field(..., min_length=1, max_length=100)


class ConfirmRequest(BaseModel):
    email: EmailStr
    confirmation_code: str = Field(..., min_length=1, max_length=10)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    id_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    id_token: str
    token_type: str = "Bearer"
    expires_in: int


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    confirmation_code: str = Field(..., min_length=1, max_length=10)
    new_password: str = Field(..., min_length=8, max_length=128)


class SocialAuthRequest(BaseModel):
    code: str = Field(..., description="Authorization code from Cognito hosted UI redirect")


class MessageResponse(BaseModel):
    message: str
