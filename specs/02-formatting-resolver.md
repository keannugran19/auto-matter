# Stage 1 — Formatting Resolver (SPEC.md §3)

> **Canonical source:** [`../SPEC.md § 3. Stage 1 — the formatting resolver`](../SPEC.md#3-stage-1--the-formatting-resolver)
>
> **Risk note:** This is the highest-risk component. If the schedule slips, it slips here. Budget accordingly.

---

## Responsibility

Compute the _effective_ formatting of every paragraph in both documents.

Word does not store a paragraph's appearance in one place. The effective value of any property is
the result of layering, in increasing order of precedence:

| Priority    | Layer                                    | Source                                                            |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------- |
| 1 (lowest)  | `docDefaults`                            | `w:rPrDefault` and `w:pPrDefault` in `styles.xml`                 |
| 2           | Paragraph style (full `w:basedOn` chain) | Walk to root, apply back down; guard against cycles               |
| 3           | Numbering level properties               | `w:numPr` → `numbering.xml` → `w:num` → `w:abstractNum` → `w:lvl` |
| 4           | Direct paragraph formatting              | `w:pPr` on the `w:p` itself                                       |
| 5           | Character style on a run                 | `w:rStyle`                                                        |
| 6 (highest) | Direct run formatting                    | `w:rPr` on the `w:r` itself                                       |

> **Caution:** Verify precedence between layers 3 and 4 against ECMA-376 and real Word behaviour
> before relying on it. Numbering interaction is the classic source of subtle bugs.

---

## Output: `ResolvedParagraph`

One `ResolvedParagraph` per paragraph, carrying at minimum:

```python
style_id, outline_level, is_list, list_level, num_id
font_name, font_size_half_points
line_spacing, line_rule, space_before, space_after
indent_left, indent_right, indent_first_line, indent_hanging
alignment
runs: [ {text, bold, italic, underline, strike, vert_align} ]
```

---

## Units

| Property                        | Unit                     | Note                                                        |
| ------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `w:sz`, `w:szCs`                | half-points              | 22 pt → `44`                                                |
| `w:spacing`, `w:ind`            | twips (1/20 pt, aka DXA) | 1 inch → `1440`, 0.5 inch → `720`                           |
| `w:line` with `lineRule="auto"` | 240ths                   | single → `240`, 1.5 lines → `360`, double → `480`           |
| `w:pgSz`                        | twips                    | Letter `12240×15840`, Legal `12240×20160`, A4 `11906×16838` |

---

## Implementation Reference

| Artifact        | Path                                                                  |
| --------------- | --------------------------------------------------------------------- |
| Module          | [`backend/app/ooxml/resolver.py`](../backend/app/ooxml/resolver.py)   |
| Constants       | [`backend/app/ooxml/constants.py`](../backend/app/ooxml/constants.py) |
| Package wrapper | [`backend/app/ooxml/package.py`](../backend/app/ooxml/package.py)     |
| Tests           | [`backend/tests/test_resolver.py`](../backend/tests/test_resolver.py) |
