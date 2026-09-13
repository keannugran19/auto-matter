"""
sanitize.py — STAGE 5a: Strip presentation formatting from a target paragraph.

SPEC.md §8a: Remove these from direct formatting (the app takes ownership).

From w:pPr:  w:spacing, w:ind, w:jc, w:contextualSpacing, w:textAlignment
From w:rPr:  w:rFonts, w:sz, w:szCs, w:position, w:spacing (character-level)

Preserve in w:rPr:
  w:b, w:bCs, w:i, w:iCs, w:u, w:strike, w:dstrike, w:vertAlign,
  w:smallCaps, w:highlight

Judgment calls (documented once here):
  w:color   → treat as presentation (strip), per §8a judgment call.
  w:rStyle  → NEVER strip blindly; "Hyperlink", "CommentReference",
              "FootnoteReference" are load-bearing (§8a note).
              We preserve all w:rStyle values.
  w:u       → preserve on runs; the role spec may add underline at the
              paragraph level via the style definition (§8a note).
  w:caps    → treat as presentation (strip); the reference style controls caps.
"""
from __future__ import annotations

from lxml import etree

from .constants import NS_W, PPR_ORDER_INDEX, RPR_ORDER_INDEX


W = NS_W

# ---------------------------------------------------------------------------
# Elements to remove from w:pPr (direct paragraph formatting)
# ---------------------------------------------------------------------------

_PPR_STRIP = frozenset({
    "spacing",
    "ind",
    "jc",
    "contextualSpacing",
    "textAlignment",
})

# ---------------------------------------------------------------------------
# Elements to remove from w:rPr (direct run formatting)
# Excludes anything in _RPR_KEEP (which takes precedence).
# ---------------------------------------------------------------------------

_RPR_STRIP = frozenset({
    "rFonts",
    "sz",
    "szCs",
    "position",
    "spacing",      # character-level letter-spacing (w:rPr/w:spacing)
    "color",        # presentation (§8a judgment call)
    "kern",         # presentation
    "w",            # character width scaling
    "caps",         # presentation (§8a judgment call)
    "lang",         # locale hint; presentation
    "effect",
})

# Elements in w:rPr that we MUST preserve (authorial meaning)
_RPR_KEEP = frozenset({
    "rStyle",       # NEVER strip — may be Hyperlink, FootnoteReference, etc.
    "b",
    "bCs",
    "i",
    "iCs",
    "u",            # preserve underline on runs (§8a note)
    "strike",
    "dstrike",
    "vertAlign",
    "smallCaps",
    "highlight",
    "vanish",       # needed for hidden text
    "webHidden",
})

# ---------------------------------------------------------------------------
# Order-enforcing insert helpers (§8b)
# ---------------------------------------------------------------------------

def _insert_ordered_rpr(rpr: etree._Element, new_child: etree._Element) -> None:
    """
    Insert *new_child* into *rpr* at the correct schema position.
    SPEC.md §8b: "Write an order-enforcing insert helper and route every
    mutation through it."
    """
    local = etree.QName(new_child.tag).localname
    target_idx = RPR_ORDER_INDEX.get(local, len(RPR_ORDER_INDEX))

    for i, existing in enumerate(rpr):
        ex_local = etree.QName(existing.tag).localname
        ex_idx = RPR_ORDER_INDEX.get(ex_local, len(RPR_ORDER_INDEX))
        if ex_idx > target_idx:
            existing.addprevious(new_child)
            return
    rpr.append(new_child)


def _insert_ordered_ppr(ppr: etree._Element, new_child: etree._Element) -> None:
    """Insert *new_child* into *ppr* at the correct schema position."""
    local = etree.QName(new_child.tag).localname
    target_idx = PPR_ORDER_INDEX.get(local, len(PPR_ORDER_INDEX))

    for existing in ppr:
        ex_local = etree.QName(existing.tag).localname
        ex_idx = PPR_ORDER_INDEX.get(ex_local, len(PPR_ORDER_INDEX))
        if ex_idx > target_idx:
            existing.addprevious(new_child)
            return
    ppr.append(new_child)


# ---------------------------------------------------------------------------
# Paragraph-level sanitise
# ---------------------------------------------------------------------------

