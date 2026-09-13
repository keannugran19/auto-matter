# DOCX Format Transfer — Build Spec

A two-pane web app. The user uploads a Word document on the left (the **target** — the one to be
reformatted) and a Word document on the right (the **reference** — the one whose look is to be
copied). The app returns a restyled copy of the target that looks like the reference, plus
before/after previews and a change report.

This spec is authoritative. Read it before writing code, and re-read the relevant section before
starting each phase.

---

## 0. Scope — locked decisions

These were decided deliberately. Do not silently revisit them.

| Decision | Value | Why |
|---|---|---|
| Input types | DOCX target + DOCX reference **only** | A DOCX reference exposes exact formatting values. A PDF reference would require back-calculating font sizes from glyph advance widths — fragile, and dead on scanned files. |
| Role detection | LLM classifies every paragraph | Many real documents have no named styles at all — formatted by hand with direct bold/size. There is no structural signal to key off. |
| Output method | **Restyle the original in place** | Rebuilding from an extracted content model silently destroys images, tables, footnotes, and hyperlink relationships. Unacceptable in a product. |
| Deviation doctrine | **Literal fidelity, with warnings** | Apply the reference's values exactly. If a value will likely overflow (e.g. a 42 pt title on a long heading), flag it in the change report rather than quietly adapting. A fit-aware mode may be added later as an explicit toggle. |
| Structure changes | **Out of scope** | The app makes the target's headings *look* like the reference's headings. It does not invent the reference's outline hierarchy (A / 1 / a) where the target has none. That is a content edit, not a formatting copy. |
| v1 auth/persistence | None | Upload, convert, download, delete. |
| Table interiors | Left alone in v1 | Restyling text inside table cells risks breaking column layouts. Surface it in the change report instead. |

---

## 1. The core principle

**Split every formatting property into presentation or meaning.**

- **Presentation** — font, size, line spacing, indentation, alignment. Owned by the app. Stripped
  from the target's direct formatting and replaced wholesale from the reference spec.
- **Meaning** — bold, italic, underline, strikethrough, superscript on individual runs. Authorial
  intent. Preserved untouched.

Get this wrong in either direction and the app fails visibly:
- Fail to strip direct presentation formatting → the new styles don't apply, because direct
  formatting wins over styles in Word's resolution order. The document looks unchanged.
- Strip run-level emphasis → the document loses its bold and italics. Content damage.

Everything in the engine follows from this split.

---

## 2. Architecture

Five stages, each independently testable.

```
reference.docx ─┐
                ├─▶ [1] resolve ─▶ [2] digest ─▶ [3] classify ─▶ [4] derive spec ─┐
target.docx ────┘                                                                 │
                                                                                  ▼
target.docx ─────────────────────────────────────────────────────▶ [5] patch in place ─▶ output.docx
```

**[1] Resolve** — compute the *effective* formatting of every paragraph in both documents.
**[2] Digest** — reduce each document to one compact line per paragraph.
**[3] Classify** — one LLM call labels paragraphs in *both* documents against one shared taxonomy.
**[4] Derive spec** — for each role, aggregate the reference paragraphs carrying that role into a
single formatting specification.
**[5] Patch** — modify the target's XML in place: sanitise, apply styles, rewrite section properties.

---

## 3. Stage 1 — the formatting resolver

**This is the highest-risk component. If the schedule slips, it slips here.** Budget accordingly.

Word does not store a paragraph's appearance in one place. The effective value of any property is
the result of layering, in increasing order of precedence:

1. `docDefaults` — `w:rPrDefault` and `w:pPrDefault` in `styles.xml`
2. The paragraph style, resolved through its full `w:basedOn` inheritance chain (walk to the root,
   then apply back down; guard against cycles)
3. Numbering level properties — `w:numPr` → `numbering.xml` → `w:num` → `w:abstractNum` → `w:lvl`,
   which carries its own `w:pPr` and `w:rPr`
4. Direct paragraph formatting — `w:pPr` on the `w:p` itself
5. Character style on a run — `w:rStyle`
6. Direct run formatting — `w:rPr` on the `w:r` itself

Verify precedence between layers 3 and 4 against ECMA-376 and real Word behaviour before relying on
it; numbering interaction is the classic source of subtle bugs. Table styles add another layer, but
table interiors are out of scope for v1.

Output a `ResolvedParagraph` per paragraph carrying at minimum:

```python
style_id, outline_level, is_list, list_level, num_id
font_name, font_size_half_points
line_spacing, line_rule, space_before, space_after
indent_left, indent_right, indent_first_line, indent_hanging
alignment
runs: [ {text, bold, italic, underline, strike, vert_align} ]
```

