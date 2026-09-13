"""
spec.py — STAGE 4: Derive a formatting specification from the reference document.

SPEC.md §7: For each role present in the reference, collect all paragraphs
carrying that role and reduce to one spec by taking, per property, the most
common value (mode).  Averaging is forbidden — it produces values like 22.4 pt
that appear nowhere in the source.

Also extracts section-level settings: page size, margins, header/footer presence.

Fallbacks for roles absent from the reference (§7):
  heading_3 missing → copy from heading_2, or heading_1
  quote     missing → body spec + italic=True
  anything else     → body, recorded as unmatched

Output types
------------
  RoleSpec          — formatting values for one role
  SectionSpec       — page size and margins
  DerivedSpec       — complete derived spec (all roles + section)
"""
from __future__ import annotations

import dataclasses
from collections import Counter
from typing import Optional

from lxml import etree

from .constants import NS_W
from .package import DocxPackage
from .resolver import ResolvedParagraph, resolve_document
from ..classify.taxonomy import Role


W = NS_W


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclasses.dataclass
class RoleSpec:
    """Formatting specification for one paragraph role."""
    role: Role

    # Run properties
    font_name: Optional[str]           = None
    font_size_half_points: Optional[int] = None
    bold: bool                         = False
    italic: bool                       = False

    # Paragraph spacing (twips)
    line_spacing: Optional[int]        = None
    line_rule: Optional[str]           = None   # "auto" | "exact" | "atLeast"
    space_before: Optional[int]        = None
    space_after: Optional[int]         = None

    # Indentation (twips)
    indent_left: Optional[int]         = None
    indent_right: Optional[int]        = None
    indent_first_line: Optional[int]   = None
    indent_hanging: Optional[int]      = None

    # Alignment
    alignment: Optional[str]           = None

    # Source
    source: str = "reference"          # "reference" | "fallback"
    paragraph_count: int = 0


@dataclasses.dataclass
class SectionSpec:
    """Section-level (page) settings."""
    page_width: Optional[int]   = None    # twips
    page_height: Optional[int]  = None    # twips
    margin_top: Optional[int]   = None    # twips
    margin_right: Optional[int] = None
    margin_bottom: Optional[int]= None
    margin_left: Optional[int]  = None
    has_header: bool             = False
    has_footer: bool             = False


@dataclasses.dataclass
class DerivedSpec:
    """Complete derived spec: one RoleSpec per role + section settings."""
    roles: dict[Role, RoleSpec]         # Role → spec
    section: SectionSpec
    unmatched_roles: list[Role]         # target roles with no reference example
    warnings: list[str]                 # human-readable issues


# ---------------------------------------------------------------------------
# Mode helper
# ---------------------------------------------------------------------------

def _mode(values: list) -> Optional[object]:
    """Return the most common non-None value, or None if the list is empty."""
    filtered = [v for v in values if v is not None]
    if not filtered:
        return None
    return Counter(filtered).most_common(1)[0][0]


# ---------------------------------------------------------------------------
# Section spec extraction
# ---------------------------------------------------------------------------

def _extract_section(pkg: DocxPackage) -> SectionSpec:
    """
    Extract page size, margins, and header/footer presence from the document's
    sectPr element (the last child of w:body).
    """
    doc_root = pkg.get_xml("word/document.xml")
    body = doc_root.find(f"{{{W}}}body")
    sectPr = None

    if body is not None:
        # sectPr is always the last element in body when present as direct child
        for child in reversed(list(body)):
            if etree.QName(child.tag).localname == "sectPr":
                sectPr = child
                break

    spec = SectionSpec()
    if sectPr is None:
        return spec

    # Page size
    pgSz = sectPr.find(f"{{{W}}}pgSz")
    if pgSz is not None:
        w_val = pgSz.get(f"{{{W}}}w")
        h_val = pgSz.get(f"{{{W}}}h")
        if w_val: spec.page_width  = int(w_val)
        if h_val: spec.page_height = int(h_val)

    # Margins
    pgMar = sectPr.find(f"{{{W}}}pgMar")
    if pgMar is not None:
        for side in ("top", "right", "bottom", "left"):
            v = pgMar.get(f"{{{W}}}{side}")
            if v is not None:
                setattr(spec, f"margin_{side}", int(v))

    # Header / footer presence
    spec.has_header = sectPr.find(f"{{{W}}}headerReference") is not None
    spec.has_footer = sectPr.find(f"{{{W}}}footerReference") is not None

    return spec


# ---------------------------------------------------------------------------
# Role spec derivation — mode aggregation
# ---------------------------------------------------------------------------

