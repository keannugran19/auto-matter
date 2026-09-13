"""
Tests for FastAPI API routes (SPEC.md §13, Step 11).

SPEC.md §10 API Contract:
  POST /api/convert
    multipart/form-data: target=<file.docx>, reference=<file.docx>
    → 202 { jobId: string }
    → 400 { error } on non-DOCX, oversized, or corrupt input

  GET /api/jobs/{jobId}
    → { status: "queued"|"running"|"done"|"error", ... }

  GET /api/jobs/{jobId}/download → the restyled .docx

  DELETE /api/jobs/{jobId} → purge inputs, outputs, previews
"""
from __future__ import annotations

import io
import os
import sys
import zipfile

import pytest
from starlette.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.main import app
from backend.app.jobs import _jobs, _job_dir, _run_job_sync, delete_job
from backend.app.ooxml.package import DocxPackage

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
ORIGINAL  = os.path.join(FIXTURES, "climate_original.docx")
REFERENCE = os.path.join(FIXTURES, "climate_reference.docx")


@pytest.fixture
def client():
    # Clear any previous in-memory jobs
    _jobs.clear()
    return TestClient(app)


# ===========================================================================
# 1. Health check
# ===========================================================================

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


# ===========================================================================
# 2. POST /api/convert validation
# ===========================================================================

def test_convert_rejects_non_docx_target(client):
    res = client.post(
        "/api/convert",
        files={
            "target": ("file.txt", b"plain text", "text/plain"),
            "reference": ("ref.docx", open(REFERENCE, "rb"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert "error" in data or "detail" in data
    assert ".docx" in (data.get("error") or data.get("detail", ""))


def test_convert_rejects_non_docx_reference(client):
    res = client.post(
        "/api/convert",
        files={
            "target": ("target.docx", open(ORIGINAL, "rb"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "reference": ("ref.pdf", b"%PDF-1.4...", "application/pdf"),
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert ".docx" in (data.get("error") or data.get("detail", ""))


def test_convert_rejects_empty_file(client):
    res = client.post(
        "/api/convert",
        files={
            "target": ("empty.docx", b"", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "reference": ("ref.docx", open(REFERENCE, "rb"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert "empty" in (data.get("error") or data.get("detail", "")).lower()


def test_convert_rejects_corrupt_docx(client):
    res = client.post(
        "/api/convert",
        files={
            "target": ("corrupt.docx", b"not a zip file at all", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "reference": ("ref.docx", open(REFERENCE, "rb"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert "not a valid docx" in (data.get("error") or data.get("detail", "")).lower()


def test_convert_rejects_zip_missing_document_xml(client):
    # Valid ZIP but not a DOCX
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("test.txt", "hello")
    buf.seek(0)

    res = client.post(
        "/api/convert",
        files={
            "target": ("not_docx.docx", buf.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "reference": ("ref.docx", open(REFERENCE, "rb"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert "not a valid docx" in (data.get("error") or data.get("detail", "")).lower()


def test_convert_accepts_valid_fixtures(client):
    with open(ORIGINAL, "rb") as f_orig, open(REFERENCE, "rb") as f_ref:
        res = client.post(
            "/api/convert",
            files={
                "target": ("target.docx", f_orig, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                "reference": ("reference.docx", f_ref, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            },
        )
    assert res.status_code == 202
    data = res.json()
    assert "jobId" in data
    assert isinstance(data["jobId"], str)
    assert len(data["jobId"]) > 0


# ===========================================================================
# 3. GET /api/jobs/{jobId}
# ===========================================================================

def test_get_job_404_for_unknown_id(client):
    res = client.get("/api/jobs/non-existent-uuid")
    assert res.status_code == 404
    data = res.json()
    assert "not found" in (data.get("error") or data.get("detail", "")).lower()


# ===========================================================================
# 4. End-to-end Job Processing & Report & Download
# ===========================================================================

def test_job_processing_and_download(client):
    with open(ORIGINAL, "rb") as f_orig, open(REFERENCE, "rb") as f_ref:
        res = client.post(
            "/api/convert",
            files={
                "target": ("climate_original.docx", f_orig, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                "reference": ("climate_reference.docx", f_ref, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            },
        )
    assert res.status_code == 202
    job_id = res.json()["jobId"]

    # In TestClient, BackgroundTasks run during request teardown,
    # but run_job delegates to executor thread. Run synchronous sync to ensure completion.
    job_dir = _job_dir(job_id)
    target_path = os.path.join(job_dir, "target.docx")
    ref_path = os.path.join(job_dir, "reference.docx")
    _run_job_sync(job_id, target_path, ref_path)

    # Poll status
    res = client.get(f"/api/jobs/{job_id}")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "done"
    assert "error" not in data or data["error"] is None
    assert "report" in data
    report = data["report"]
    assert "sectionChanges" in report
    assert "roles" in report
    assert "classifier" in report
    assert report["classifier"] in ("fallback", "llm")
    assert data["downloadUrl"] == f"/api/jobs/{job_id}/download"

    # Download output
    res_dl = client.get(f"/api/jobs/{job_id}/download")
    assert res_dl.status_code == 200
    assert "application/vnd.openxmlformats" in res_dl.headers.get("content-type", "")

    # Output file is a valid DOCX package
    dl_bytes = res_dl.content
    with io.BytesIO(dl_bytes) as buf:
        with zipfile.ZipFile(buf) as zf:
            assert "word/document.xml" in zf.namelist()
            assert "word/styles.xml" in zf.namelist()

    # Clean up with DELETE /api/jobs/{jobId}
    res_del = client.delete(f"/api/jobs/{job_id}")
    assert res_del.status_code == 200
    assert res_del.json() == {"status": "deleted"}

    # Second GET should now be 404
    res_gone = client.get(f"/api/jobs/{job_id}")
    assert res_gone.status_code == 404
    assert not os.path.exists(job_dir)


def test_download_404_when_job_missing(client):
    res = client.get("/api/jobs/missing-id/download")
    assert res.status_code == 404


def test_delete_404_when_job_missing(client):
    res = client.delete("/api/jobs/missing-id")
    assert res.status_code == 404


# ===========================================================================
# 5. Previews endpoint security & error handling
# ===========================================================================

def test_preview_invalid_side(client):
    res = client.get("/api/jobs/123/preview/middle/page-1.jpg")
    assert res.status_code == 400


def test_preview_path_traversal_blocked(client):
    res = client.get("/api/jobs/123/preview/before/../../etc/passwd")
    assert res.status_code in (400, 404)
