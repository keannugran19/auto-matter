"""
taxonomy.py — Closed role taxonomy for paragraph classification.

SPEC.md §5: "Closed taxonomy — the model may return nothing else."

Every label returned by the LLM or the fallback must be validated against
this set.  Unrecognised labels are silently mapped to ``body``.
"""
from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """The closed set of paragraph roles used throughout the system."""

    TITLE           = "title"           # document title
    SUBTITLE        = "subtitle"        # line under the title
    SERIES_LABEL    = "series_label"    # short label above the title, e.g. "Lesson 42"
    AIM             = "aim"             # purpose/objective statement
    HEADING_1       = "heading_1"       # top-level section heading
    HEADING_2       = "heading_2"       # sub-heading
    HEADING_3       = "heading_3"       # sub-sub-heading
    BODY            = "body"            # normal prose
    QUOTE           = "quote"           # quoted / scripture block
    REFERENCE_LINE  = "reference_line"  # citation label on its own line
    DEFINITION_TERM = "definition_term" # a term being defined
    DEFINITION_META = "definition_meta" # part-of-speech or annotation
    LIST_ITEM       = "list_item"       # numbered or bulleted item
    CAPTION         = "caption"         # figure or table caption
    FOOTER_NOTE     = "footer_note"     # source / attribution at the end

    # Convenience alias so callers don't need to know the string value.
    @classmethod
    def default(cls) -> "Role":
        return cls.BODY


# ---------------------------------------------------------------------------
# Validation helper
# ---------------------------------------------------------------------------

_VALID: frozenset[str] = frozenset(r.value for r in Role)


def validate(label: str) -> Role:
    """
    Return the Role for *label*, or Role.BODY if the label is not in the
    closed taxonomy.

    SPEC.md §5: "Validate every returned label against the enum.
    Unrecognised → body.  Never trust raw output."
    """
    if label in _VALID:
        return Role(label)
    return Role.BODY


# ---------------------------------------------------------------------------
# JSON Schema for the LLM structured-output call (stage 3)
# Used by llm.py; defined here so it stays in sync with the enum.
# ---------------------------------------------------------------------------

ROLE_ENUM_VALUES: list[str] = [r.value for r in Role]