def sanitise_paragraph(para: etree._Element) -> None:
    """
    Strip presentation formatting from a single w:p element in place.

    - Removes the pPr properties listed in _PPR_STRIP.
    - For each run's rPr, removes the rPr properties in _RPR_STRIP that are
      NOT also in _RPR_KEEP.  Never touches _RPR_KEEP properties.
    - Does not touch w:ins, w:del, w:drawing, or table elements (§8f).
    """
    pPr = para.find(f"{{{W}}}pPr")
    if pPr is not None:
        _sanitise_ppr(pPr)

    for child in para:
        tag = etree.QName(child.tag).localname
        if tag == "r":
            _sanitise_run(child)
        elif tag in ("hyperlink", "ins", "del", "sdt"):
            # Recurse into containers, but skip del (tracked deletions, §8f)
            if tag != "del":
                for r in child.findall(f"{{{W}}}r"):
                    _sanitise_run(r)


def _sanitise_ppr(pPr: etree._Element) -> None:
    """Remove presentation elements from a w:pPr."""
    to_remove = [
        child for child in pPr
        if etree.QName(child.tag).localname in _PPR_STRIP
    ]
    for el in to_remove:
        pPr.remove(el)


def _sanitise_run(run: etree._Element) -> None:
    """Remove presentation elements from a w:r's w:rPr."""
    rPr = run.find(f"{{{W}}}rPr")
    if rPr is None:
        return
    to_remove = []
    for child in rPr:
        local = etree.QName(child.tag).localname
        if local in _RPR_STRIP and local not in _RPR_KEEP:
            to_remove.append(child)
    for el in to_remove:
        rPr.remove(el)

    # If rPr is now empty, remove it (tidier XML)
    if len(rPr) == 0:
        run.remove(rPr)


# ---------------------------------------------------------------------------
# Big line break removal
# ---------------------------------------------------------------------------

def remove_big_line_breaks(doc_root: etree._Element) -> None:
    """
    Remove accidental huge line breaks, empty page breaks, and intermediate
    section breaks that cause unwanted full-page gaps in DOCX documents.

    Removes/cleans:
      - Intermediate w:sectPr elements inside body paragraphs (which force
        accidental section breaks / empty pages before the terminal sectPr).
      - Accidental page breaks (w:br type="page") and w:pageBreakBefore on empty paragraphs.
      - Collapses consecutive duplicate w:br line breaks within paragraphs.
    """
    body = doc_root.find(f"{{{W}}}body")
    if body is None:
        return

    body_paras = [child for child in body if etree.QName(child.tag).localname == "p"]

    for para in body_paras:
        pPr = para.find(f"{{{W}}}pPr")
        if pPr is not None:
            # 1. Remove intermediate section breaks inside paragraphs
            for sect in pPr.findall(f"{{{W}}}sectPr"):
                pPr.remove(sect)

        # Check if paragraph has text
        para_text = "".join(para.itertext()).strip()
        is_empty = (len(para_text) == 0)

        if is_empty:
            # 2. In empty paragraphs, remove page breaks and pageBreakBefore
            if pPr is not None:
                for pb in pPr.findall(f"{{{W}}}pageBreakBefore"):
                    pPr.remove(pb)
            for r in para.findall(f"{{{W}}}r"):
                for br in r.findall(f"{{{W}}}br"):
                    if br.get(f"{{{W}}}type") == "page":
                        r.remove(br)
                # If run is now empty, remove it
                if len(r) == 0 and not (r.text and r.text.strip()):
                    para.remove(r)
        else:
            # 3. For paragraphs with text, collapse excessive consecutive <w:br/> tags
            for r in para.findall(f"{{{W}}}r"):
                brs = r.findall(f"{{{W}}}br")
                if len(brs) > 1 and not (r.text and r.text.strip()):
                    for extra_br in brs[1:]:
                        r.remove(extra_br)


# ---------------------------------------------------------------------------
# Document-level sanitise
# ---------------------------------------------------------------------------

def sanitise_document(doc_root: etree._Element) -> None:
    """
    Sanitise all paragraphs in the document body in place.
    Skips table interior paragraphs (§8f scope restriction for v1).
    Also cleans up buggy intermediate section breaks and huge line breaks.
    """
    body = doc_root.find(f"{{{W}}}body")
    if body is None:
        return

    remove_big_line_breaks(doc_root)

    for child in body:
        tag = etree.QName(child.tag).localname
        if tag == "p":
            sanitise_paragraph(child)
        # Skip w:tbl (table interiors are out of scope for v1, §8f)

