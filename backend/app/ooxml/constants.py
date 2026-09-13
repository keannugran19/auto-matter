"""
OOXML namespace constants and element-order tables.

Authoritative sources:
  - ECMA-376 5th edition, Part 1
  - SPEC.md §8b (element order)
"""

# ---------------------------------------------------------------------------
# Namespace URIs
# ---------------------------------------------------------------------------

NS_W  = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS_R  = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"

# Convenience: return a Clark-notation tag for the w: namespace.
def w(local: str) -> str:
    return f"{{{NS_W}}}{local}"


def r(local: str) -> str:
    return f"{{{NS_R}}}{local}"


# ---------------------------------------------------------------------------
# Canonical namespace map for lxml serialisation
# ---------------------------------------------------------------------------

NSMAP = {"w": NS_W, "r": NS_R}


# ---------------------------------------------------------------------------
# w:rPr child order (ECMA-376 §17.3.2.28, Table 8)
# Used by the order-enforcing insert helper in restyle.py.
# ---------------------------------------------------------------------------

RPR_ORDER = (
    "rStyle",
    "rFonts",
    "b",
    "bCs",
    "i",
    "iCs",
    "caps",
    "smallCaps",
    "strike",
    "dstrike",
    "outline",
    "shadow",
    "emboss",
    "imprint",
    "noProof",
    "snapToGrid",
    "vanish",
    "webHidden",
    "color",
    "spacing",   # character-level letter-spacing (w:rPr/w:spacing), NOT line spacing
    "w",
    "kern",
    "position",
    "sz",
    "szCs",
    "highlight",
    "u",
    "effect",
    "bdr",
    "shd",
    "fitText",
    "vertAlign",
    "rtl",
    "cs",
    "em",
    "lang",
    "eastAsianLayout",
    "specVanish",
    "oMath",
)

# ---------------------------------------------------------------------------
# w:pPr child order (ECMA-376 §17.3.1.26, Table 3)
# ---------------------------------------------------------------------------

PPR_ORDER = (
    "pStyle",
    "keepNext",
    "keepLines",
    "pageBreakBefore",
    "framePr",
    "widowControl",
    "numPr",
    "suppressLineNumbers",
    "pBdr",
    "shd",
    "tabs",
    "suppressAutoHyphens",
    "kinsoku",
    "wordWrap",
    "overflowPunct",
    "topLinePunct",
    "autoSpaceDE",
    "autoSpaceDN",
    "bidi",
    "adjustRightInd",
    "snapToGrid",
    "spacing",   # paragraph spacing (w:pPr/w:spacing) — distinct from w:rPr/w:spacing
    "ind",
    "contextualSpacing",
    "mirrorIndents",
    "suppressOverlap",
    "jc",
    "textDirection",
    "textAlignment",
    "textboxTightWrap",
    "outlineLvl",
    "divId",
    "cnfStyle",
    "rPr",
    "sectPr",
    "pPrChange",
)

# Index maps for O(1) lookup during sorting.
RPR_ORDER_INDEX: dict[str, int] = {tag: i for i, tag in enumerate(RPR_ORDER)}
PPR_ORDER_INDEX: dict[str, int] = {tag: i for i, tag in enumerate(PPR_ORDER)}
