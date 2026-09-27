# API Contract (SPEC.md §10)

> **Canonical source:** [`../SPEC.md § 10. API contract`](../SPEC.md#10-api-contract)

---

## Overview

All endpoints are asynchronous because LibreOffice rendering takes several seconds.
The frontend polls `GET /api/jobs/{jobId}` until the job is `done` or `error`.

Base URL: `http://localhost:8000` (or via frontend Next.js rewrite at `/api/*`)

---

## Endpoints

### `POST /api/convert`

Accept target and reference DOCX files, create a background conversion job.

**Request:** `multipart/form-data`

| Field       | Type         | Required | Description                                        |
| ----------- | ------------ | -------- | -------------------------------------------------- |
| `target`    | `.docx` file | ✅       | Document to be restyled (max 50 MB)                |
| `reference` | `.docx` file | ✅       | Document providing the visual styles (max 50 MB)   |
| `api_key`   | string       | ❌       | Optional Gemini API key (overrides server env var) |

**Response `202 Accepted`:**

```json
{ "jobId": "b18b4e72-97b7-4b68-99ee-799c759f271a" }
```

**Response `400 Bad Request`:**

```json
{ "error": "File 'file.txt' must have a .docx extension" }
```

Triggered by: non-DOCX extension, file > 50 MB, empty file, corrupt zip, or missing `word/document.xml`.

---

### `GET /api/jobs/{jobId}`

Poll job status, change report, and preview URLs.

**Response `200 OK`:**

```json
{
  "status": "queued" | "running" | "done" | "error",
  "error": "...",
  "report": {
    "sectionChanges": {
      "pageSize": true,
      "margins": true,
      "headerFooterRemoved": true
    },
    "roles": [
      {
        "role": "body",
        "paragraphCount": 14,
        "specApplied": {
          "font": "Times New Roman",
          "size_pt": 22.0,
          "bold": false,
          "italic": false,
          "alignment": "both",
          "space_before": 0,
          "space_after": 160,
          "line_spacing": 360
        },
        "source": "reference" | "fallback"
      }
    ],
    "warnings": [{ "severity": "info" | "warn", "message": "...", "paragraphIndex": 5 }],
    "classifier": "llm" | "fallback"
  },
  "previews": {
    "before": ["/api/jobs/{jobId}/preview/before/page-00001.jpg"],
    "after":  ["/api/jobs/{jobId}/preview/after/page-00001.jpg"]
  },
  "downloadUrl": "/api/jobs/{jobId}/download"
}
```

**Response `404 Not Found`:** Job ID not found.

---

### `GET /api/jobs/{jobId}/download`

Download the restyled DOCX file.

**Response `200 OK`:** `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
with `Content-Disposition: attachment; filename="restyled.docx"`.

**Response `400 Bad Request`:** Job not in `done` state or output file missing.

---

### `GET /api/jobs/{jobId}/preview/{side}/{filename}`

Serve a generated page preview JPEG.

| Parameter  | Values                  | Constraint                                                       |
| ---------- | ----------------------- | ---------------------------------------------------------------- |
| `side`     | `"before"` or `"after"` | Validated; 400 on invalid                                        |
| `filename` | `page-00001.jpg`        | Validated against regex `^page-\d+\.jpg$`; 400 on path traversal |

**Response `200 OK`:** `Content-Type: image/jpeg`

---

### `DELETE /api/jobs/{jobId}`

Purge all job state and associated files from disk.

**Response `200 OK`:**

```json
{ "status": "deleted" }
```

**Response `404 Not Found`:** Job ID not found.

---

## Implementation Reference

| Artifact        | Path                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| Routes          | [`backend/app/main.py`](../backend/app/main.py)                                 |
| Job runner      | [`backend/app/jobs.py`](../backend/app/jobs.py)                                 |
| Tests           | [`backend/tests/test_api.py`](../backend/tests/test_api.py)                     |
| Frontend client | [`frontend/app/page.tsx`](../frontend/app/page.tsx)                             |
| API proxy       | [`frontend/app/api/[...path]/route.ts`](../frontend/app/api/[...path]/route.ts) |
