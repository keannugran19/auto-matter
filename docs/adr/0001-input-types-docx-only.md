# ADR-0001: Input Types — DOCX Target + DOCX Reference Only

## Status

Accepted

## Context

The app must accept some form of reference document to extract formatting from. Two candidate
formats were considered:

- **DOCX reference:** Contains explicit formatting values in structured XML (font names,
  sizes in half-points, spacing in twips, etc.). These are directly readable.
- **PDF reference:** A rendered, visual representation. Extracting formatting would require
  back-calculating font sizes from glyph advance widths, which is fragile and completely
  breaks on scanned or image-based PDFs.

## Decision

Accept **DOCX target + DOCX reference only**. PDF references are not supported.

## Consequences

- **Simpler, more reliable formatting extraction.** All values are present verbatim in the XML.
- **Users must supply a DOCX reference document**, not a PDF. This is communicated clearly in the UI.
- The validation layer (`_validate_and_save_docx()`) enforces `.docx` extension and validates
  the zip structure, returning `400 Bad Request` for any other format.

## Spec Reference

SPEC.md §0 — "Input types | DOCX target + DOCX reference only | A DOCX reference exposes exact
formatting values. A PDF reference would require back-calculating font sizes from glyph advance
widths — fragile, and dead on scanned files."

## Implementation

[`backend/app/main.py`](../../backend/app/main.py) — `_validate_and_save_docx()`
