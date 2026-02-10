import uuid
from math import ceil

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.user import User
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.session import (
    BulkSyncRequest,
    BulkSyncResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionResponse,
)
from app.services.session import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Save a training session to the cloud."""
    service = SessionService(db)
    session, _ = await service.create_session(current_user.id, body)
    return SessionResponse.model_validate(session)


@router.get("", response_model=PaginatedResponse[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    grid_size: int | None = Query(None, ge=4, le=10),
    order_mode: str | None = Query(None, pattern=r"^(ASC|DESC)$"),
    status: str | None = Query(None, pattern=r"^(completed|timeout|abandoned)$"),
) -> PaginatedResponse[SessionResponse]:
    """List current user's training sessions with pagination and filters."""
    service = SessionService(db)
    sessions, total = await service.list_sessions(
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        grid_size=grid_size,
        order_mode=order_mode,
        status=status,
    )

    return PaginatedResponse(
        data=[SessionResponse.model_validate(s) for s in sessions],
        meta=PaginationMeta(
            page=page,
            per_page=per_page,
            total=total,
            total_pages=ceil(total / per_page) if total > 0 else 0,
        ),
    )


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    """Get full session details including tap events."""
    service = SessionService(db)
    session = await service.get_session(session_id, current_user.id)
    if session is None:
        raise NotFoundError("Session not found")
    return SessionDetailResponse.model_validate(session)


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a training session."""
    service = SessionService(db)
    deleted = await service.delete_session(session_id, current_user.id)
    if not deleted:
        raise NotFoundError("Session not found")


@router.post("/sync", response_model=BulkSyncResponse)
async def bulk_sync(
    body: BulkSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BulkSyncResponse:
    """Bulk sync offline sessions to the cloud."""
    service = SessionService(db)
    synced, skipped = await service.bulk_sync(current_user.id, body.sessions)
    return BulkSyncResponse(synced=synced, skipped=skipped)
