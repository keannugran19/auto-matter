# Frontend → Spec Coverage Map

> Maps every frontend component and file to the SPEC.md section(s) it implements.
> See also: [`../docs/SPEC_COMPLIANCE.md`](../docs/SPEC_COMPLIANCE.md) for the full compliance matrix.

---

## Coverage by File

| File                                                                 | Spec Section(s) | Feature                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`app/page.tsx`](app/page.tsx)                                       | §10, §12        | Primary application page: two-pane upload, polling `GET /api/jobs/{jobId}` every 1 s, job lifecycle state machine (`idle → uploading → queued → running → done/error`) |
| [`app/components/DropZone.tsx`](app/components/DropZone.tsx)         | §10, §12        | Drag-and-drop DOCX file validation; enforces `.docx` client-side before upload                                                                                         |
| [`app/components/PreviewPane.tsx`](app/components/PreviewPane.tsx)   | §9, §12         | Before/after synchronized split-screen page viewer; renders LibreOffice-generated JPEG pages from `previews.before[]` and `previews.after[]`                           |
| [`app/components/ChangeReport.tsx`](app/components/ChangeReport.tsx) | §10             | Renders the full change report: `sectionChanges`, per-role `specApplied` table, `warnings` list, `classifier` badge (`LLM` or `Fallback`), download button             |
| [`app/api/[...path]/route.ts`](app/api/[...path]/route.ts)           | §10             | Next.js API proxy rewrite: forwards all `/api/*` requests to the backend at `BACKEND_URL`, preserving method, headers, and body                                        |
| [`app/layout.tsx`](app/layout.tsx)                                   | §12             | Root Next.js layout — metadata, global CSS                                                                                                                             |
| [`app/globals.css`](app/globals.css)                                 | §12             | Tailwind CSS base styles                                                                                                                                               |

---

## API Endpoints Used by Frontend

| Endpoint                                      | Used In                                | Spec Section |
| --------------------------------------------- | -------------------------------------- | ------------ |
| `POST /api/convert`                           | `page.tsx` — `handleStartConversion()` | §10          |
| `GET /api/jobs/{jobId}`                       | `page.tsx` — polling interval          | §10          |
| `GET /api/jobs/{jobId}/download`              | `ChangeReport.tsx` — download button   | §10          |
| `GET /api/jobs/{jobId}/preview/{side}/{file}` | `PreviewPane.tsx` — `<img>` src        | §9, §10      |
| `DELETE /api/jobs/{jobId}`                    | `page.tsx` — `handleReset()`           | §10          |

---

## Frontend Environment Variables

| Variable      | Default                 | Description                                   | Spec Section |
| ------------- | ----------------------- | --------------------------------------------- | ------------ |
| `BACKEND_URL` | `http://localhost:8000` | Backend API URL for the Next.js proxy rewrite | §10          |
