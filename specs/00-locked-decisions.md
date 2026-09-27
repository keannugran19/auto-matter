# Locked Decisions (SPEC.md §0)

> **Canonical source:** [`../SPEC.md § 0. Scope — locked decisions`](../SPEC.md#0-scope--locked-decisions)
>
> These decisions were made deliberately. Do not silently revisit them. Any proposed change
> must go through a formal ADR (see [`../docs/adr/`](../docs/adr/)).

---

## The Six Locked Decisions

| Decision                | Value                                 | Rationale                                                                                                                                                                         |
| ----------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Input types**         | DOCX target + DOCX reference **only** | A DOCX reference exposes exact formatting values. A PDF reference would require back-calculating font sizes from glyph advance widths — fragile, and dead on scanned files.       |
| **Role detection**      | LLM classifies every paragraph        | Many real documents have no named styles at all — formatted by hand with direct bold/size. There is no structural signal to key off.                                              |
| **Output method**       | **Restyle the original in place**     | Rebuilding from an extracted content model silently destroys images, tables, footnotes, and hyperlink relationships. Unacceptable in a product.                                   |
| **Deviation doctrine**  | **Literal fidelity, with warnings**   | Apply the reference's values exactly. If a value will likely overflow, flag it in the change report rather than quietly adapting.                                                 |
| **Structure changes**   | **Out of scope**                      | The app makes the target's headings _look_ like the reference's headings. It does not invent the reference's outline hierarchy where the target has none. That is a content edit. |
| **v1 auth/persistence** | None                                  | Upload, convert, download, delete.                                                                                                                                                |
| **Table interiors**     | Left alone in v1                      | Restyling text inside table cells risks breaking column layouts. Surface in the change report instead.                                                                            |

---

## ADR Links

Each decision has a corresponding Architecture Decision Record:

- [ADR-0001 — Input types: DOCX only](../docs/adr/0001-input-types-docx-only.md)
- [ADR-0002 — Role detection: LLM classification](../docs/adr/0002-role-detection-llm.md)
- [ADR-0003 — Output method: in-place patch](../docs/adr/0003-output-method-in-place-patch.md)
- [ADR-0004 — Deviation doctrine: literal fidelity with warnings](../docs/adr/0004-deviation-doctrine-literal-fidelity.md)
- [ADR-0005 — Structure changes out of scope](../docs/adr/0005-structure-changes-out-of-scope.md)
- [ADR-0006 — Table interiors out of scope (v1)](../docs/adr/0006-table-interiors-out-of-scope-v1.md)

---

## Implementation Reference

These decisions are enforced throughout the codebase:

| Decision                       | Enforced in                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| DOCX-only input                | [`backend/app/main.py`](../backend/app/main.py) — `_validate_and_save_docx()`               |
| LLM role detection             | [`backend/app/classify/llm.py`](../backend/app/classify/llm.py)                             |
| In-place patching              | [`backend/app/ooxml/restyle.py`](../backend/app/ooxml/restyle.py)                           |
| Literal fidelity + warnings    | [`backend/app/ooxml/spec.py`](../backend/app/ooxml/spec.py) — `DerivedSpec.warnings`        |
| Structure changes out of scope | [`backend/app/ooxml/restyle.py`](../backend/app/ooxml/restyle.py)                           |
| Table interiors untouched      | [`backend/app/ooxml/sanitize.py`](../backend/app/ooxml/sanitize.py) — `sanitise_document()` |
