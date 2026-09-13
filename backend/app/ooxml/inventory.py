"""
inventory.py — STAGE 2: Produce a compact digest of each paragraph.

SPEC.md §4: "Do not send whole documents to the model. Send one line per
paragraph."

Each digest dict contains:
  index          int   — paragraph position, 0-based
  role_hint      str   — fallback classifier's best guess (Role.value)
  text_excerpt   str   — first 150 characters, ellipsised with "…"
  font           str   — resolved font name, or "" if unknown
  size_pt        float — font size in points (half-points / 2)
  bold_ratio     float — fraction of characters that are bold
  italic_ratio   float — fraction of characters that are italic
  underline_ratio float — fraction of characters that are underlined
  alignment      str   — e.g. "both", "left", "center", "right", or ""
  indent_first   int   — first-line indent in twips (0 if none)
  space_before   int   — space before in twips (0 if none)
  is_list        bool
  outline_level  int | None
  style_id       str   — original w:pStyle value, or ""
  char_count     int   — total character count across all runs

The role_hint is produced by the deterministic fallback (classify.fallback).
It gives the LLM a prior so it can focus on ambiguous cases.
"""
from __future__ import annotations

from typing import Optional

from .resolver import ResolvedParagraph
from ..classify.taxonomy import Role


_EXCERPT_LEN = 150


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def digest(
    paras: list[ResolvedParagraph],
    role_hints: Optional[list[Role]] = None,
) -> list[dict]:
    """
    Build one digest dict per paragraph.

    Parameters
    ----------
    paras:
        Output of ``resolver.resolve_document()``.
    role_hints:
        Output of ``fallback.classify(paras)`` (or the LLM classification).
        If None, role_hint is set to ``"body"`` for every paragraph.
        Length must equal len(paras) when provided.
    """
    if role_hints is not None and len(role_hints) != len(paras):
        raise ValueError(
            f"role_hints length ({len(role_hints)}) must equal paras length "
            f"({len(paras)})"
        )

    return [
        _digest_one(p, role_hints[i] if role_hints else Role.BODY)
        for i, p in enumerate(paras)
    ]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _digest_one(para: ResolvedParagraph, role_hint: Role) -> dict:
    # Full text across all runs
    full_text = "".join(r.text for r in para.runs)
    char_count = len(full_text)

    # Emphasis ratios (fraction of characters with that property)
    if char_count > 0:
        bold_chars    = sum(len(r.text) for r in para.runs if r.bold)
        italic_chars  = sum(len(r.text) for r in para.runs if r.italic)
        under_chars   = sum(len(r.text) for r in para.runs if r.underline)
        bold_ratio    = bold_chars    / char_count
        italic_ratio  = italic_chars  / char_count
        under_ratio   = under_chars   / char_count
    else:
        bold_ratio = italic_ratio = under_ratio = 0.0

    # Text excerpt: first 150 chars, ellipsised
    if len(full_text) > _EXCERPT_LEN:
        text_excerpt = full_text[:_EXCERPT_LEN] + "…"
    else:
        text_excerpt = full_text

    return {
        "index":           para.index,
        "role_hint":       role_hint.value,
        "text_excerpt":    text_excerpt,
        "font":            para.font_name or "",
        "size_pt":         (para.font_size_half_points / 2)
                           if para.font_size_half_points else 0.0,
        "bold_ratio":      round(bold_ratio, 4),
        "italic_ratio":    round(italic_ratio, 4),
        "underline_ratio": round(under_ratio, 4),
        "alignment":       para.alignment or "",
        "indent_first":    para.indent_first_line or 0,
        "space_before":    para.space_before or 0,
        "is_list":         para.is_list,
        "outline_level":   para.outline_level,
        "style_id":        para.style_id or "",
        "char_count":      char_count,
    }
