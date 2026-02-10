from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_environment: str = "dev"
    debug: bool = False

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "schulte"
    db_username: str = "schulte"
    db_password: str = "localdev"

    # SSM (for AWS deployment — overrides db_password at startup)
    db_password_ssm_path: str = ""

    # Cognito
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_region: str = "ap-southeast-1"

    # Cognito OAuth
    cognito_callback_urls: list[str] = ["http://localhost:3000/auth/callback"]
    cognito_logout_urls: list[str] = ["http://localhost:3000"]

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def database_url_sync(self) -> str:
        """Sync URL for Alembic migrations."""
        return (
            f"postgresql://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cognito_issuer(self) -> str:
        return (
            f"https://cognito-idp.{self.cognito_region}.amazonaws.com"
            f"/{self.cognito_user_pool_id}"
        )

    @property
    def cognito_jwks_url(self) -> str:
        return f"{self.cognito_issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
