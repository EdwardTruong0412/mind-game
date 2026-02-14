from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.config import get_settings
import app.core.database as db_module

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown events."""
    settings = get_settings()
    logger.info(
        "app_starting",
        environment=settings.app_environment,
        debug=settings.debug,
    )

    # Load DB password from SSM if path is configured (AWS deployment)
    if settings.db_password_ssm_path:
        try:
            import boto3

            ssm = boto3.client("ssm", region_name=settings.cognito_region)
            response = ssm.get_parameter(
                Name=settings.db_password_ssm_path,
                WithDecryption=True,
            )
            settings.db_password = response["Parameter"]["Value"]
            logger.info("ssm_password_loaded", path=settings.db_password_ssm_path)
            # Recreate DB engine with the real password
            await db_module.init_db(settings.database_url)
        except Exception as e:
            logger.error("ssm_password_error", error=str(e))

    yield

    # Shutdown
    await db_module.engine.dispose()
    logger.info("app_shutdown")


app = FastAPI(
    title="Schulte Table Training API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if get_settings().debug else None,
    redoc_url="/redoc" if get_settings().debug else None,
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Routes
app.include_router(api_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    try:
        async with db_module.engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return JSONResponse(  # type: ignore[return-value]
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "database": str(e)},
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unhandled exceptions and return structured error."""
    logger.error("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            }
        },
    )
