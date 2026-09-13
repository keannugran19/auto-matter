"""
main.py — FastAPI application routes for DOCX Format Transfer.

SPEC.md §10 API Contract:
  POST /api/convert
    multipart/form-data: target=<file.docx>, reference=<file.docx>
    → 202 { jobId: string }
    → 400 { error: string } on non-DOCX, oversized, or corrupt input

  GET /api/jobs/{jobId}
    → { status: "queued"|"running"|"done"|"error",
        error?: string,
        report?: {...},
        previews?: { before: string[], after: string[] },
        downloadUrl?: string }

  GET /api/jobs/{jobId}/download → the restyled .docx

  DELETE /api/jobs/{jobId} → purge inputs, outputs, previews
"""
from __future__ import annotations

import os
import re
import zipfile
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .jobs import (
    create_job,
    delete_job,
    get_job,
    run_job,
    _job_dir,
)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
PREVIEW_FILENAME_REGEX = re.compile(r"^page-\d+\.jpg$")

app = FastAPI(
    title="Auto-Matter — DOCX Format Transfer API",
    description="Deterministic Document Formatting Web Application for Word Documents",
    version="1.0.0",
)

# Enable CORS for the frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "app": "Auto-Matter",
        "tagline": "Automate the formatting. Keep the content.",
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok"}


def _validate_and_save_docx(upload: UploadFile, dest_path: str) -> None:
    """
    Validate that an uploaded file is a non-oversized, valid DOCX file,
    and save it to dest_path.
    Raises HTTPException(400) if validation fails.
    """
    filename = upload.filename or ""
    if not filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{filename}' must have a .docx extension",
        )

    # Read content with size check
    content = upload.file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{filename}' exceeds the maximum allowed size of 50MB",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{filename}' is empty",
        )

    # Write to destination
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(content)

    # Validate ZIP integrity and presence of word/document.xml
    try:
        with zipfile.ZipFile(dest_path, "r") as zf:
            if "word/document.xml" not in zf.namelist():
                raise ValueError("Missing word/document.xml")
    except Exception as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{filename}' is not a valid DOCX document: {e}",
        )


@app.post("/api/convert", status_code=status.HTTP_202_ACCEPTED)
async def convert(
    background_tasks: BackgroundTasks,
    target: UploadFile = File(...),
    reference: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Accept target and reference DOCX files, create a job, and start background processing.
    Optionally accepts a Gemini API key via form field or X-API-Key header.
    """
    effective_key = (api_key or x_api_key or "").strip() or None
    job = create_job(api_key=effective_key)
    job_dir = _job_dir(job.job_id)
    os.makedirs(job_dir, exist_ok=True)

    target_path = os.path.join(job_dir, "target.docx")
    ref_path = os.path.join(job_dir, "reference.docx")

    try:
        _validate_and_save_docx(target, target_path)
        _validate_and_save_docx(reference, ref_path)
    except HTTPException as e:
        # Clean up job and folder on validation failure
        delete_job(job.job_id)
        return JSONResponse(
            status_code=e.status_code,
            content={"error": e.detail, "detail": e.detail},
        )

    background_tasks.add_task(run_job, job.job_id, target_path, ref_path, effective_key)
    return {"jobId": job.job_id}


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    """
    Poll status, change report, and previews for a conversion job.
    """
    job = get_job(job_id)
    if job is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": f"Job '{job_id}' not found", "detail": f"Job '{job_id}' not found"},
        )

    response = {
        "status": job.status,
    }
    if job.error:
        response["error"] = job.error
    if job.report:
        response["report"] = job.report
    if job.previews:
        response["previews"] = job.previews
    if job.status == "done":
        response["downloadUrl"] = f"/api/jobs/{job_id}/download"

    return response


@app.get("/api/jobs/{job_id}/download")
def download_output(job_id: str):
    """
    Download the restyled DOCX file once the job has succeeded.
    """
    job = get_job(job_id)
    if job is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": f"Job '{job_id}' not found"},
        )

    if job.status != "done" or not job.download_path or not os.path.isfile(job.download_path):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": f"Job '{job_id}' output is not ready for download"},
        )

    return FileResponse(
        job.download_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="restyled.docx",
    )


@app.get("/api/jobs/{job_id}/preview/{side}/{filename}")
def get_preview_image(job_id: str, side: str, filename: str):
    """
    Serve a generated page preview JPEG.
    """
    if side not in ("before", "after"):
        raise HTTPException(status_code=400, detail="Invalid preview side")

    if not PREVIEW_FILENAME_REGEX.match(filename):
        raise HTTPException(status_code=400, detail="Invalid preview filename")

    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    image_path = os.path.join(_job_dir(job_id), side, filename)
    if not os.path.isfile(image_path):
        raise HTTPException(status_code=404, detail="Preview image not found")

    return FileResponse(image_path, media_type="image/jpeg")


@app.delete("/api/jobs/{job_id}")
def purge_job(job_id: str):
    """
    Delete job state and purge input/output/preview files from disk.
    """
    deleted = delete_job(job_id)
    if not deleted:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": f"Job '{job_id}' not found"},
        )
    return {"status": "deleted"}
