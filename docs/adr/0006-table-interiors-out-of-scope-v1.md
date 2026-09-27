# ADR-0006: Table Interiors — Left Alone in v1

## Status

Accepted

## Context

Tables in DOCX documents have a complex formatting model: table-level styles, row-level
styles, cell-level styles, and paragraph styles within cells all interact. Restyling text
inside table cells using the same approach as body paragraphs risks:

- Breaking column width calculations.
- Corrupting table layout when font sizes change.
- Disrupting merged-cell relationships.

## Decision

**Table interiors are left alone in v1.** The engine does not apply FT\_\* styles or sanitise
formatting inside table cells. Tables are preserved verbatim.

When the reference document's formatting spec implies changes that would affect table content,
this is surfaced in the change report as an informational note, not silently applied.

## Consequences

- **Table structure and interior formatting are always safe.** No risk of breaking column layouts.
- **v1 scope is achievable.** Table restyling is a significant additional complexity and can be
  scoped to a v2 feature with an explicit table-aware mode.
- **Users are informed** via the change report that table interiors were skipped.

## Spec Reference

SPEC.md §0 — "Table interiors | Left alone in v1 | Restyling text inside table cells risks
breaking column layouts. Surface it in the change report instead."

SPEC.md §8f — "Do not touch: ... tables (structure and, in v1, interior text)"

## Implementation

- [`backend/app/ooxml/sanitize.py`](../../backend/app/ooxml/sanitize.py) — `sanitise_document()` skips table paragraphs
