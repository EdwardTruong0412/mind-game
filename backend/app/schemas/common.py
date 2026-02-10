from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    total_pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]  # type: ignore[misc]
    meta: PaginationMeta


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