def _derive_role_spec(role: Role, paras: list[ResolvedParagraph]) -> RoleSpec:
    """
    Aggregate a list of paragraphs with the same role into one RoleSpec by
    taking the mode of each property.  SPEC.md §7: use mode, not mean.
    """
    def m(attr):
        return _mode([getattr(p, attr) for p in paras])

    # For boolean run properties (bold, italic) we use the mode of True/False.
    # Convert to int for Counter, then back to bool.
    bold_vals   = [p.runs[0].bold   if p.runs else False for p in paras]
    italic_vals = [p.runs[0].italic if p.runs else False for p in paras]
    # More robust: check if majority of characters are bold/italic
    def _char_ratio(attr: str) -> float:
        total = sum(sum(len(r.text) for r in p.runs) for p in paras)
        if total == 0:
            return 0.0
        marked = sum(
            sum(len(r.text) for r in p.runs if getattr(r, attr))
            for p in paras
        )
        return marked / total

    bold_dominant   = _char_ratio("bold")   >= 0.5
    italic_dominant = _char_ratio("italic") >= 0.5

    return RoleSpec(
        role=role,
        font_name             = m("font_name"),
        font_size_half_points = m("font_size_half_points"),
        bold                  = bold_dominant,
        italic                = italic_dominant,
        line_spacing          = m("line_spacing"),
        line_rule             = m("line_rule"),
        space_before          = m("space_before"),
        space_after           = m("space_after"),
        indent_left           = m("indent_left"),
        indent_right          = m("indent_right"),
        indent_first_line     = m("indent_first_line"),
        indent_hanging        = m("indent_hanging"),
        alignment             = m("alignment"),
        source                = "reference",
        paragraph_count       = len(paras),
    )


# ---------------------------------------------------------------------------
# Fallback derivation (§7 rules for absent roles)
# ---------------------------------------------------------------------------

def _fallback_spec(
    role: Role,
    available: dict[Role, RoleSpec],
) -> tuple[RoleSpec, str]:
    """
    Derive a spec for *role* when no reference examples exist.
    Returns (spec, warning_message).
    """
    body_spec = available.get(Role.BODY)

    if role == Role.HEADING_3:
        base = available.get(Role.HEADING_2) or available.get(Role.HEADING_1)
        if base:
            spec = dataclasses.replace(base, role=Role.HEADING_3,
                                       source="fallback", paragraph_count=0)
            return spec, f"heading_3 missing in reference; derived from {base.role.value}"

    if role == Role.HEADING_2:
        base = available.get(Role.HEADING_1)
        if base:
            spec = dataclasses.replace(base, role=Role.HEADING_2,
                                       source="fallback", paragraph_count=0)
            return spec, "heading_2 missing in reference; derived from heading_1"

    if role == Role.QUOTE:
        if body_spec:
            spec = dataclasses.replace(body_spec, role=Role.QUOTE,
                                       italic=True, source="fallback", paragraph_count=0)
            return spec, "quote missing in reference; derived as body + italic"

    # Default: use body
    if body_spec:
        spec = dataclasses.replace(body_spec, role=role,
                                   source="fallback", paragraph_count=0)
        return spec, f"{role.value} unresolvable in reference; defaulted to body"

    # Absolute fallback: empty spec
    spec = RoleSpec(role=role, source="fallback")
    return spec, f"{role.value} unresolvable; no body spec available"


# ---------------------------------------------------------------------------
# Formatting Policy & Constraints
# ---------------------------------------------------------------------------

FORMATTING_POLICY: dict = {
    # Minimum font should be 22 pt (44 half-points in OOXML w:sz)
    "min_font_size_pt": 22,
    "min_font_size_half_points": 44,

    # Page format should be "legal" (8.5 in x 14.0 in = 12240 x 20160 twips)
    "page_format": "legal",
    "page_size": {
        "width": 12240,
        "height": 20160,
    },

    # Margin should be (left: .50, right: .25, top: .50, bottom: .20) in inches
    "margins_in": {
        "left": 0.50,
        "right": 0.25,
        "top": 0.50,
        "bottom": 0.20,
    },
    # Margin in twips (1 inch = 1440 twips)
    "margins_twips": {
        "left": 720,    # 0.50 in * 1440
        "right": 360,   # 0.25 in * 1440
        "top": 720,     # 0.50 in * 1440
        "bottom": 288,  # 0.20 in * 1440
    },

    # There should be a line break before every heading
    "line_break_before_heading": True,
}