### Units — get these right

| Property | Unit | Note |
|---|---|---|
| `w:sz`, `w:szCs` | half-points | 22 pt → `44` |
| `w:spacing`, `w:ind` | twips (1/20 pt, aka DXA) | 1 inch → `1440`, 0.5 inch → `720` |
| `w:line` with `lineRule="auto"` | 240ths | single → `240`, 1.5 lines → `360`, double → `480` |
| `w:pgSz` | twips | Letter `12240×15840`, Legal `12240×20160`, A4 `11906×16838` |

---

## 4. Stage 2 — the digest

Do **not** send whole documents to the model. Send one line per paragraph:

```
{index, role_hint, text_excerpt, font, size_pt, bold_ratio, italic_ratio,
 underline_ratio, alignment, indent_first, space_before, is_list, outline_level,
 style_id, char_count}
```

- `text_excerpt` — first ~150 characters, ellipsised.
- `*_ratio` — fraction of characters in the paragraph carrying that emphasis. These are strong
  signals: a paragraph over ~60% italic is almost always a quotation block.
- `role_hint` — the deterministic fallback's guess (§6), so the model has a prior.

This cuts token usage by roughly an order of magnitude versus full text, limits how much of a
user's document leaves the server, and loses almost nothing for classification purposes.

---

## 5. Stage 3 — classification

**One call, both documents, one shared taxonomy.** Classifying them separately invites the model to
invent divergent label sets that can't be joined.

Closed taxonomy — the model may return nothing else:

```
title            document title
subtitle         line under the title, e.g. a source or adaptation credit
series_label     short label above the title, e.g. "Lesson 42"
aim              purpose/objective statement, often with a bold lead-in
heading_1        top-level section heading
heading_2        sub-heading
heading_3        sub-sub-heading
body             normal prose
quote            quoted or scripture block, typically italic and indented
reference_line   a citation label on its own line, e.g. "Psalm 46:2-3,"
definition_term  a term being defined
definition_meta  part-of-speech or similar annotation under a term
list_item        numbered or bulleted item
caption          figure or table caption
footer_note      source/attribution line at the end
```

Requirements:
- Structured output, schema-constrained, temperature 0.
- Validate every returned label against the enum. Unrecognised → `body`. Never trust raw output.
- Cache by SHA-256 of file bytes. Same inputs → same result, free on repeat.
- Every paragraph index must be labelled; fill gaps with the fallback rather than failing the job.

---

## 6. Deterministic fallback

Required, but as a degraded safety net when the model call fails — not a co-equal path.

Infer from: `w:pStyle` names (`Heading1`→`heading_1`, `Title`→`title`, `ListParagraph`→`list_item`),
`w:outlineLvl`, presence of `w:numPr`, font size relative to the document's modal size, and the
emphasis ratios. Document clearly that quality is materially worse on hand-formatted files, and
surface in the UI when the fallback was used.

---

## 7. Stage 4 — deriving the spec

For each role present in the reference, collect all reference paragraphs with that role and reduce
to one spec by taking, per property, the **most common value** (mode), not the mean. Averaging
produces values that appear nowhere in the source document — a 22.4 pt font. The mode is robust to
one oddly-formatted outlier.

Also extract section-level settings once: page size, margins, and whether headers/footers exist.

**Roles in the target with no reference example** need explicit fallbacks:
- `heading_3` missing → derive from `heading_2`, or from `heading_1` if that's absent
- `quote` missing → `body` plus italic
- Anything else unresolvable → `body`, and record it in the change report as unmatched

---

## 8. Stage 5 — the in-place patch

Operate on the unzipped original. Touch only what you must.

### 8a. Sanitise

Remove these from **direct** formatting (the app takes ownership):

- From `w:pPr`: `w:spacing`, `w:ind`, `w:jc`, `w:contextualSpacing`, `w:textAlignment`
- From `w:rPr`: `w:rFonts`, `w:sz`, `w:szCs`, `w:position`, character-level `w:spacing`

**Preserve** in `w:rPr`: `w:b`, `w:bCs`, `w:i`, `w:iCs`, `w:u`, `w:strike`, `w:dstrike`,
`w:vertAlign`, `w:smallCaps`, `w:highlight`.

Judgment calls, decide once and document:
- `w:u` — both emphasis *and* a heading device. Preserve it on runs; let the role spec add underline
  at paragraph level where the reference's role has it.
