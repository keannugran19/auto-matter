# Spec Compliance Status

> **Auto-Matter — SPEC.md compliance matrix**
>
> Maps every SPEC.md section to its implementing modules and test files.
> Last reviewed: 2026-09-27 | Spec version: 1.0.0

---

## Legend

| Symbol | Meaning                                   |
| ------ | ----------------------------------------- |
| ✅     | Implemented and tested                    |
| ⚠️     | Partially implemented or partially tested |
| ❌     | Not yet implemented                       |

---

## Compliance Matrix

| Spec Section | Feature                                    | Implementation                                                                                      | Test File(s)                            | Status |
| ------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------- | ------ |
| **§0**       | Input types: DOCX only                     | [`main.py`](../backend/app/main.py) — `_validate_and_save_docx`                                     | `test_api.py`                           | ✅     |
| **§0**       | Output method: in-place patch              | [`restyle.py`](../backend/app/ooxml/restyle.py), [`package.py`](../backend/app/ooxml/package.py)    | `test_acceptance.py`, `test_restyle.py` | ✅     |
| **§0**       | No auth/persistence (v1)                   | [`jobs.py`](../backend/app/jobs.py) — in-memory job store                                           | `test_api.py`                           | ✅     |
| **§0**       | Table interiors untouched                  | [`sanitize.py`](../backend/app/ooxml/sanitize.py) — `sanitise_document()`                           | `test_restyle.py`                       | ✅     |
| **§1**       | Presentation vs. meaning split             | [`sanitize.py`](../backend/app/ooxml/sanitize.py) — `STRIPPED_PPR`, `STRIPPED_RPR`, `PRESERVED_RPR` | `test_restyle.py`                       | ✅     |
| **§2**       | 5-stage pipeline architecture              | [`jobs.py`](../backend/app/jobs.py) — `_run_job_sync()`                                             | `test_acceptance.py`                    | ✅     |
| **§3**       | 6-layer formatting resolver                | [`resolver.py`](../backend/app/ooxml/resolver.py)                                                   | `test_resolver.py`                      | ✅     |
| **§3**       | `ResolvedParagraph` output type            | [`resolver.py`](../backend/app/ooxml/resolver.py) — `ResolvedParagraph`                             | `test_resolver.py`                      | ✅     |
| **§3**       | Cycle guard in style inheritance           | [`resolver.py`](../backend/app/ooxml/resolver.py) — `_StyleCache`                                   | `test_resolver.py`                      | ✅     |
| **§3**       | Numbering level interaction (layer 3)      | [`resolver.py`](../backend/app/ooxml/resolver.py) — `_NumberingCache`                               | `test_resolver.py`                      | ✅     |
| **§4**       | Compact paragraph digest                   | [`inventory.py`](../backend/app/ooxml/inventory.py) — `digest()`                                    | `test_inventory.py`                     | ✅     |
| **§4**       | `role_hint` field in digest                | [`inventory.py`](../backend/app/ooxml/inventory.py)                                                 | `test_inventory.py`                     | ✅     |
| **§5**       | One LLM call, both documents               | [`llm.py`](../backend/app/classify/llm.py) — `classify_both()`                                      | `test_llm.py`                           | ✅     |
| **§5**       | Closed taxonomy (15 roles)                 | [`taxonomy.py`](../backend/app/classify/taxonomy.py) — `Role` enum                                  | `test_inventory.py`                     | ✅     |
| **§5**       | Validate labels, unknown → body            | [`taxonomy.py`](../backend/app/classify/taxonomy.py) — `validate()`                                 | `test_inventory.py`                     | ✅     |
| **§5**       | SHA-256 caching                            | [`llm.py`](../backend/app/classify/llm.py)                                                          | `test_llm.py`                           | ✅     |
| **§5**       | Every paragraph labelled                   | [`llm.py`](../backend/app/classify/llm.py), [`fallback.py`](../backend/app/classify/fallback.py)    | `test_llm.py`, `test_inventory.py`      | ✅     |
| **§6**       | Deterministic fallback classifier          | [`fallback.py`](../backend/app/classify/fallback.py) — `classify()`                                 | `test_inventory.py`                     | ✅     |
| **§6**       | Fallback surfaced in change report         | [`jobs.py`](../backend/app/jobs.py) — `"classifier": "fallback"`                                    | `test_api.py`                           | ✅     |
| **§7**       | Mode aggregation (not mean)                | [`spec.py`](../backend/app/ooxml/spec.py) — `_mode()`                                               | `test_spec.py`                          | ✅     |
| **§7**       | `RoleSpec`, `SectionSpec`, `DerivedSpec`   | [`spec.py`](../backend/app/ooxml/spec.py)                                                           | `test_spec.py`                          | ✅     |
| **§7**       | Fallback: heading_3 from heading_2         | [`spec.py`](../backend/app/ooxml/spec.py) — `_fallback_spec()`                                      | `test_spec.py`                          | ✅     |
| **§7**       | Fallback: quote = body + italic            | [`spec.py`](../backend/app/ooxml/spec.py) — `_fallback_spec()`                                      | `test_spec.py`                          | ✅     |
| **§7**       | Section settings (page size, margins)      | [`spec.py`](../backend/app/ooxml/spec.py) — `_extract_section()`                                    | `test_spec.py`                          | ✅     |
| **§7**       | Warnings for unmatched roles               | [`spec.py`](../backend/app/ooxml/spec.py) — `DerivedSpec.warnings`                                  | `test_spec.py`                          | ✅     |
| **§8a**      | Strip presentation from `w:pPr`            | [`sanitize.py`](../backend/app/ooxml/sanitize.py) — `_sanitise_ppr()`                               | `test_restyle.py`                       | ✅     |
| **§8a**      | Strip presentation from `w:rPr`            | [`sanitize.py`](../backend/app/ooxml/sanitize.py) — `_sanitise_run()`                               | `test_restyle.py`                       | ✅     |
| **§8a**      | Preserve authorial emphasis                | [`sanitize.py`](../backend/app/ooxml/sanitize.py) — `PRESERVED_RPR`                                 | `test_restyle.py`                       | ✅     |
| **§8a**      | Never strip load-bearing `w:rStyle`        | [`sanitize.py`](../backend/app/ooxml/sanitize.py)                                                   | `test_restyle.py`                       | ✅     |
| **§8b**      | `w:rPr` element order enforced             | [`sanitize.py`](../backend/app/ooxml/sanitize.py) — `_insert_ordered_rpr()`                         | `test_restyle.py`                       | ✅     |
| **§8b**      | `w:pPr` element order enforced             | [`sanitize.py`](../backend/app/ooxml/sanitize.py) — `_insert_ordered_ppr()`                         | `test_restyle.py`                       | ✅     |
| **§8c**      | FT\_\* style injection into `styles.xml`   | [`restyle.py`](../backend/app/ooxml/restyle.py) — `inject_styles()`                                 | `test_acceptance.py`, `test_restyle.py` | ✅     |
| **§8c**      | Paragraph `w:pStyle` → FT\_\*              | [`restyle.py`](../backend/app/ooxml/restyle.py) — `assign_paragraph_styles()`                       | `test_restyle.py`                       | ✅     |
| **§8d**      | Rewrite `w:sectPr` (page size, margins)    | [`restyle.py`](../backend/app/ooxml/restyle.py) — `rewrite_section()`                               | `test_acceptance.py`                    | ✅     |
| **§8d**      | Remove orphan header/footer refs           | [`restyle.py`](../backend/app/ooxml/restyle.py) — `rewrite_section()`                               | `test_acceptance.py`                    | ✅     |
| **§8e**      | Copy + remap `abstractNum`/`numId`         | [`numbering.py`](../backend/app/ooxml/numbering.py)                                                 | `test_numbering.py`                     | ✅     |
| **§8e**      | Create `numbering.xml` if absent           | [`numbering.py`](../backend/app/ooxml/numbering.py)                                                 | `test_numbering.py`                     | ✅     |
| **§8f**      | Tracked changes untouched                  | [`sanitize.py`](../backend/app/ooxml/sanitize.py)                                                   | `test_restyle.py`                       | ✅     |
| **§8f**      | Image relationships preserved              | [`package.py`](../backend/app/ooxml/package.py)                                                     | `test_acceptance.py`                    | ✅     |
| **§9**       | LibreOffice DOCX → PDF                     | [`render.py`](../backend/app/render.py)                                                             | `test_render.py`                        | ✅     |
| **§9**       | pdftoppm PDF → JPEG                        | [`render.py`](../backend/app/render.py)                                                             | `test_render.py`                        | ✅     |
| **§9**       | `is_available()` guard                     | [`render.py`](../backend/app/render.py)                                                             | `test_render.py`                        | ✅     |
| **§10**      | `POST /api/convert` → 202                  | [`main.py`](../backend/app/main.py)                                                                 | `test_api.py`                           | ✅     |
| **§10**      | `GET /api/jobs/{id}` → status + report     | [`main.py`](../backend/app/main.py)                                                                 | `test_api.py`                           | ✅     |
| **§10**      | `GET /api/jobs/{id}/download`              | [`main.py`](../backend/app/main.py)                                                                 | `test_api.py`                           | ✅     |
| **§10**      | `GET /api/jobs/{id}/preview/{side}/{file}` | [`main.py`](../backend/app/main.py)                                                                 | `test_api.py`                           | ✅     |
| **§10**      | `DELETE /api/jobs/{id}`                    | [`main.py`](../backend/app/main.py)                                                                 | `test_api.py`                           | ✅     |
| **§10**      | Change report schema                       | [`jobs.py`](../backend/app/jobs.py) — `_build_report()`                                             | `test_acceptance.py`, `test_api.py`     | ✅     |
| **§11**      | Repo layout matches spec                   | (directory structure)                                                                               | —                                       | ✅     |
| **§12**      | Acceptance test on fixtures                | [`test_acceptance.py`](../backend/tests/test_acceptance.py)                                         | `test_acceptance.py`                    | ✅     |
| **§12**      | §12 table values verified                  | [`test_spec.py`](../backend/tests/test_spec.py)                                                     | `test_spec.py`                          | ✅     |
| **§12**      | Hyperlinks preserved                       | [`test_acceptance.py`](../backend/tests/test_acceptance.py)                                         | `test_acceptance.py`                    | ✅     |
| **§12**      | Zero media loss                            | [`test_acceptance.py`](../backend/tests/test_acceptance.py)                                         | `test_acceptance.py`                    | ✅     |
| **§13**      | Build order followed                       | (commit history)                                                                                    | —                                       | ✅     |
| **§14**      | Pitfalls documented                        | [`specs/13-known-pitfalls.md`](../specs/13-known-pitfalls.md)                                       | —                                       | ✅     |

---

## How to Update This Matrix

When adding a new feature:

1. Update `SPEC.md` with the new requirement.
2. Add a row to this matrix when the implementation starts.
3. Set status to ✅ when the implementation is complete **and** tested.
4. If a spec section has no test coverage, add it to `backend/tests/SPEC_COVERAGE.md` as a gap.
