# ADR-0005: Structure Changes — Out of Scope

## Status

Accepted

## Context

When transferring formatting from a reference document to a target document, there may be
structural differences: the reference might use a three-level heading hierarchy (A / 1 / a)
while the target has flat body text. The question is whether the engine should restructure
the target's content to match the reference's outline hierarchy.

## Decision

**Structure changes are out of scope.** The app makes the target's headings _look_ like the
reference's headings. It does not invent outline hierarchy where the target has none.

Structural editing is a content edit, not a formatting transfer operation.

## Consequences

- **Scope is contained and well-defined.** The engine only transfers visual formatting properties.
- **No risk of content damage** from automated structural changes.
- Users who need structural changes must make them manually in Word before or after using the app.
- The semantic taxonomy still infers roles (heading_1, heading_2, body) for formatting purposes —
  it just does not restructure the document to match the reference's outline.

## Spec Reference

SPEC.md §0 — "Structure changes | Out of scope | The app makes the target's headings look like
the reference's headings. It does not invent the reference's outline hierarchy (A / 1 / a) where
the target has none. That is a content edit, not a formatting copy."
