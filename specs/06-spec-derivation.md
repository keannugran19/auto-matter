# Stage 4 — Spec Derivation (SPEC.md §7)

> **Canonical source:** [`../SPEC.md § 7. Stage 4 — deriving the spec`](../SPEC.md#7-stage-4--deriving-the-spec)

---

## Responsibility

For each role present in the reference document, aggregate all reference paragraphs carrying
that role into a single `RoleSpec` by taking the **mode** (most common value) of each property.

---

## Mode, Not Mean

> **Do not average formatting values.** Averaging produces values like 22.4 pt that appear nowhere
> in the source document. The mode is robust to one oddly-formatted outlier.

---

## Section-Level Settings

In addition to per-role specs, extract once:

- Page size (`w:pgSz` — `w`, `h`)
- Margins (`w:pgMar` — `top`, `right`, `bottom`, `left`)
- Whether headers/footers exist (`w:headerReference`, `w:footerReference` presence)

---

## Fallback Rules for Absent Roles

When a role appears in the **target** but not in the **reference**, apply these fallbacks
(in order):

| Missing Role  | Fallback                                                     |
| ------------- | ------------------------------------------------------------ |
| `heading_3`   | Copy from `heading_2`, or `heading_1` if that is also absent |
| `heading_2`   | Copy from `heading_1`                                        |
| `quote`       | `body` spec + `italic=True`                                  |
| Anything else | `body` spec; record in change report as **unmatched**        |

All fallbacks are recorded as warnings in the change report with `source: "fallback"`.

---

## Output Types

```python
RoleSpec       # formatting values for one role
SectionSpec    # page size and margins
DerivedSpec    # complete derived spec: dict[Role, RoleSpec] + SectionSpec + warnings
```

---

## Formatting Policy

An additional `FORMATTING_POLICY` layer can be applied on top of derived values to enforce
hard constraints (e.g., minimum font size of 22 pt, Legal page format, minimum heading spacing).

---

## Implementation Reference

| Artifact | Path                                                          |
| -------- | ------------------------------------------------------------- |
| Module   | [`backend/app/ooxml/spec.py`](../backend/app/ooxml/spec.py)   |
| Tests    | [`backend/tests/test_spec.py`](../backend/tests/test_spec.py) |
