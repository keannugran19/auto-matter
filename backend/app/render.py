"""
render.py — STAGE 9: Produce preview images from DOCX files.

SPEC.md §9: Convert DOCX → PDF via headless LibreOffice, then rasterise each
page with pdftoppm and return JPEG paths.

```bash
soffice --headless --convert-to pdf --outdir /tmp/out input.docx
pdftoppm -jpeg -r 100 /tmp/out/input.pdf /tmp/out/page
```

SPEC.md §9: "This is not a nicety — it is what makes the output trustworthy,
and it doubles as the dev test harness."

Notes on the LibreOffice dependency:
  - LibreOffice is single-threaded per user-data directory.  Concurrent calls
    to render_docx() must use separate --env UserInstallation= paths or
    serialise via a process lock.  We use a per-call temp directory as the
    user-data dir to isolate concurrent jobs.
  - LibreOffice may take 3–10 seconds per document.
  - Paths: the function accepts any absolute path to a .docx file; the caller
    is responsible for providing a writable output directory.

Public API:
    render_docx(docx_path, out_dir, resolution=100) -> list[str]
        Returns sorted list of JPEG file paths (page-00001.jpg, …).
    is_available() -> bool
        Returns True if both soffice and pdftoppm are on PATH.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def is_available() -> bool:
    """Return True if both soffice and pdftoppm are on PATH."""
    return shutil.which("soffice") is not None and shutil.which("pdftoppm") is not None


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------

def _docx_to_pdf(docx_path: str, out_dir: str, user_data_dir: str) -> str:
    """
    Convert a .docx to PDF using headless LibreOffice.

    Returns the path to the produced PDF file.
    Raises RuntimeError if soffice fails or produces no PDF.
    """
    result = subprocess.run(
        [
            "soffice",
            "--headless",
            f"-env:UserInstallation=file://{user_data_dir}",
            "--convert-to", "pdf",
            "--outdir", out_dir,
            docx_path,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"soffice failed (exit {result.returncode}):\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )

    # LibreOffice names the output after the input file stem
    stem = Path(docx_path).stem
    pdf_path = os.path.join(out_dir, f"{stem}.pdf")
    if not os.path.isfile(pdf_path):
        # Search for any PDF in out_dir as a fallback
        pdfs = list(Path(out_dir).glob("*.pdf"))
        if not pdfs:
            raise RuntimeError(
                f"soffice reported success but no PDF found in {out_dir!r}.\n"
                f"stdout: {result.stdout}"
            )
        pdf_path = str(pdfs[0])

    return pdf_path


def _pdf_to_jpegs(pdf_path: str, out_dir: str, resolution: int = 100) -> list[str]:
    """
    Rasterise each page of *pdf_path* as a JPEG using pdftoppm.

    Returns a sorted list of JPEG file paths.
    Raises RuntimeError if pdftoppm fails or produces no images.
    """
    prefix = os.path.join(out_dir, "page")
    result = subprocess.run(
        [
            "pdftoppm",
            "-jpeg",
            "-r", str(resolution),
            pdf_path,
            prefix,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"pdftoppm failed (exit {result.returncode}):\n{result.stderr}"
        )

    jpegs = sorted(str(p) for p in Path(out_dir).glob("page-*.jpg"))
    if not jpegs:
        raise RuntimeError(
            f"pdftoppm reported success but no JPEG files found in {out_dir!r}"
        )

    return jpegs


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def render_docx(
    docx_path: str,
    out_dir: str,
    resolution: int = 100,
) -> list[str]:
    """
    Convert a DOCX file to per-page JPEG previews.

    Parameters
    ----------
    docx_path:
        Absolute path to the input .docx file.
    out_dir:
        Directory where the PDF and JPEG files will be written.
        Must exist and be writable.
    resolution:
        DPI for pdftoppm rasterisation.  100 is sufficient for the UI
        preview panes (roughly 800 × 1040 px for an A4 page).

    Returns
    -------
    list[str]
        Sorted list of JPEG file paths, one per page.

    Raises
    ------
    RuntimeError
        If soffice or pdftoppm is not available, or if either subprocess fails.
    FileNotFoundError
        If docx_path does not exist.
    """
    if not os.path.isfile(docx_path):
        raise FileNotFoundError(f"DOCX not found: {docx_path!r}")

    if not shutil.which("soffice"):
        raise RuntimeError(
            "LibreOffice (soffice) is not installed or not on PATH. "
            "Run inside the Docker container (see Dockerfile)."
        )

    if not shutil.which("pdftoppm"):
        raise RuntimeError(
            "pdftoppm is not installed or not on PATH. "
            "Install poppler-utils inside the Docker container."
        )

    os.makedirs(out_dir, exist_ok=True)

    # Use a private user-data directory so concurrent LibreOffice invocations
    # do not corrupt each other's profile state.
    with tempfile.TemporaryDirectory(prefix="lo_userdata_") as user_data_dir:
        pdf_path = _docx_to_pdf(docx_path, out_dir, user_data_dir)
        return _pdf_to_jpegs(pdf_path, out_dir, resolution)
