# ADR-0002: Role Detection — LLM Classifies Every Paragraph

## Status

Accepted

## Context

The engine needs to determine what semantic role each paragraph plays (title, heading, body,
quote, etc.) in order to map reference formatting onto corresponding target paragraphs.

Two approaches were considered:

- **Heuristic/rule-based detection:** Inspect `w:pStyle` names, `w:outlineLvl`, `w:numPr`,
  font size relative to modal size, and emphasis ratios.
- **LLM classification:** Send a compact digest of each paragraph to a language model for
  structured role assignment.

The key constraint: **many real documents have no named styles at all** — formatted entirely
with direct bold/size. There is no reliable structural signal to key off. A pure heuristic
approach produces materially worse results on these documents.

## Decision

Use an **LLM to classify every paragraph** in both documents simultaneously in a single
structured-output call. The LLM is given a compact digest (not raw text) of each paragraph
and returns structured JSON with role assignments.

A **deterministic fallback** is retained as a safety net for when the LLM is unavailable
(no API key, network failure, quota). The fallback must be clearly labelled as such in the UI.

## Consequences

- **Better semantic classification**, especially on hand-formatted documents without named styles.
- **External API dependency** (Google Gemini). The system gracefully degrades to the fallback.
- **SHA-256 caching** of results prevents redundant API calls for the same input files.
- The `classifier` field in the change report (`"llm"` or `"fallback"`) is required so users
  know which path was taken.

## Spec Reference

SPEC.md §0 — "Role detection | LLM classifies every paragraph | Many real documents have no
named styles at all — formatted by hand with direct bold/size. There is no structural signal
to key off."

## Implementation

- [`backend/app/classify/llm.py`](../../backend/app/classify/llm.py)
- [`backend/app/classify/fallback.py`](../../backend/app/classify/fallback.py)
- [`backend/app/classify/taxonomy.py`](../../backend/app/classify/taxonomy.py)
