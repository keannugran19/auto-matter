"""
Tests for render.py stub (LibreOffice removed).
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.render import render_docx, is_available


def test_is_available_always_false():
    """LibreOffice preview has been removed; is_available must be False."""
    assert is_available() is False


def test_render_docx_returns_empty_list():
    """render_docx stub returns empty list."""
    assert render_docx("nonexistent.docx", "/tmp") == []
