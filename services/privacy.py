"""Privacy and PII redaction utilities for SwasthaSathi.

Ensures no phone numbers, email addresses, or government identity numbers
are passed to external APIs or leaked into logs.
"""
from __future__ import annotations

import re

# Indian mobile numbers: +91 optional, starts with 6-9, 10 digits with optional hyphens/spaces
PHONE_PATTERN = re.compile(r"(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}\b")

# Email addresses
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")

# Aadhaar-like 12 digit numbers (4 digits space 4 digits space 4 digits)
AADHAAR_PATTERN = re.compile(r"\b\d{4}[\-\s]\d{4}[\-\s]\d{4}\b")


def sanitize_input_text(text: str) -> str:
    """Strip control characters, collapse whitespace, and redact PII."""
    if not text:
        return ""

    # Remove non-printable control characters (except newline and tab)
    cleaned = "".join(ch for ch in text if ch == "\n" or ch == "\t" or (ord(ch) >= 32 and ord(ch) != 127))

    # Redact phone numbers
    cleaned = PHONE_PATTERN.sub("[PHONE_REDACTED]", cleaned)

    # Redact email addresses
    cleaned = EMAIL_PATTERN.sub("[EMAIL_REDACTED]", cleaned)

    # Redact Aadhaar-like numbers
    cleaned = AADHAAR_PATTERN.sub("[ID_REDACTED]", cleaned)

    # Collapse multiple whitespace
    cleaned = re.sub(r"[ \t]+", " ", cleaned).strip()

    return cleaned[:1000]