- `w:color` — treat as presentation (strip) unless the reference role specifies a colour.
- `w:rStyle` — **never strip blindly.** `Hyperlink`, `CommentReference`, and `FootnoteReference`
  are load-bearing.

### 8b. Element order is mandatory

The schema enforces child order. Word may reject or silently drop a malformed block. *(I hit exactly
this: I emitted `w:u` before `w:sz` and had to reorder.)*

`w:rPr` order:
```
rStyle, rFonts, b, bCs, i, iCs, caps, smallCaps, strike, dstrike, outline, shadow,
emboss, imprint, noProof, snapToGrid, vanish, webHidden, color, spacing, w, kern,
position, sz, szCs, highlight, u, effect, bdr, shd, fitText, vertAlign, rtl, cs,
em, lang, eastAsianLayout, specVanish, oMath
```

`w:pPr` order:
```
pStyle, keepNext, keepLines, pageBreakBefore, framePr, widowControl, numPr,
suppressLineNumbers, pBdr, shd, tabs, suppressAutoHyphens, kinsoku, wordWrap,
overflowPunct, topLinePunct, autoSpaceDE, autoSpaceDN, bidi, adjustRightInd,
snapToGrid, spacing, ind, contextualSpacing, mirrorIndents, suppressOverlap, jc,
textDirection, textAlignment, textboxTightWrap, outlineLvl, divId, cnfStyle, rPr,
sectPr, pPrChange
```

Write an order-enforcing insert helper and route every mutation through it.

### 8c. Apply styles

Prefer injecting one named style per role into the target's `styles.xml` and pointing each
paragraph's `w:pStyle` at it, over stamping direct formatting on every paragraph. The document stays
editable afterwards — the user can tweak "Heading 2" in Word and have it work. Namespace injected
style IDs (e.g. `FT_heading_1`) to avoid collisions with existing styles.

### 8d. Section properties

Rewrite `w:sectPr`: `w:pgSz`, `w:pgMar`. If the reference has no header/footer, remove
`w:headerReference` and `w:footerReference` from `sectPr`. Leaving the orphaned parts in the package
is harmless; deleting them means also cleaning `document.xml.rels` and `[Content_Types].xml`.

### 8e. Lists

The messiest part. Numbering definitions live in `numbering.xml` with document-scoped IDs, so the
reference's `numId` is meaningless in the target. You must copy the `w:abstractNum` and `w:num`
definitions across and remap IDs to avoid collisions. If the target has no `numbering.xml` at all,
create the part *and* add its relationship *and* its `[Content_Types].xml` override. Budget real
time here.

### 8f. Do not touch

Tracked changes (`w:ins`, `w:del`), comments, `w:drawing` / image relationships, tables (structure
*and*, in v1, interior text), footnotes, endnotes, bookmarks.

---

## 9. Preview rendering

Convert both original and output to PDF via headless LibreOffice, rasterise with `pdftoppm`, serve
as PNGs for the before/after panes.

```bash
soffice --headless --convert-to pdf --outdir /tmp/out input.docx
pdftoppm -jpeg -r 100 /tmp/out/input.pdf /tmp/out/page
```

This is not a nicety — it is what makes the output trustworthy, and it doubles as the dev test
harness. **The LibreOffice dependency rules out serverless/edge hosting.** The backend needs a
container host: Fly, Render, Railway, or ECS.

---

## 10. API contract

```
POST /api/convert
  multipart/form-data: target=<file.docx>, reference=<file.docx>
  → 202 { jobId: string }
  → 400 { error } on non-DOCX, oversized, or corrupt input

GET /api/jobs/{jobId}
  → { status: "queued"|"running"|"done"|"error",
      error?: string,
      report?: {
        sectionChanges: { pageSize, margins, headerFooterRemoved },
        roles: [ { role, paragraphCount, specApplied: {...}, source: "reference"|"fallback" } ],
        warnings: [ { severity: "info"|"warn", message, paragraphIndex? } ],
        classifier: "llm" | "fallback"
      },
      previews?: { before: string[], after: string[] },
      downloadUrl?: string }

GET /api/jobs/{jobId}/download → the restyled .docx

DELETE /api/jobs/{jobId} → purge inputs, outputs, previews
```

Async because LibreOffice rendering takes seconds. Frontend polls `GET /api/jobs/{jobId}`.

---

## 11. Repo layout

