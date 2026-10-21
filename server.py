"""SwasthaSathi Production Healthcare Server.

Serves modern web application assets and routes REST API requests through
the modular API router.
"""
from __future__ import annotations

import json
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from api import RequestContext, api_router
from core.config import settings
from core.logger import logger


class SwasthaSathiHandler(SimpleHTTPRequestHandler):
    """HTTP Handler serving static web assets and routing REST API endpoints."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(settings.web_dir), **kwargs)

    def end_headers(self) -> None:
        """Inject security and caching control headers."""
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def _send_api_response(self, response) -> None:
        """Serialize and transmit APIResponse to client."""
        status = response.status_code
        payload = b""
        if response.data is not None:
            payload = json.dumps(response.data, ensure_ascii=False, default=str).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))

        for header_name, header_val in response.headers.items():
            self.send_header(header_name, header_val)

        self.end_headers()
        if payload:
            self.wfile.write(payload)

    def do_OPTIONS(self) -> None:
        """Handle preflight CORS requests."""
        parsed = urlparse(self.path)
        ctx = RequestContext(method="OPTIONS", path=parsed.path)
        res = api_router.dispatch(ctx)
        self._send_api_response(res)

    def do_GET(self) -> None:
        """Handle GET requests for APIs or static web content."""
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/") or api_router.can_handle("GET", path):
            query = parse_qs(parsed.query)
            ctx = RequestContext(
                method="GET",
                path=path,
                query_params=query,
                headers=dict(self.headers),
            )
            res = api_router.dispatch(ctx)
            self._send_api_response(res)
            return

        # Serve static web directory files
        super().do_GET()

    def do_POST(self) -> None:
        """Handle POST requests for REST API endpoints."""
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length) if content_length > 0 else b""

        body_data = {}
        if raw_body:
            try:
                body_data = json.loads(raw_body.decode("utf-8"))
            except Exception:
                body_data = {}

        query = parse_qs(parsed.query)
        ctx = RequestContext(
            method="POST",
            path=path,
            query_params=query,
            body=body_data,
            raw_body=raw_body,
            headers=dict(self.headers),
        )

        res = api_router.dispatch(ctx)
        self._send_api_response(res)


def run_server(port: int = 8080, host: str = "0.0.0.0") -> None:
    """Start the multi-threaded HTTP server."""
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, SwasthaSathiHandler)
    logger.info("SwasthaSathi Healthcare Server running on http://%s:%d/", "localhost" if host == "0.0.0.0" else host, port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        httpd.shutdown()


if __name__ == "__main__":
    server_port = settings.port
    if len(sys.argv) > 1:
        try:
            server_port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port=server_port, host=settings.host)
