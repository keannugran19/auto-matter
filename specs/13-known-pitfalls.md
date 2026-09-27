# Known Pitfalls (SPEC.md §14)

> **Canonical source:** [`../SPEC.md § 14. Pitfalls, learned the hard way`](../SPEC.md#14-pitfalls-learned-the-hard-way)

---

## Critical Pitfalls

These are non-obvious failure modes discovered during development. Read before contributing.

---

### 1. Direct formatting beats styles

> **If output looks unchanged, you didn't sanitise. Check first.**

Word applies direct formatting on a paragraph with higher precedence than styles. If the
engine injects a named style but leaves the original direct formatting intact, the style
has no visible effect. Always sanitise before applying styles.

**Relevant module:** [`backend/app/ooxml/sanitize.py`](../backend/app/ooxml/sanitize.py)

---

### 2. Element order violations are silent

> **Element order violations are silent. Word drops the properties without complaint.**

The OOXML schema enforces a strict child element order in `w:rPr` and `w:pPr`. Word does
not raise an error when the order is wrong — it silently ignores the out-of-order property.
This is extremely hard to debug visually.

Always route every mutation through the order-enforcing helper (`_insert_ordered_rpr`,
`_insert_ordered_ppr`).

**Relevant module:** [`backend/app/ooxml/sanitize.py`](../backend/app/ooxml/sanitize.py)

---

### 3. `xml:space="preserve"` on `w:t` with whitespace

> **`xml:space="preserve"` is required on any `w:t` with leading/trailing whitespace, or the space vanishes.**

Any `<w:t>` element containing text that starts or ends with a space must have the attribute
`xml:space="preserve"`, otherwise the XML parser normalises the whitespace away.

---

### 4. Never strip `w:rStyle` blindly

> **Never strip `w:rStyle` blindly — it carries hyperlinks and footnote references.**

Character styles like `Hyperlink`, `CommentReference`, and `FootnoteReference` are stored as
`w:rStyle` on runs. Stripping them breaks hyperlinks and cross-references.

**Relevant module:** [`backend/app/ooxml/sanitize.py`](../backend/app/ooxml/sanitize.py) — `PRESERVED_RSTYLE_PREFIXES`

---

### 5. Documents with no named styles are the real test case

> **Documents with no named styles are the real test case, not the tidy ones. Test them early.**

Many real-world documents are formatted entirely with direct formatting — no `w:pStyle` at all.
The resolver and fallback classifier must handle these gracefully. They are the hardest case,
not a corner case.

---

### 6. Don't average formatting values

> **Don't average formatting values. Use the mode. Averaging invents values like 22.4 pt.**

When aggregating formatting across multiple paragraphs with the same role, always take the
statistical **mode** (most common value), never the mean. The mean produces values like 22.4 pt
that exist nowhere in the source document.

**Relevant module:** [`backend/app/ooxml/spec.py`](../backend/app/ooxml/spec.py) — `_mode()`

---

### 7. Rebuild-from-scratch is a trap

> **Rebuild-from-scratch is a trap. It looks cleaner and it silently eats images, links, and footers. In-place patching is uglier code and the correct choice.**

It is tempting to extract paragraph text, build a clean new document, and re-insert the content.
This approach silently destroys images, hyperlinks, footnotes, comments, tables, and tracked
changes. The in-place patch approach is more complex but the only correct one for a product.

See [ADR-0003](../docs/adr/0003-output-method-in-place-patch.md).

---

### 8. Verify with a real renderer

> **Verify with a real renderer. XML that validates can still look wrong. Until LibreOffice has rendered it, you have not seen the output.**

Schema-valid XML can still produce a visually incorrect document. The only way to know if the
output looks right is to render it with LibreOffice (or Word) and inspect it. This is why the
preview rendering step is mandatory, not optional.

**Relevant module:** [`backend/app/render.py`](../backend/app/render.py)
