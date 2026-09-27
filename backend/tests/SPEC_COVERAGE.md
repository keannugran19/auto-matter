# Test Suite ��� Spec Coverage Map

> Maps every test file in `backend/tests/` to the SPEC.md section(s) it validates.
> See also: [`../../docs/SPEC_COMPLIANCE.md`](../../docs/SPEC_COMPLIANCE.md) for the full compliance matrix.

---

## Coverage by Test File

| Test File                                  | Spec Section(s)        | Build Step (§13) | What It Tests                                                                                                             |
| ------------------------------------------ | ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`test_package.py`](test_package.py)       | §2, §11              | Step 2            | `DocxPackage` ��� zip read/write, byte-identical round-trip, part listing                                                 |
| [`test_resolver.py`](test_resolver.py)     | §3                    | Step 3            | 6-layer formatting cascade, `ResolvedParagraph`, cycle guard, numbering interaction, units                                |
| [`test_inventory.py`](test_inventory.py)   | §4, §5, §6          | Steps 4, 5        | Digest fields, emphasis ratios, closed taxonomy validation, fallback classifier heuristics                                |
| [`test_llm.py`](test_llm.py)               | §5                    | Step 10           | LLM structured call, SHA-256 caching, API key handling, fallback on failure                                               |
| [`test_spec.py`](test_spec.py)             | §7                    | Step 6            | `derive_spec()` mode aggregation, §12 table value assertions, fallback derivation rules, `FORMATTING_POLICY` enforcement |
| [`test_restyle.py`](test_restyle.py)       | §8a, §8b, §8c, §8d | Step 7            | Sanitise presentation stripping, emphasis preservation, element order, FT\_\* injection, sectPr rewrite                   |
| [`test_numbering.py`](test_numbering.py)   | §8e                   | Step 8            | `abstractNum`/`numId` copy + remap, create `numbering.xml` if absent, ID collision avoidance                              |
| [`test_render.py`](test_render.py)         | §9                    | Step 9            | LibreOffice availability check, DOCX ��� PDF ��� JPEG pipeline, output filename patterns                                  |
| [`test_api.py`](test_api.py)               | §10                   | Step 11           | All 5 REST endpoints, status codes, change report schema, preview security (path traversal), job lifecycle                |
| [`test_acceptance.py`](test_acceptance.py) | §12 (full pipeline)   | Step 13           | End-to-end ground truth: §12 table values, text preservation, hyperlinks, media, FT\_\* styles, section properties       |

---

## Coverage by Spec Section

| Spec Section | Feature                                           | Covered By                                             |
| ------------ | ------------------------------------------------- | ------------------------------------------------------ |
| §0          | Locked decisions (DOCX-only, in-place)            | `test_api.py`, `test_restyle.py`, `test_acceptance.py` |
| §1          | Presentation vs. meaning split                    | `test_restyle.py`                                      |
| §2          | 5-stage pipeline                                  | `test_acceptance.py`                                   |
| §3          | Formatting resolver                               | `test_resolver.py`                                     |
| §4          | Digest                                            | `test_inventory.py`                                    |
| §5          | Classification taxonomy                           | `test_inventory.py`, `test_llm.py`                     |
| §5          | LLM call + caching                                | `test_llm.py`                                          |
| §6          | Deterministic fallback                            | `test_inventory.py`                                    |
| §7          | Spec derivation (mode)                            | `test_spec.py`                                         |
| §7          | Fallback rules (heading_3, quote)                 | `test_spec.py`                                         |
| §7          | Section extraction                                | `test_spec.py`                                         |
| §8a         | Sanitise direct formatting                        | `test_restyle.py`                                      |
| §8b         | Element order                                     | `test_restyle.py`                                      |
| §8c         | FT\_\* style injection                            | `test_restyle.py`, `test_acceptance.py`                |
| §8d         | Section rewrite                                   | `test_acceptance.py`                                   |
| §8e         | Numbering transfer                                | `test_numbering.py`                                    |
| §8f         | Do-not-touch (media, hyperlinks, tracked changes) | `test_acceptance.py`, `test_restyle.py`                |
| §9          | Preview rendering                                 | `test_render.py`                                       |
| §10         | API contract                                      | `test_api.py`                                          |
| §11         | Repo layout                                       | (structural)                                           |
| §12         | Acceptance test + §12 table values               | `test_acceptance.py`, `test_spec.py`                   |
| §13         | Build order                                       | (process)                                              |
| §14         | Pitfalls                                          | `test_restyle.py`, `test_resolver.py`                  |

---

## Known Gaps

None identified at the time of the last review (2026-09-27). The corpus should be extended
per §12 guidance (direct-formatted docs, docs with tables/images, docs with footnotes/tracked changes).