def apply_formatting_policy(
    derived: DerivedSpec,
    policy: Optional[dict] = None,
) -> DerivedSpec:
    """
    Apply formatting policy rules and constraints to a DerivedSpec.

    Rules & Constraints enforced:
      1. Minimum font: >= 22 pt (44 half-points).
      2. Page format: "legal" (width 12240, height 20160 twips).
      3. Margins: left: 0.50" (720 twips), right: 0.25" (360 twips),
                  top: 0.50" (720 twips), bottom: 0.20" (288 twips).
      4. Line break before every heading: ensures space_before is at least 1 full
         line height (>= 360 twips) for all heading roles.
    """
    if policy is None:
        policy = FORMATTING_POLICY

    # 1. Enforce minimum font size (22 pt = 44 half-points)
    min_hp = policy.get("min_font_size_half_points")
    if min_hp is None and "min_font_size_pt" in policy:
        min_hp = int(policy["min_font_size_pt"] * 2)
    if min_hp is not None:
        for spec in derived.roles.values():
            if spec.font_size_half_points is None or spec.font_size_half_points < min_hp:
                spec.font_size_half_points = min_hp

    # 2. Enforce page format ("legal")
    page_fmt = policy.get("page_format")
    if page_fmt == "legal":
        pg_sz = policy.get("page_size", {"width": 12240, "height": 20160})
        derived.section.page_width = pg_sz["width"]
        derived.section.page_height = pg_sz["height"]

    # 3. Enforce margins (left: .50, right: .25, top: .50, bottom: .20)
    m_twips = policy.get("margins_twips")
    if not m_twips and "margins_in" in policy:
        m_in = policy["margins_in"]
        m_twips = {k: int(v * 1440) for k, v in m_in.items()}
    if m_twips:
        if "left" in m_twips: derived.section.margin_left = m_twips["left"]
        if "right" in m_twips: derived.section.margin_right = m_twips["right"]
        if "top" in m_twips: derived.section.margin_top = m_twips["top"]
        if "bottom" in m_twips: derived.section.margin_bottom = m_twips["bottom"]

    # 4. Enforce line break before every heading
    if policy.get("line_break_before_heading"):
        for role, spec in derived.roles.items():
            if "heading" in role.value:
                min_space_before = 360  # ~1.5 lines or 1 full line break
                if spec.space_before is None or spec.space_before < min_space_before:
                    spec.space_before = min_space_before

    return derived


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def derive_spec(
    ref_pkg: DocxPackage,
    ref_roles: list[Role],
    target_roles: Optional[list[Role]] = None,
    policy: Optional[dict] = None,
) -> DerivedSpec:
    """
    Derive the complete formatting spec from a reference document.

    Parameters
    ----------
    ref_pkg:
        The reference DocxPackage.
    ref_roles:
        Classification results for the reference paragraphs, one per paragraph
        (from fallback.classify() or llm.classify()).
    target_roles:
        Optional list of roles present in the target document.  Used to
        trigger fallback derivation for roles absent from the reference.
        If None, only roles found in the reference are in the output.
    policy:
        Optional formatting policy dict (e.g. FORMATTING_POLICY) to enforce
        rules and constraints on top of derived values.

    Returns
    -------
    DerivedSpec
    """
    ref_paras = resolve_document(ref_pkg)

    if len(ref_roles) != len(ref_paras):
        raise ValueError(
            f"ref_roles length ({len(ref_roles)}) must equal "
            f"number of reference paragraphs ({len(ref_paras)})"
        )

    # Group reference paragraphs by role
    grouped: dict[Role, list[ResolvedParagraph]] = {}
    for para, role in zip(ref_paras, ref_roles):
        grouped.setdefault(role, []).append(para)

    # Derive one RoleSpec per role found in the reference
    role_specs: dict[Role, RoleSpec] = {}
    for role, paras in grouped.items():
        role_specs[role] = _derive_role_spec(role, paras)

    # Apply fallbacks for target roles absent from the reference
    warnings: list[str] = []
    unmatched: list[Role] = []

    if target_roles:
        for role in set(target_roles):
            if role not in role_specs:
                spec, warn = _fallback_spec(role, role_specs)
                role_specs[role] = spec
                warnings.append(warn)
                if spec.source == "fallback" and Role.BODY not in grouped:
                    unmatched.append(role)

    section = _extract_section(ref_pkg)

    derived = DerivedSpec(
        roles=role_specs,
        section=section,
        unmatched_roles=unmatched,
        warnings=warnings,
    )

    if policy is not None:
        derived = apply_formatting_policy(derived, policy)

    return derived

