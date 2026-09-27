# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for Auto-Matter.

ADRs document the significant technical decisions made during design and development,
following the [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision Records) format.

---

## Index

| ADR                                                     | Title                                              | Status       | Spec Ref   |
| ------------------------------------------------------- | -------------------------------------------------- | ------------ | ---------- |
| [ADR-0001](0001-input-types-docx-only.md)               | Input types: DOCX target + DOCX reference only     | **Accepted** | SPEC.md §0 |
| [ADR-0002](0002-role-detection-llm.md)                  | Role detection: LLM classifies every paragraph     | **Accepted** | SPEC.md §0 |
| [ADR-0003](0003-output-method-in-place-patch.md)        | Output method: restyle the original in place       | **Accepted** | SPEC.md §0 |
| [ADR-0004](0004-deviation-doctrine-literal-fidelity.md) | Deviation doctrine: literal fidelity with warnings | **Accepted** | SPEC.md §0 |
| [ADR-0005](0005-structure-changes-out-of-scope.md)      | Structure changes: out of scope                    | **Accepted** | SPEC.md §0 |
| [ADR-0006](0006-table-interiors-out-of-scope-v1.md)     | Table interiors: left alone in v1                  | **Accepted** | SPEC.md §0 |

---

## How to File a New ADR

1. Create a new file: `docs/adr/NNNN-short-title.md` (increment N from the last ADR).
2. Use the MADR template below.
3. Update this index.
4. Update `SPEC.md` if the decision affects the authoritative spec.

### MADR Template

```markdown
# ADR-NNNN: [Short Decision Title]

## Status

Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Context

[What is the issue motivating this decision?]

## Decision

[What is the change being proposed or decided?]

## Consequences

[What becomes easier or harder after this decision?]

## Spec Reference

SPEC.md §N — "[Quoted text from spec]"
```
