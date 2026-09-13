"""
Tests for render.py (SPEC.md §13, Step 9).

LibreOffice is not available in the dev environment (Docker deferred per user
decision).  Tests that require soffice are skipped automatically.

Tests that can run without LibreOffice:
  - is_available() returns False when soffice is missing
  - render_docx() raises RuntimeError (not a crash) when soffice absent
  - render_docx() raises FileNotFoundError for non-existent input
  - _pdf_to_jpegs() — tested with pdftoppm on a minimal synthetic PDF

When LibreOffice IS available (i.e., inside the container):
  - Renders climate_original.docx → at least one JPEG
  - Renders climate_reference.docx → at least one JPEG
  - Output images are valid JPEG files (check magic bytes)
  - Concurrent calls to render_docx() on different files do not conflict
"""
from __future__ import annotations

import os
import shutil
import struct
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.render import render_docx, is_available, _pdf_to_jpegs

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
ORIGINAL  = os.path.join(FIXTURES, "climate_original.docx")
REFERENCE = os.path.join(FIXTURES, "climate_reference.docx")


# Marker: skip tests that need LibreOffice when it's not installed
needs_lo = pytest.mark.skipif(
    not shutil.which("soffice"),
    reason="LibreOffice (soffice) not installed — run inside Docker container",
)


# ===========================================================================
# Tests that run in all environments
# ===========================================================================

def test_is_available_false_when_soffice_missing():
    """When soffice is not on PATH, is_available() must return False."""
    if shutil.which("soffice") is not None:
        pytest.skip("soffice is present; this test is for the no-soffice case")
    assert is_available() is False


def test_render_raises_runtime_error_when_soffice_missing():
    """render_docx() must raise RuntimeError (not crash) when soffice absent."""
    if shutil.which("soffice") is not None:
        pytest.skip("soffice is present")
    with pytest.raises(RuntimeError, match="LibreOffice"):
        with tempfile.TemporaryDirectory() as out_dir:
            render_docx(ORIGINAL, out_dir)


def test_render_raises_file_not_found():
    """render_docx() must raise FileNotFoundError for a non-existent input."""
    with pytest.raises(FileNotFoundError):
        with tempfile.TemporaryDirectory() as out_dir:
            render_docx("/nonexistent/path/file.docx", out_dir)


def test_is_available_true_when_both_present():
    """Verify is_available() reflects both tools being present."""
    soffice_present   = shutil.which("soffice") is not None
    pdftoppm_present  = shutil.which("pdftoppm") is not None
    assert is_available() == (soffice_present and pdftoppm_present)


def test_pdf_to_jpegs_with_synthetic_pdf(tmp_path):
    """
    Test _pdf_to_jpegs() using pdftoppm on a real minimal PDF.
    (pdftoppm IS present on this system.)
    """
    if not shutil.which("pdftoppm"):
        pytest.skip("pdftoppm not available")

    # Minimal valid PDF (1 white page)
    pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
214
%%EOF"""

    pdf_path = str(tmp_path / "test.pdf")
    with open(pdf_path, "wb") as f:
        f.write(pdf_content)

    out_dir = str(tmp_path / "out")
    os.makedirs(out_dir, exist_ok=True)

    jpegs = _pdf_to_jpegs(pdf_path, out_dir, resolution=72)

    assert len(jpegs) >= 1, "Expected at least one JPEG for a 1-page PDF"

    # All returned paths exist
    for j in jpegs:
        assert os.path.isfile(j), f"JPEG not found: {j!r}"

    # JPEG magic bytes: FF D8 FF
    for j in jpegs:
        with open(j, "rb") as f:
            header = f.read(3)
        assert header == b"\xff\xd8\xff", (
            f"{j!r} does not start with JPEG magic bytes"
        )


def test_pdf_to_jpegs_sorted_order(tmp_path):
    """Pages must be returned in ascending order."""
    if not shutil.which("pdftoppm"):
        pytest.skip("pdftoppm not available")

    # 3-page PDF
    pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R 5 0 R]/Count 3>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
4 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
5 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
0000000297 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
388
%%EOF"""

    pdf_path = str(tmp_path / "multipage.pdf")
    with open(pdf_path, "wb") as f:
        f.write(pdf_content)

    out_dir = str(tmp_path / "out")
    os.makedirs(out_dir, exist_ok=True)

    jpegs = _pdf_to_jpegs(pdf_path, out_dir, resolution=72)
    assert jpegs == sorted(jpegs), "JPEGs must be in sorted order"


# ===========================================================================
# Tests that require LibreOffice (skipped in dev, run in Docker)
# ===========================================================================

@needs_lo
def test_render_original_produces_jpegs(tmp_path):
    """Rendering climate_original.docx must produce at least one JPEG."""
    out_dir = str(tmp_path / "out_original")
    jpegs = render_docx(ORIGINAL, out_dir)
    assert len(jpegs) >= 1
    for j in jpegs:
        assert os.path.isfile(j)
        with open(j, "rb") as f:
            assert f.read(3) == b"\xff\xd8\xff"


@needs_lo
def test_render_reference_produces_jpegs(tmp_path):
    """Rendering climate_reference.docx must produce at least one JPEG."""
    out_dir = str(tmp_path / "out_reference")
    jpegs = render_docx(REFERENCE, out_dir)
    assert len(jpegs) >= 1


@needs_lo
def test_render_is_available_when_lo_present():
    assert is_available() is True


@needs_lo
def test_concurrent_render_no_conflict(tmp_path):
    """
    Two concurrent render_docx() calls must not corrupt each other.
    Uses threading since the subprocess isolation is per user-data dir.
    """
    import threading

    results: dict[str, list[str] | Exception] = {}

    def _render(key: str, path: str, out: str) -> None:
        try:
            results[key] = render_docx(path, out)
        except Exception as e:
            results[key] = e

    t1 = threading.Thread(
        target=_render,
        args=("orig", ORIGINAL, str(tmp_path / "t1")),
    )
    t2 = threading.Thread(
        target=_render,
        args=("ref", REFERENCE, str(tmp_path / "t2")),
    )

    t1.start(); t2.start()
    t1.join();  t2.join()

    for key, result in results.items():
        assert not isinstance(result, Exception), (
            f"Concurrent render '{key}' raised: {result}"
        )
        assert len(result) >= 1
