# ADR-0003: Output Method — Restyle the Original In Place

## Status

Accepted

## Context

The engine needs to produce a reformatted version of the target document. Two output strategies
were considered:

- **Rebuild from scratch:** Extract paragraph text from the target, build a clean new DOCX
  from scratch, and insert the text with new styling applied.
- **In-place patching:** Open the original DOCX package, directly mutate only the presentation
  properties in the XML, and write the modified package out.

The rebuild approach initially seems cleaner — no legacy XML to deal with. However, it
**silently destroys**:

- Embedded images and `word/media/*` files
- Hyperlink relationships (`rId` → external URL mappings)
- Tables and their structure
- Footnotes and endnotes
- Comments and tracked changes
- Bookmarks and cross-references
- Equations (OMML)

This is a product-level failure. Users expect to receive back their document with only its
appearance changed.

## Decision

**Restyle the original in place.** The DOCX zip is opened, only presentation properties are
modified in the XML (`word/document.xml`, `word/styles.xml`, `word/numbering.xml`), and the
modified package is written back. All other parts of the zip are copied verbatim.

## Consequences

- **Zero content or media loss.** Every image, hyperlink, footnote, and table survives.
- **More complex implementation.** The engine must understand OOXML well enough to operate
  on live document XML without corrupting it.
- **Element order is mandatory.** Word silently drops out-of-order properties (see
  [SPEC.md §8b](../../specs/07-in-place-patch.md)).
- The acceptance test explicitly verifies zero media loss and hyperlink preservation (§12).

## Spec Reference

SPEC.md §0 — "Output method | Restyle the original in place | Rebuilding from an extracted
content model silently destroys images, tables, footnotes, and hyperlink relationships.
Unacceptable in a product."

## Implementation

- [`backend/app/ooxml/package.py`](../../backend/app/ooxml/package.py) — byte-identical round-tripper
- [`backend/app/ooxml/restyle.py`](../../backend/app/ooxml/restyle.py) — patch orchestrator
- [`backend/app/ooxml/sanitize.py`](../../backend/app/ooxml/sanitize.py) — safe property removal
