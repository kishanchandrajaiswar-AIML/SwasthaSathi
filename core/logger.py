"""Application Structured Logging.

Provides a unified logger configuration for the entire application.
"""
from __future__ import annotations

import logging
import sys


def setup_logger(name: str = "swasthasathi") -> logging.Logger:
    """Create and configure standard application logger."""
    logger = logging.getLogger(name)

    if not logger.handlers:
        logger.setLevel(logging.INFO)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

    return logger


logger = setup_logger("swasthasathi")