```
docx-format-transfer/
├── backend/
│   ├── app/
│   │   ├── main.py                 FastAPI app, routes
│   │   ├── jobs.py                 in-memory job store + background runner
│   │   ├── ooxml/
│   │   │   ├── constants.py        namespaces, element order tables
│   │   │   ├── package.py          read/write the docx zip, part access
│   │   │   ├── resolver.py         STAGE 1 — effective formatting
│   │   │   ├── inventory.py        STAGE 2 — digest
│   │   │   ├── spec.py             STAGE 4 — role spec derivation
│   │   │   ├── sanitize.py         STAGE 5a
│   │   │   ├── restyle.py          STAGE 5 — orchestrates the patch
│   │   │   └── numbering.py        STAGE 5e — list remapping
│   │   ├── classify/
│   │   │   ├── taxonomy.py         closed role enum + JSON schema
│   │   │   ├── llm.py              STAGE 3 — structured call, caching
│   │   │   └── fallback.py         deterministic heuristics
│   │   └── render.py               LibreOffice + pdftoppm previews
│   ├── tests/
│   │   └── fixtures/               see §12
│   ├── requirements.txt
│   └── Dockerfile                  must install libreoffice + poppler-utils
├── frontend/                       Next.js + TypeScript
│   └── app/
│       ├── page.tsx                two-pane upload, polling, previews
│       └── components/             DropZone, PreviewPane, ChangeReport
├── docker-compose.yml
└── SPEC.md                         this file
```

Suggested deps: `fastapi`, `uvicorn`, `lxml` (do the XML work with lxml, not `python-docx` —
python-docx abstracts away exactly the layers you need control over), `pydantic`, `python-multipart`.

---

## 12. Test fixtures — a self-validating first test

Put these in `backend/tests/fixtures/`:

- `climate_original.docx` — the messy source document
- `climate_reference.docx` — that same content, hand-formatted in the target look

The second file was built by hand from measured specs. So:

**Run the engine with `climate_original.docx` as target and `climate_reference.docx` as reference.
The output should closely reproduce the hand-built file.** That is the acceptance test for the whole
pipeline — it has a known-good answer.

Expected derived spec:

| Property | Value |
|---|---|
| Page size | Legal, 12240 × 20160 twips |
| Margins | 720 twips (0.5 in) all four sides |
| Font | Times New Roman throughout |
| Body size | 44 half-points (22 pt) |
| Line spacing | `w:line="360" w:lineRule="auto"` (1.5 lines) |
| Space after | 160 twips (8 pt) |
| Alignment | justified (`w:jc val="both"`) |
| First-line indent | 720 twips (0.5 in) |
| Headings | bold, flush left, ~400 twips space before |
| Quote blocks | italic, first-line indented, justified |
| Header/footer | none |

Also assert: the original's hyperlink relationships still resolve in the output, and no
`word/media/*` entry is lost.

Then extend the corpus with (a) a document using only direct formatting and no named styles,
(b) one containing tables and images, (c) one with footnotes and tracked changes.

---

## 13. Build order

Ship stages 1–2 with tests before touching the LLM, and get the patch engine round-tripping a file
unchanged before it changes anything.

1. Docker image with LibreOffice + Poppler; confirm headless conversion works
2. `constants.py`, `package.py` — read a docx, list parts, write it back **byte-identical**
3. `resolver.py` + unit tests against both fixtures ← *the hard part, do it properly*
4. `inventory.py` + digest snapshot tests
5. `fallback.py` (so there's a working classifier before any API dependency)
6. `spec.py` — derive the spec from the reference; assert it matches the §12 table
7. `sanitize.py` + `restyle.py` — first make a no-op patch round-trip cleanly, then apply specs
8. `numbering.py` — lists
9. `render.py` — previews
10. `llm.py` — swap in real classification; compare against fallback on the fixtures
11. FastAPI routes + job runner
12. Frontend two-pane UI
13. Change report, validation, cleanup, wider corpus

---

## 14. Pitfalls, learned the hard way

- **Direct formatting beats styles.** If output looks unchanged, you didn't sanitise. Check first.
- **Element order violations** are silent. Word drops the properties without complaint.
- **`xml:space="preserve"`** is required on any `w:t` with leading/trailing whitespace, or the space
  vanishes.
- **Never strip `w:rStyle` blindly** — it carries hyperlinks and footnote references.
- **Documents with no named styles are the real test case**, not the tidy ones. Test them early.
- **Don't average formatting values.** Use the mode. Averaging invents values like 22.4 pt.
- **Rebuild-from-scratch is a trap.** It looks cleaner and it silently eats images, links, and
  footers. In-place patching is uglier code and the correct choice.
- **Verify with a real renderer.** XML that validates can still look wrong. Until LibreOffice has
  rendered it, you have not seen the output.
