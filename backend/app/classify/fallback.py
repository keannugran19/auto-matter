"""
fallback.py — Deterministic paragraph role classifier.

SPEC.md §6: "Required, but as a degraded safety net when the model call fails
— not a co-equal path."

Quality is materially worse on hand-formatted documents that carry no named
styles.  The UI should surface when this path was used.

Algorithm
---------
For each paragraph, rules are applied in priority order (first match wins):

  1. Style ID exact match  → direct role
  2. Style ID substring / prefix match
  3. is_list flag          → list_item
  4. outline_level         → heading_n
  5. Font size vs modal    → title / series_label if significantly larger
  6. Italic ratio > 0.6    → quote
  7. Bold-only, very short (≤ 6 words), ≤ 3rd position → series_label
  8. Bold-only short line near top → heading_1
  9. Default              → body

The rules are conservative.  When in doubt, return body; the LLM will refine.
"""
from __future__ import annotations

from collections import Counter
from typing import Optional

from ..ooxml.resolver import ResolvedParagraph
from .taxonomy import Role


# ---------------------------------------------------------------------------
# Style-ID → Role lookup table
# Keys are normalised to lower-case, with spaces and underscores stripped.
# ---------------------------------------------------------------------------

_STYLE_MAP: dict[str, Role] = {
    "title":            Role.TITLE,
    "documenttitle":    Role.TITLE,
    "subtitle":         Role.SUBTITLE,
    "heading1":         Role.HEADING_1,
    "heading2":         Role.HEADING_2,
    "heading3":         Role.HEADING_3,
    "heading4":         Role.HEADING_1,   # treat Heading4+ as heading_1 (best guess)
    "heading5":         Role.HEADING_1,
    "heading6":         Role.HEADING_1,
    "listparagraph":    Role.LIST_ITEM,
    "listbullet":       Role.LIST_ITEM,
    "listnumber":       Role.LIST_ITEM,
    "list":             Role.LIST_ITEM,
    "caption":          Role.CAPTION,
    "quote":            Role.QUOTE,
    "quotation":        Role.QUOTE,
    "blockquote":       Role.QUOTE,
    "bodytext":         Role.BODY,
    "bodytext2":        Role.BODY,
    "bodytext3":        Role.BODY,
    "normal":           Role.BODY,
    "default":          Role.BODY,
    "footer":           Role.FOOTER_NOTE,
    "footnotetext":     Role.FOOTER_NOTE,
}

def _normalise_style(style_id: str) -> str:
    """Lowercase, remove spaces, hyphens, underscores."""
    return style_id.lower().replace(" ", "").replace("-", "").replace("_", "")


# ---------------------------------------------------------------------------
# Modal font size helper
# ---------------------------------------------------------------------------

def _modal_size(paras: list[ResolvedParagraph]) -> Optional[float]:
    """Return the most common font_size_half_points / 2 (in points), or None."""
    sizes = [p.font_size_half_points for p in paras if p.font_size_half_points]
    if not sizes:
        return None
    return Counter(sizes).most_common(1)[0][0] / 2


# ---------------------------------------------------------------------------
# Emphasis ratio helpers
# ---------------------------------------------------------------------------

def _ratios(para: ResolvedParagraph) -> tuple[float, float, float]:
    """Return (bold_ratio, italic_ratio, underline_ratio)."""
    total = sum(len(r.text) for r in para.runs)
    if total == 0:
        return 0.0, 0.0, 0.0
    bold = sum(len(r.text) for r in para.runs if r.bold)
    italic = sum(len(r.text) for r in para.runs if r.italic)
    under = sum(len(r.text) for r in para.runs if r.underline)
    return bold / total, italic / total, under / total


def _word_count(para: ResolvedParagraph) -> int:
    text = "".join(r.text for r in para.runs).strip()
    return len(text.split()) if text else 0


