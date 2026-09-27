# Deterministic Fallback Classifier (SPEC.md §6)

> **Canonical source:** [`../SPEC.md § 6. Deterministic fallback`](../SPEC.md#6-deterministic-fallback)

---

## Responsibility

Provide a deterministic, zero-external-dependency paragraph role classifier that
serves as a **safety net** when the LLM classifier (§5) is unavailable.

> **Important:** This is a degraded safety net, not a co-equal path. The LLM classifier
> produces materially better results, especially on hand-formatted documents with no named styles.
> The UI must surface when the fallback was used.

---

## Inference Signals

The fallback infers roles from:

| Signal                           | Example                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- |
| `w:pStyle` names                 | `Heading1` → `heading_1`, `Title` → `title`, `ListParagraph` → `list_item` |
| `w:outlineLvl` value             | Level 0 → `heading_1`, Level 1 → `heading_2`, etc.                         |
| Presence of `w:numPr`            | → `list_item`                                                              |
| Font size relative to modal size | Significantly larger → heading candidate                                   |
| Emphasis ratios                  | `italic_ratio > 0.6` → `quote` candidate                                   |

---

## Quality Caveat

Documents with no named styles are the real test case. On hand-formatted files (direct bold/size,
no `w:pStyle`), the fallback produces materially worse results than the LLM.

This must be surfaced in the change report via the `"classifier": "fallback"` field.

---

## Implementation Reference

| Artifact | Path                                                                      |
| -------- | ------------------------------------------------------------------------- |
| Module   | [`backend/app/classify/fallback.py`](../backend/app/classify/fallback.py) |
| Tests    | [`backend/tests/test_inventory.py`](../backend/tests/test_inventory.py)   |
