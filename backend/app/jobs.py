"""
jobs.py — In-memory job store and background job runner.

SPEC.md §10: The API is async because LibreOffice rendering takes seconds.
The frontend polls GET /api/jobs/{jobId}.

Job lifecycle:  queued → running → done | error

Change report format (§10):
  {
    "sectionChanges": { "pageSize": bool, "margins": bool, "headerFooterRemoved": bool },
    "roles": [ { "role", "paragraphCount", "specApplied": {...}, "source": "reference"|"fallback" } ],
    "warnings": [ { "severity": "info"|"warn", "message", "paragraphIndex"?: int } ],
    "classifier": "llm" | "fallback"
  }
"""
from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Optional

from .ooxml.package import DocxPackage
from .ooxml.resolver import resolve_document
from .ooxml.inventory import digest
from .ooxml.spec import derive_spec, FORMATTING_POLICY
from .ooxml.restyle import restyle
from .classify.taxonomy import Role
from .classify.fallback import classify as fallback_classify
from .classify.llm import classify_both, MissingApiKeyError, LLMClassificationError
from .render import render_docx, is_available as lo_available


# ---------------------------------------------------------------------------
# Job state
# ---------------------------------------------------------------------------

@dataclass
class Job:
    job_id:       str
    status:       str = "queued"   # queued | running | done | error
    error:        Optional[str] = None
    report:       Optional[dict] = None
    previews:     Optional[dict] = None   # {"before": [...], "after": [...]}
    download_path: Optional[str] = None  # absolute path to restyled DOCX
    api_key:      Optional[str] = None


_jobs: dict[str, Job] = {}


