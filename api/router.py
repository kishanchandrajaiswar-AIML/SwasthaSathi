"""Scalable REST API Router.

Provides route registration, middleware execution, request dispatching,
and standardized error handling boundaries.
"""
from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional

from api.context import APIResponse, RequestContext
from core.errors import NotFoundError, format_error_response
from core.logger import logger

HandlerFunc = Callable[[RequestContext], Any]


class Router:
    """Manages route registration and dispatches HTTP requests."""

    def __init__(self, prefix: str = "") -> None:
        self.prefix = prefix
        self._routes: Dict[str, Dict[str, HandlerFunc]] = {
            "GET": {},
            "POST": {},
            "PUT": {},
            "DELETE": {},
            "OPTIONS": {},
        }

    def register(self, method: str, path: str, handler: HandlerFunc) -> None:
        """Register a handler for a specific HTTP method and path."""
        norm_method = method.upper()
        if norm_method not in self._routes:
            self._routes[norm_method] = {}
        full_path = f"{self.prefix}{path}".rstrip("/") or "/"
        self._routes[norm_method][full_path] = handler

    def get(self, path: str) -> Callable[[HandlerFunc], HandlerFunc]:
        """Decorator for GET routes."""
        def decorator(func: HandlerFunc) -> HandlerFunc:
            self.register("GET", path, func)
            return func
        return decorator

    def post(self, path: str) -> Callable[[HandlerFunc], HandlerFunc]:
        """Decorator for POST routes."""
        def decorator(func: HandlerFunc) -> HandlerFunc:
            self.register("POST", path, func)
            return func
        return decorator

    def can_handle(self, method: str, path: str) -> bool:
        """Check if router has a registered handler for method and path."""
        norm_method = method.upper()
        norm_path = path.rstrip("/") or "/"
        if norm_method == "OPTIONS":
            return True
        return norm_path in self._routes.get(norm_method, {})

    def dispatch(self, ctx: RequestContext) -> APIResponse:
        """Dispatch incoming request context to matching handler with error handling."""
        start_time = time.perf_counter()
        method = ctx.method.upper()
        path = ctx.path.rstrip("/") or "/"

        # Automatic CORS Preflight Handling
        if method == "OPTIONS":
            return APIResponse(
                data=None,
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                },
            )

        handler = self._routes.get(method, {}).get(path)

        if not handler:
            err = NotFoundError(f"Route '{method} {path}' not found")
            data, status = format_error_response(err)
            return APIResponse(data=data, status_code=status)

        try:
            result = handler(ctx)
            if isinstance(result, APIResponse):
                response = result
            elif isinstance(result, tuple) and len(result) == 2:
                response = APIResponse(data=result[0], status_code=result[1])
            else:
                response = APIResponse(data=result, status_code=200)

            # Standard CORS headers
            response.headers.setdefault("Access-Control-Allow-Origin", "*")
            response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")

            latency_ms = (time.perf_counter() - start_time) * 1000
            logger.info("%s %s -> %d (%.1f ms)", method, path, response.status_code, latency_ms)
            return response

        except Exception as exc:
            latency_ms = (time.perf_counter() - start_time) * 1000
            data, status = format_error_response(exc)
            logger.error("%s %s FAILED -> %d: %s (%.1f ms)", method, path, status, str(exc), latency_ms)
            return APIResponse(
                data=data,
                status_code=status,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                },
            )


# Global primary API router instance
api_router = Router()
