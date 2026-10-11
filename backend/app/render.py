"""
render.py — Deprecated. LibreOffice preview rendering replaced by client-side @iamjariwala/react-doc-viewer.
"""
from __future__ import annotations


def is_available() -> bool:
    """Return False: LibreOffice preview rendering has been removed."""
    return False


def render_docx(
    docx_path: str,
    out_dir: str,
    resolution: int = 100,
) -> list[str]:
    """Stub retained for API compatibility. Always returns empty list."""
    return []
