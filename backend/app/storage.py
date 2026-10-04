"""
storage.py — Supabase Storage upload for completed job PDFs.
"""
from __future__ import annotations

import os
from typing import Optional

_client = None


def _get_client():
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if url and key:
            from supabase import create_client
            _client = create_client(url, key)
    return _client


def upload_pdf(job_id: str, pdf_path: str, lesson_id: Optional[str] = None) -> Optional[str]:
    """
    Upload a PDF file to Supabase Storage bucket 'pdfs'.
    Storage path: pdfs/{lesson_id}/{job_id}.pdf  (or pdfs/orphan/{job_id}.pdf if no lesson_id)
    Returns the storage path on success, None if Supabase not configured or upload fails.
    """
    client = _get_client()
    if client is None:
        return None

    folder = lesson_id or "orphan"
    storage_path = f"{folder}/{job_id}.pdf"

    try:
        with open(pdf_path, "rb") as f:
            data = f.read()
        client.storage.from_("pdfs").upload(
            path=storage_path,
            file=data,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )
        return storage_path
    except Exception as e:
        # Non-fatal: log and continue
        print(f"[storage] PDF upload failed for job {job_id}: {e}")
        return None


def update_lesson_pdf_url(lesson_id: str, storage_path: str) -> bool:
    """
    Update the lessons table pdf_url column in Supabase Postgres with the storage path.
    Returns True on success.
    """
    client = _get_client()
    if client is None:
        return False
    try:
        client.table("lessons").update({"pdf_url": storage_path}).eq("id", lesson_id).execute()
        return True
    except Exception as e:
        print(f"[storage] DB update failed for lesson {lesson_id}: {e}")
        return False