def _text(para: ResolvedParagraph) -> str:
    return "".join(r.text for r in para.runs).strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify(paras: list[ResolvedParagraph]) -> list[Role]:
    """
    Return one Role per paragraph, in order.

    This is the deterministic fallback.  It should not be used as the primary
    classifier; quality on hand-formatted documents is materially worse than
    the LLM path.

    SPEC.md §6: "Document clearly that quality is materially worse on
    hand-formatted files, and surface in the UI when the fallback was used."
    """
    modal_size_pt = _modal_size(paras)
    return [_classify_one(p, i, paras, modal_size_pt) for i, p in enumerate(paras)]


def _classify_one(
    para: ResolvedParagraph,
    position: int,
    all_paras: list[ResolvedParagraph],
    modal_size_pt: Optional[float],
) -> Role:
    # 1. Style-ID direct / fuzzy match
    if para.style_id:
        key = _normalise_style(para.style_id)
        if key in _STYLE_MAP:
            return _STYLE_MAP[key]

        # Prefix / substring matches for style IDs like "Heading 1 Char"
        for prefix, role in [
            ("heading1", Role.HEADING_1),
            ("heading2", Role.HEADING_2),
            ("heading3", Role.HEADING_3),
            ("heading4", Role.HEADING_1),
            ("heading5", Role.HEADING_1),
            ("heading6", Role.HEADING_1),
            ("listparagraph", Role.LIST_ITEM),
            ("listbullet", Role.LIST_ITEM),
            ("listnumber", Role.LIST_ITEM),
            ("caption", Role.CAPTION),
            ("title", Role.TITLE),
            ("subtitle", Role.SUBTITLE),
            ("quote", Role.QUOTE),
            ("blockquote", Role.QUOTE),
            ("footer", Role.FOOTER_NOTE),
        ]:
            if key.startswith(prefix) or prefix in key:
                return role

    # 2. List flag (numPr)
    if para.is_list:
        return Role.LIST_ITEM

    # 3. Outline level (from style or direct w:outlineLvl)
    if para.outline_level is not None:
        lvl = para.outline_level
        if lvl == 0:
            return Role.HEADING_1
        elif lvl == 1:
            return Role.HEADING_2
        elif lvl <= 5:
            return Role.HEADING_3
        # outline_level 6+ → body (likely a deeply nested non-heading use)

    bold_ratio, italic_ratio, _ = _ratios(para)
    text = _text(para)
    words = len(text.split()) if text else 0

    size_pt = para.font_size_half_points / 2 if para.font_size_half_points else None

    # 4. Font size signals (only meaningful if we have a modal size to compare)
    if modal_size_pt and size_pt:
        ratio_to_modal = size_pt / modal_size_pt

        # Significantly larger than body text → title-class
        if ratio_to_modal >= 1.8:
            if position <= 3:
                return Role.TITLE
            return Role.HEADING_1

        # Moderately larger → heading
        if ratio_to_modal >= 1.3:
            if position <= 3:
                return Role.SERIES_LABEL if words <= 8 else Role.TITLE
            return Role.HEADING_1

    # 5. Italic ratio → quote
    if italic_ratio >= 0.6:
        if para.indent_first_line or para.indent_left:
            return Role.QUOTE
        # Short reference-style line (citation marker like "[25]" or "Ps 46:2")
        if words <= 12:
            return Role.REFERENCE_LINE
        return Role.QUOTE

    # 6. Fully bold, short, near top → structural label
    if bold_ratio >= 0.9:
        if words <= 8 and position <= 2:
            return Role.SERIES_LABEL
        if words <= 15:
            return Role.HEADING_1
        # Long bold paragraph → aim / objective statement
        if words <= 60 and position <= 5:
            return Role.AIM

    # 7. Definition-style detection:
    # A very short non-italic, non-bold paragraph immediately after a bold-heavy one
    # can be a definition_meta (e.g. "noun").
    if words <= 3 and position > 0:
        prev = all_paras[position - 1]
        prev_bold_ratio, _, _ = _ratios(prev)
        if prev_bold_ratio >= 0.8:
            return Role.DEFINITION_META

    return Role.BODY
