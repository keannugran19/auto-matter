# Preview Rendering (SPEC.md §9)

> **Canonical source:** [`../SPEC.md § 9. Preview rendering`](../SPEC.md#9-preview-rendering)

---

## Responsibility

Convert both the original (before) and restyled (after) DOCX files to page-by-page JPEG
images for display in the two-pane preview UI.

---

## Pipeline

```bash
soffice --headless --convert-to pdf --outdir /tmp/out input.docx
pdftoppm -jpeg -r 100 /tmp/out/input.pdf /tmp/out/page
```

1. LibreOffice renders the DOCX to PDF (headless mode).
2. `pdftoppm` rasterises each PDF page to a JPEG at 100 DPI.
3. The backend serves the JPEGs via `GET /api/jobs/{jobId}/preview/{side}/{filename}`.

---

## Architectural Implication

> **This is not a nicety — it is what makes the output trustworthy**, and it doubles as the
> dev test harness. **The LibreOffice dependency rules out serverless/edge hosting.**
> The backend needs a container host: Fly, Render, Railway, or ECS.

---

## Availability

If LibreOffice is not installed (local dev without `libreoffice` + `poppler-utils`), the
`render.py` module's `is_available()` guard returns `False` and preview generation is skipped.
The job still completes with an empty `previews` dict.

---

## Implementation Reference

| Artifact   | Path                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| Module     | [`backend/app/render.py`](../backend/app/render.py)                                      |
| Dockerfile | [`backend/Dockerfile`](../backend/Dockerfile) — installs `libreoffice` + `poppler-utils` |
| Tests      | [`backend/tests/test_render.py`](../backend/tests/test_render.py)                        |
