# Stage 3 — Classification (SPEC.md §5)

> **Canonical source:** [`../SPEC.md § 5. Stage 3 — classification`](../SPEC.md#5-stage-3--classification)

---

## Responsibility

Assign a semantic role to every paragraph in both documents using a single LLM call
with a shared closed taxonomy. Both documents are classified simultaneously to ensure
label alignment.

---

## Design Rule: One Call, Both Documents, One Shared Taxonomy

Classifying them separately invites the model to invent divergent label sets that cannot be joined.
The model receives digests from both documents in a single structured-output call.

---

## Closed Taxonomy (15 Roles)

The model may return **nothing outside this set**. Unrecognised labels are mapped to `body`.

| Role              | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `title`           | Document title                                           |
| `subtitle`        | Line under the title, e.g. a source or adaptation credit |
| `series_label`    | Short label above the title, e.g. "Lesson 42"            |
| `aim`             | Purpose/objective statement, often with a bold lead-in   |
| `heading_1`       | Top-level section heading                                |
| `heading_2`       | Sub-heading                                              |
| `heading_3`       | Sub-sub-heading                                          |
| `body`            | Normal prose                                             |
| `quote`           | Quoted or scripture block, typically italic and indented |
| `reference_line`  | A citation label on its own line, e.g. "Psalm 46:2-3,"   |
| `definition_term` | A term being defined                                     |
| `definition_meta` | Part-of-speech or similar annotation under a term        |
| `list_item`       | Numbered or bulleted item                                |
| `caption`         | Figure or table caption                                  |
| `footer_note`     | Source/attribution line at the end                       |

---

## Requirements

- **Structured output, schema-constrained, temperature 0.**
- Validate every returned label against the enum. Unrecognised → `body`. Never trust raw output.
- Cache by SHA-256 of file bytes. Same inputs → same result, free on repeat.
- Every paragraph index must be labelled; fill gaps with the fallback rather than failing the job.

---

## Fallback Behaviour

When the LLM call fails (no API key, network error, quota exceeded), the deterministic
fallback classifier ([§6](../specs/05-deterministic-fallback.md)) is used automatically.
The change report's `classifier` field will indicate `"fallback"`.

---

## Implementation Reference

| Artifact            | Path                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Taxonomy enum       | [`backend/app/classify/taxonomy.py`](../backend/app/classify/taxonomy.py)                                                            |
| LLM classifier      | [`backend/app/classify/llm.py`](../backend/app/classify/llm.py)                                                                      |
| Fallback classifier | [`backend/app/classify/fallback.py`](../backend/app/classify/fallback.py)                                                            |
| Tests               | [`backend/tests/test_llm.py`](../backend/tests/test_llm.py), [`backend/tests/test_inventory.py`](../backend/tests/test_inventory.py) |