def create_job(api_key: Optional[str] = None) -> Job:
    job = Job(job_id=str(uuid.uuid4()), api_key=api_key)
    _jobs[job.job_id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


def delete_job(job_id: str) -> bool:
    """Purge job state and any files on disk. Returns True if job existed."""
    job = _jobs.pop(job_id, None)
    if job is None:
        return False
    # Remove job directory if it exists
    job_dir = _job_dir(job_id)
    if os.path.isdir(job_dir):
        shutil.rmtree(job_dir, ignore_errors=True)
    return True


def _job_dir(job_id: str) -> str:
    base = os.environ.get("JOB_DIR", tempfile.gettempdir())
    return os.path.join(base, "auto_matter_jobs", job_id)


# ---------------------------------------------------------------------------
# Change report builder
# ---------------------------------------------------------------------------

def _build_report(
    derived,
    target_roles: list[Role],
    classifier: str,
) -> dict:
    section = derived.section

    # Infer what changed relative to a typical document (we flag anything non-default)
    page_size_changed   = (section.page_width is not None or section.page_height is not None)
    margins_changed     = any(
        v is not None for v in [
            section.margin_top, section.margin_right,
            section.margin_bottom, section.margin_left,
        ]
    )
    hf_removed = not section.has_header and not section.has_footer

    role_counts: dict[Role, int] = {}
    for r in target_roles:
        role_counts[r] = role_counts.get(r, 0) + 1

    roles_report = []
    for role, count in sorted(role_counts.items(), key=lambda x: -x[1]):
        rs = derived.roles.get(role)
        spec_applied: dict = {}
        if rs:
            spec_applied = {
                "font":         rs.font_name,
                "size_pt":      (rs.font_size_half_points / 2) if rs.font_size_half_points else None,
                "bold":         rs.bold,
                "italic":       rs.italic,
                "alignment":    rs.alignment,
                "space_before": rs.space_before,
                "space_after":  rs.space_after,
                "line_spacing": rs.line_spacing,
            }
        roles_report.append({
            "role":           role.value,
            "paragraphCount": count,
            "specApplied":    spec_applied,
            "source":         rs.source if rs else "fallback",
        })

    return {
        "sectionChanges": {
            "pageSize":           page_size_changed,
            "margins":            margins_changed,
            "headerFooterRemoved": hf_removed,
        },
        "roles":      roles_report,
        "warnings":   [{"severity": "warn", "message": w} for w in derived.warnings],
        "classifier": classifier,
    }


# ---------------------------------------------------------------------------
# Background job execution
# ---------------------------------------------------------------------------

def _run_job_sync(
    job_id: str,
    target_path: str,
    ref_path: str,
    api_key: Optional[str] = None,
) -> None:
    """
    Synchronous job body. Runs in a thread pool so the event loop is not blocked.

    Steps:
      1. Open both packages, resolve both documents
      2. Digest both documents
      3. Classify (LLM if key present, else fallback)
      4. Derive spec from reference
      5. Restyle target (sanitise + inject FT_* styles + section + numbering)
      6. Render before/after previews (if LibreOffice available)
      7. Update job state
    """
    job = _jobs[job_id]
    job.status = "running"

    try:
        job_dir = _job_dir(job_id)
        os.makedirs(job_dir, exist_ok=True)

        # --- 1. Open and resolve ---
        ref_pkg    = DocxPackage.open(ref_path)
        target_pkg = DocxPackage.open(target_path)
        ref_paras  = resolve_document(ref_pkg)
        tgt_paras  = resolve_document(target_pkg)

        # --- 2. Digest ---
        ref_hints    = fallback_classify(ref_paras)
        tgt_hints    = fallback_classify(tgt_paras)
        ref_digests  = digest(ref_paras, ref_hints)
        tgt_digests  = digest(tgt_paras, tgt_hints)

        # --- 3. Classify ---
        classifier = "fallback"
        llm_warning: Optional[str] = None
        try:
            ref_roles, tgt_roles = classify_both(
                ref_digests, tgt_digests,
                ref_paras, tgt_paras,
                api_key=api_key or job.api_key,
            )
            classifier = "llm"
        except MissingApiKeyError:
            ref_roles = fallback_classify(ref_paras)
            tgt_roles = fallback_classify(tgt_paras)
        except Exception as e:
            ref_roles = fallback_classify(ref_paras)
            tgt_roles = fallback_classify(tgt_paras)
            llm_warning = f"LLM classification encountered an issue ({e}); used deterministic fallback."

        # --- 4. Derive spec ---
        derived = derive_spec(
            ref_pkg, ref_roles, target_roles=tgt_roles, policy=FORMATTING_POLICY
        )
        if llm_warning:
            derived.warnings.append(llm_warning)

        # --- 5. Restyle ---
        out_path = os.path.join(job_dir, "output.docx")
        restyle(target_pkg, derived, tgt_roles, out_path, ref_pkg=ref_pkg)

        # --- 6. Render previews ---
        previews: dict[str, list[str]] = {"before": [], "after": []}
        if lo_available():
            before_dir = os.path.join(job_dir, "before")
            after_dir  = os.path.join(job_dir, "after")
            os.makedirs(before_dir, exist_ok=True)
            os.makedirs(after_dir, exist_ok=True)
            before_files = render_docx(target_path, before_dir)
            after_files  = render_docx(out_path, after_dir)
            previews["before"] = [
                f"/api/jobs/{job_id}/preview/before/{os.path.basename(p)}"
                for p in before_files
            ]
            previews["after"] = [
                f"/api/jobs/{job_id}/preview/after/{os.path.basename(p)}"
                for p in after_files
            ]

        # --- 7. Update job ---
        job.report        = _build_report(derived, tgt_roles, classifier)
        job.previews      = previews
        job.download_path = out_path
        job.status        = "done"

    except Exception:
        job.status = "error"
        job.error  = traceback.format_exc()


async def run_job(
    job_id: str,
    target_path: str,
    ref_path: str,
    api_key: Optional[str] = None,
) -> None:
    """Async wrapper: runs the job in a thread and returns immediately."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,  # default ThreadPoolExecutor
        _run_job_sync,
        job_id, target_path, ref_path, api_key,
    )
