# Test Fixtures and Acceptance Test (SPEC.md §12)

> **Canonical source:** [`../SPEC.md § 12. Test fixtures — a self-validating first test`](../SPEC.md#12-test-fixtures--a-self-validating-first-test)

---

## Self-Validating Acceptance Test

**Run the engine with `climate_original.docx` as target and `climate_reference.docx` as reference.
The output should closely reproduce the hand-built file.** That is the acceptance test for the
whole pipeline — it has a known-good answer.

The reference file was built by hand from measured specs, so the engine's output can be compared
against it with known expected values.

---

## Fixture Files

| File                     | Role                                   | Location                  |
| ------------------------ | -------------------------------------- | ------------------------- |
| `climate_original.docx`  | Messy source document (target)         | `backend/tests/fixtures/` |
| `climate_reference.docx` | Hand-formatted target look (reference) | `backend/tests/fixtures/` |

---

## Expected Derived Spec (§12 Table)

| Property          | Expected Value                               |
| ----------------- | -------------------------------------------- |
| Page size         | Legal, `12240 × 20160` twips                 |
| Margins           | `720` twips (0.5 in) all four sides          |
| Font              | Times New Roman throughout                   |
| Body size         | `44` half-points (22 pt)                     |
| Line spacing      | `w:line="360" w:lineRule="auto"` (1.5 lines) |
| Space after       | `160` twips (8 pt)                           |
| Alignment         | Justified (`w:jc val="both"`)                |
| First-line indent | `720` twips (0.5 in)                         |
| Headings          | Bold, flush left, ≥ 400 twips space before   |
| Quote blocks      | Italic, first-line indented, justified       |
| Header/footer     | None                                         |

---

## Acceptance Test Assertions

The acceptance test in `test_acceptance.py` asserts:

1. ✅ Output is a valid DOCX (ZIP) file.
2. ✅ `word/document.xml`, `word/styles.xml`, `word/numbering.xml` all present in output.
3. ✅ Text content is 100% preserved (no runs dropped or modified).
4. ✅ Authorial emphasis (bold/italic) inside paragraphs is preserved.
5. ✅ All 6+ hyperlink relationships still resolve in the output.
6. ✅ No `word/media/*` entries are lost.
7. ✅ Page size matches: `w=12240`, `h=20160`.
8. ✅ Margins match: `720` twips on all four sides.
9. ✅ No `w:headerReference` or `w:footerReference` in `sectPr`.
10. ✅ `FT_body` and `FT_list_item` styles present in `word/styles.xml`.
11. ✅ Change report structure conforms to §10 contract.

---

## Corpus Extension

After the initial fixture pair, extend the test corpus with:

- (a) A document using only direct formatting and no named styles.
- (b) A document containing tables and images.
- (c) A document with footnotes and tracked changes.

---

## Implementation Reference

| Artifact        | Path                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| Fixtures        | [`backend/tests/fixtures/`](../backend/tests/fixtures/)                   |
| Acceptance test | [`backend/tests/test_acceptance.py`](../backend/tests/test_acceptance.py) |
