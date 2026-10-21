"""SwasthaSathi Core Package.

Provides centralized configuration, error definitions, and logging utilities.
"""
from core.config import settings
from core.errors import AppError, BadRequestError, ExternalServiceError, NotFoundError, ValidationError

__all__ = [
    "settings",
    "AppError",
    "ValidationError",
    "NotFoundError",
    "BadRequestError",
    "ExternalServiceError",
]
