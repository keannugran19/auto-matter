# Architecture (SPEC.md §2)

> **Canonical source:** [`../SPEC.md § 2. Architecture`](../SPEC.md#2-architecture)

---

## Core Principle (SPEC.md §1)

**Split every formatting property into presentation or meaning.**

- **Presentation** — font, size, line spacing, indentation, alignment. Owned by the app. Stripped
  from the target's direct formatting and replaced wholesale from the reference spec.
- **Meaning** — bold, italic, underline, strikethrough, superscript on individual runs. Authorial
  intent. Preserved untouched.

Failure in either direction is visually catastrophic:

- Fail to strip direct presentation → new styles don't apply (direct formatting wins over styles).
- Strip run-level emphasis → document loses bold/italics. Content damage.

---

## 5-Stage Pipeline

Five stages, each independently testable:

```
reference.docx ─┐
                ├─▶ [1] resolve ─▶ [2] digest ─▶ [3] classify ─▶ [4] derive spec ─┐
target.docx ────┘                                                                  │
                                                                                   ▼
target.docx ──────────────────────────────────────────────────▶ [5] patch in place ─▶ output.docx
```

| Stage | Name        | Description                                                                              | Spec Section                             |
| ----- | ----------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1     | Resolve     | Compute the _effective_ formatting of every paragraph in both documents                  | [§3](../specs/02-formatting-resolver.md) |
| 2     | Digest      | Reduce each document to one compact line per paragraph                                   | [§4](../specs/03-digest.md)              |
| 3     | Classify    | One LLM call labels paragraphs in both documents against one shared taxonomy             | [§5](../specs/04-classification.md)      |
| 4     | Derive spec | For each role, aggregate the reference paragraphs into a single formatting specification | [§7](../specs/06-spec-derivation.md)     |
| 5     | Patch       | Modify the target's XML in place: sanitise, apply styles, rewrite section properties     | [§8](../specs/07-in-place-patch.md)      |

A sixth step (preview rendering) runs after the patch to produce before/after JPEGs:

| Step | Name    | Description                                           | Spec Section                           |
| ---- | ------- | ----------------------------------------------------- | -------------------------------------- |
| 6    | Preview | Convert DOCX → PDF → JPEGs via LibreOffice + pdftoppm | [§9](../specs/08-preview-rendering.md) |

---

## Implementation Reference

| Stage              | Module                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 1            | [`backend/app/ooxml/resolver.py`](../backend/app/ooxml/resolver.py)                                                                                                         |
| Stage 2            | [`backend/app/ooxml/inventory.py`](../backend/app/ooxml/inventory.py)                                                                                                       |
| Stage 3 (LLM)      | [`backend/app/classify/llm.py`](../backend/app/classify/llm.py)                                                                                                             |
| Stage 3 (fallback) | [`backend/app/classify/fallback.py`](../backend/app/classify/fallback.py)                                                                                                   |
| Stage 4            | [`backend/app/ooxml/spec.py`](../backend/app/ooxml/spec.py)                                                                                                                 |
| Stage 5            | [`backend/app/ooxml/restyle.py`](../backend/app/ooxml/restyle.py) + [`sanitize.py`](../backend/app/ooxml/sanitize.py) + [`numbering.py`](../backend/app/ooxml/numbering.py) |
| Stage 6            | [`backend/app/render.py`](../backend/app/render.py)                                                                                                                         |
| Orchestration      | [`backend/app/jobs.py`](../backend/app/jobs.py)                                                                                                                             |
