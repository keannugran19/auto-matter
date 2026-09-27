# Changelog

All notable changes to Auto-Matter are documented here.

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.
Versions correspond to `SPEC.md` spec versions (see version header in `SPEC.md`).

---

## [1.0.0] — 2026-09-27

### Added — Core Engine

- **Stage 1 — Formatting Resolver** (`backend/app/ooxml/resolver.py`)
    - ECMA-376 compliant 6-layer formatting cascade (docDefaults → style chain → numbering → direct pPr → rStyle → direct rPr)
    - `ResolvedParagraph` + `RunRecord` output types with full unit coverage
    - Cycle guard for `w:basedOn` inheritance chains
    - Numbering level property interaction (layers 3–4)

- **Stage 2 — Digest** (`backend/app/ooxml/inventory.py`)
    - 15-field compact paragraph digest for LLM consumption
    - Emphasis ratios (`bold_ratio`, `italic_ratio`, `underline_ratio`)
    - `role_hint` field from deterministic fallback as prior

- **Stage 3 — Classification** (`backend/app/classify/`)
    - LLM classifier (`llm.py`): single structured-output call, both documents, Gemini 2.0 Flash
    - SHA-256 caching of classification results
    - Closed 15-role taxonomy (`taxonomy.py`) with validation (`validate()`)
    - Deterministic 7-rule fallback classifier (`fallback.py`)
    - `classifier` field in change report (`"llm"` or `"fallback"`)

- **Stage 4 — Spec Derivation** (`backend/app/ooxml/spec.py`)
    - Mode-based aggregation (`_mode()`) — never mean
    - `RoleSpec`, `SectionSpec`, `DerivedSpec` data classes
    - Fallback derivation rules (§7): `heading_3` from `heading_2`, `quote` from `body + italic`
    - `FORMATTING_POLICY` enforcement layer (minimum font size, Legal page format, heading spacing)

- **Stage 5 — In-Place Patch** (`backend/app/ooxml/`)
    - `sanitize.py`: strips presentation properties, preserves authorial emphasis, never strips load-bearing `w:rStyle`
    - Order-enforcing insert helpers (`_insert_ordered_rpr`, `_insert_ordered_ppr`) for §8b compliance
    - `restyle.py`: `FT_*`-namespaced style injection, paragraph `w:pStyle` assignment, `w:sectPr` rewrite
    - `numbering.py`: `abstractNum`/`numId` copy + ID remapping; creates `numbering.xml` from scratch if absent
    - `package.py`: byte-identical round-tripper for modified and unmodified parts

- **Stage 6 — Preview Rendering** (`backend/app/render.py`)
    - Headless LibreOffice DOCX → PDF conversion
    - `pdftoppm` PDF → JPEG rasterisation at 100 DPI
    - `is_available()` guard for local dev without LibreOffice

- **API** (`backend/app/main.py`, `backend/app/jobs.py`)
    - `POST /api/convert` → 202 with `jobId`
    - `GET /api/jobs/{jobId}` → status + change report + preview URLs
    - `GET /api/jobs/{jobId}/download` → restyled DOCX
    - `GET /api/jobs/{jobId}/preview/{side}/{filename}` → JPEG (path traversal protected)
    - `DELETE /api/jobs/{jobId}` → purge
    - Async background job runner via `asyncio` thread pool
    - In-memory job store with UUID job IDs

- **Frontend** (`frontend/`)
    - Next.js 14 + React 18 + TypeScript + Tailwind CSS
    - Two-pane drag-and-drop upload (`DropZone.tsx`)
    - 1-second polling job status stepper
    - Synchronized split-screen preview viewer (`PreviewPane.tsx`)
    - Change report table with download button (`ChangeReport.tsx`)
    - Optional Gemini API key input (persisted in `localStorage`)

### Added — Test Suite

- **239 passing tests** across 10 test files
- Acceptance test (`test_acceptance.py`): end-to-end ground truth on `climate_original.docx` + `climate_reference.docx`
- All §12 table expected values asserted (page size, margins, font, spacing, headings, quotes)
- Hyperlink relationship preservation verified
- Zero media loss verified

### Added — SDD Documentation Structure

- `specs/` — 14 decomposed feature spec files (one per SPEC.md section)
- `docs/adr/` — 6 Architecture Decision Records (MADR format) for all §0 locked decisions
- `docs/SPEC_COMPLIANCE.md` — living compliance matrix (spec section → implementation → tests)
- `backend/tests/SPEC_COVERAGE.md` — test-to-spec traceability index
- `frontend/SPEC_COVERAGE.md` — frontend component-to-spec coverage map
- `CHANGELOG.md` — this file

### Infrastructure

- Docker Compose with Python 3.12-slim backend (LibreOffice + Poppler) + Next.js frontend
- `.env.example` with all environment variable documentation
- `run_local.sh` for local development without Docker
