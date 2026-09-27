# Stage 5 — In-Place Patch (SPEC.md §8)

> **Canonical source:** [`../SPEC.md § 8. Stage 5 — the in-place patch`](../SPEC.md#8-stage-5--the-in-place-patch)
>
> **Operate on the unzipped original. Touch only what you must.**

---

## Sub-stages

### §8a — Sanitise Direct Formatting

Remove these from **direct** formatting (the app takes ownership):

**From `w:pPr`:** `w:spacing`, `w:ind`, `w:jc`, `w:contextualSpacing`, `w:textAlignment`

**From `w:rPr`:** `w:rFonts`, `w:sz`, `w:szCs`, `w:position`, character-level `w:spacing`

**Preserve** in `w:rPr` (authorial meaning):
`w:b`, `w:bCs`, `w:i`, `w:iCs`, `w:u`, `w:strike`, `w:dstrike`, `w:vertAlign`, `w:smallCaps`, `w:highlight`

**Judgment calls (decided once, documented here):**

| Element    | Decision                          | Rationale                                                                                |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `w:u`      | **Preserve** on runs              | Both emphasis _and_ a heading device; let the role spec add underline at paragraph level |
| `w:color`  | **Strip** (treat as presentation) | Unless the reference role specifies a colour                                             |
| `w:rStyle` | **Never strip blindly**           | `Hyperlink`, `CommentReference`, `FootnoteReference` are load-bearing                    |

---

### §8b — Element Order Is Mandatory

The schema enforces child order. Word may reject or silently drop a malformed block.

**`w:rPr` order:**

```
rStyle, rFonts, b, bCs, i, iCs, caps, smallCaps, strike, dstrike, outline, shadow,
emboss, imprint, noProof, snapToGrid, vanish, webHidden, color, spacing, w, kern,
position, sz, szCs, highlight, u, effect, bdr, shd, fitText, vertAlign, rtl, cs,
em, lang, eastAsianLayout, specVanish, oMath
```

**`w:pPr` order:**

```
pStyle, keepNext, keepLines, pageBreakBefore, framePr, widowControl, numPr,
suppressLineNumbers, pBdr, shd, tabs, suppressAutoHyphens, kinsoku, wordWrap,
overflowPunct, topLinePunct, autoSpaceDE, autoSpaceDN, bidi, adjustRightInd,
snapToGrid, spacing, ind, contextualSpacing, mirrorIndents, suppressOverlap, jc,
textDirection, textAlignment, textboxTightWrap, outlineLvl, divId, cnfStyle, rPr,
sectPr, pPrChange
```

An order-enforcing insert helper routes every mutation through canonical ordering.

---

### §8c — Apply Styles (FT\_\* Injection)

Inject one named style per role into the target's `styles.xml` and point each paragraph's
`w:pStyle` at it. Direct formatting per-paragraph is avoided.

- Style IDs are namespaced with `FT_` prefix (e.g., `FT_heading_1`) to avoid collisions.
- The document remains editable in Word after export.

---

### §8d — Section Properties

Rewrite `w:sectPr`: `w:pgSz`, `w:pgMar`. If the reference has no header/footer, remove
`w:headerReference` and `w:footerReference` from `sectPr`.

---

### §8e — Lists

The messiest part. Numbering definitions live in `numbering.xml` with document-scoped IDs,
so the reference's `numId` is meaningless in the target. The process:

1. Copy `w:abstractNum` and `w:num` definitions from reference to target.
2. Remap IDs to avoid collisions with existing target definitions.
3. If the target has no `numbering.xml`, create the part **and** add its relationship **and**
   its `[Content_Types].xml` override.

---

### §8f — Do Not Touch

The following are **never** modified by the patch engine:

- Tracked changes: `w:ins`, `w:del`
- Comments
- `w:drawing` / image relationships
- Tables (structure _and_, in v1, interior text)
- Footnotes and endnotes
- Bookmarks

---

## Implementation Reference

| Sub-stage           | Module                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| §8a sanitise        | [`backend/app/ooxml/sanitize.py`](../backend/app/ooxml/sanitize.py)                                                                          |
| §8b element order   | [`backend/app/ooxml/sanitize.py`](../backend/app/ooxml/sanitize.py) — `_insert_ordered_rpr`, `_insert_ordered_ppr`                           |
| §8c style injection | [`backend/app/ooxml/restyle.py`](../backend/app/ooxml/restyle.py) — `inject_styles`, `assign_paragraph_styles`                               |
| §8d section         | [`backend/app/ooxml/restyle.py`](../backend/app/ooxml/restyle.py) — `rewrite_section`                                                        |
| §8e lists           | [`backend/app/ooxml/numbering.py`](../backend/app/ooxml/numbering.py)                                                                        |
| §8f (not touched)   | [`backend/app/ooxml/sanitize.py`](../backend/app/ooxml/sanitize.py)                                                                          |
| Orchestration       | [`backend/app/ooxml/restyle.py`](../backend/app/ooxml/restyle.py) — `restyle()`                                                              |
| Tests               | [`backend/tests/test_restyle.py`](../backend/tests/test_restyle.py), [`backend/tests/test_numbering.py`](../backend/tests/test_numbering.py) |
