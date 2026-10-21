"""Standardized Error Classes and Formatting.

Provides a unified error hierarchy for consistent error handling and responses
across all API endpoints and backend services.
"""
from __future__ import annotations

from typing import Any, Dict, Optional


class AppError(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = 500,
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to structured dictionary."""
        res: Dict[str, Any] = {
            "success": False,
            "error": {
                "code": self.code,
                "message": self.message,
            },
        }
        if self.details is not None:
            res["error"]["details"] = self.details
        return res


class BadRequestError(AppError):
    """Raised when client sends malformed or invalid request."""

    def __init__(self, message: str = "Bad Request", details: Optional[Any] = None) -> None:
        super().__init__(message=message, code="BAD_REQUEST", status_code=400, details=details)


class ValidationError(AppError):
    """Raised when request payload fails schema or business validation."""

    def __init__(self, message: str = "Validation Failed", details: Optional[Any] = None) -> None:
        super().__init__(message=message, code="VALIDATION_ERROR", status_code=422, details=details)


class NotFoundError(AppError):
    """Raised when requested resource is not found."""

    def __init__(self, message: str = "Resource Not Found", details: Optional[Any] = None) -> None:
        super().__init__(message=message, code="NOT_FOUND", status_code=404, details=details)


class UnauthorizedError(AppError):
    """Raised when authentication credentials are required or invalid."""

    def __init__(self, message: str = "Unauthorized Access", details: Optional[Any] = None) -> None:
        super().__init__(message=message, code="UNAUTHORIZED", status_code=401, details=details)


class ExternalServiceError(AppError):
    """Raised when an external API (e.g. Groq, Supabase) fails or times out."""

    def __init__(self, message: str = "External Service Error", details: Optional[Any] = None) -> None:
        super().__init__(message=message, code="EXTERNAL_SERVICE_ERROR", status_code=502, details=details)


def format_error_response(exc: Exception) -> tuple[Dict[str, Any], int]:
    """Format any unhandled or domain exception into a standardized JSON response tuple."""
    if isinstance(exc, AppError):
        return exc.to_dict(), exc.status_code

    # Unhandled generic exception
    return {
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": str(exc) or "An unexpected server error occurred.",
        },
    }, 500
