"""
Tests for spec.py (SPEC.md §13, Step 6).

Asserts that derive_spec() on climate_reference.docx produces a DerivedSpec
that matches every value in the §12 expected-spec table.
"""
from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from lxml import etree

from backend.app.ooxml.constants import NS_W
from backend.app.ooxml.package import DocxPackage
from backend.app.ooxml.spec import (
    derive_spec, DerivedSpec, RoleSpec, SectionSpec, _mode,
    FORMATTING_POLICY, apply_formatting_policy,
)
from backend.app.ooxml.sanitize import remove_big_line_breaks
from backend.app.classify.fallback import classify
from backend.app.classify.taxonomy import Role

W = NS_W

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
REFERENCE = os.path.join(FIXTURES, "climate_reference.docx")


# ===========================================================================
# Shared fixture
# ===========================================================================

@pytest.fixture(scope="module")
def derived(reference_paras, reference_roles):
    pkg = DocxPackage.open(REFERENCE)
    return derive_spec(pkg, reference_roles)


# ===========================================================================
# §12 table — section spec
# ===========================================================================

def test_page_size_legal(derived):
    """§12: Page size = Legal, 12240 × 20160 twips."""
    assert derived.section.page_width  == 12240
    assert derived.section.page_height == 20160


def test_margins_720_all_sides(derived):
    """§12: Margins = 720 twips (0.5 in) all four sides."""
    s = derived.section
    assert s.margin_top    == 720
    assert s.margin_right  == 720
    assert s.margin_bottom == 720
    assert s.margin_left   == 720


def test_no_header_footer(derived):
    """§12: Header/footer = none."""
    assert derived.section.has_header is False
    assert derived.section.has_footer is False


# ===========================================================================
# §12 table — body role spec
# ===========================================================================

@pytest.fixture(scope="module")
def body_spec(derived) -> RoleSpec:
    assert Role.BODY in derived.roles, "Body role must be in derived spec"
    return derived.roles[Role.BODY]


def test_body_font(body_spec):
    """§12: Font = Times New Roman throughout."""
    assert body_spec.font_name == "Times New Roman"


def test_body_size(body_spec):
    """§12: Body size = 44 half-points (22 pt)."""
    assert body_spec.font_size_half_points == 44


def test_body_line_spacing(body_spec):
    """§12: Line spacing = w:line='360' w:lineRule='auto' (1.5 lines)."""
    assert body_spec.line_spacing == 360
    assert body_spec.line_rule    == "auto"


def test_body_space_after(body_spec):
    """§12: Space after = 160 twips (8 pt)."""
    assert body_spec.space_after == 160


def test_body_alignment(body_spec):
    """§12: Alignment = justified (w:jc val='both')."""
    assert body_spec.alignment == "both"


def test_body_first_line_indent(body_spec):
    """§12: First-line indent = 720 twips (0.5 in)."""
    assert body_spec.indent_first_line == 720


def test_body_not_bold(body_spec):
    assert body_spec.bold is False


def test_body_not_italic(body_spec):
    assert body_spec.italic is False


def test_body_source_is_reference(body_spec):
    assert body_spec.source == "reference"


# ===========================================================================
# §12 table — heading spec
# ===========================================================================

@pytest.fixture(scope="module")
def heading_spec(derived) -> RoleSpec:
    assert Role.HEADING_1 in derived.roles, "heading_1 must be in derived spec"
    return derived.roles[Role.HEADING_1]


def test_heading_bold(heading_spec):
    """§12: Headings = bold."""
    assert heading_spec.bold is True


def test_heading_flush_left(heading_spec):
    """§12: Headings = flush left."""
    assert heading_spec.alignment == "left"


def test_heading_space_before(heading_spec):
    """§12: Headings = ~400 twips space before."""
    assert heading_spec.space_before is not None
    assert heading_spec.space_before >= 400


def test_heading_font(heading_spec):
    assert heading_spec.font_name == "Times New Roman"


# ===========================================================================
# §12 table — quote spec
# ===========================================================================

@pytest.fixture(scope="module")
def quote_spec(derived) -> RoleSpec:
    assert Role.QUOTE in derived.roles, "quote must be in derived spec"
    return derived.roles[Role.QUOTE]


def test_quote_italic(quote_spec):
    """§12: Quote blocks = italic."""
    assert quote_spec.italic is True


def test_quote_first_line_indented(quote_spec):
    """§12: Quote blocks = first-line indented."""
    assert quote_spec.indent_first_line is not None
    assert quote_spec.indent_first_line > 0


def test_quote_justified(quote_spec):
    """§12: Quote blocks = justified."""
    assert quote_spec.alignment == "both"


# ===========================================================================
# Role coverage
# ===========================================================================

def test_roles_present(derived):
    """All roles observed in the reference must appear in the spec."""
    assert Role.BODY       in derived.roles
    assert Role.HEADING_1  in derived.roles
    assert Role.QUOTE      in derived.roles
    assert Role.LIST_ITEM  in derived.roles


def test_all_role_specs_are_reference_sourced(derived):
    """When deriving from the reference alone, all specs should be source='reference'."""
    for role, rs in derived.roles.items():
        assert rs.source == "reference", (
            f"{role.value} has source={rs.source!r}, expected 'reference'"
        )


# ===========================================================================
# Fallback derivation
# ===========================================================================

def test_fallback_heading3_from_heading2(reference_paras, reference_roles):
    """
    When heading_3 is absent from the reference, it should be derived from
    heading_2 (or heading_1 if heading_2 is also absent).
    """
    pkg = DocxPackage.open(REFERENCE)
    # Derive with heading_3 as a target role not in the reference
    spec = derive_spec(pkg, reference_roles, target_roles=[Role.HEADING_3])
    if Role.HEADING_3 not in {role for role, rs in spec.roles.items() if rs.source == "reference"}:
        # heading_3 was derived via fallback
        h3 = spec.roles.get(Role.HEADING_3)
        assert h3 is not None, "heading_3 fallback was not created"
        assert h3.source == "fallback"
        # Must be based on heading_2 or heading_1
        h2 = spec.roles.get(Role.HEADING_2)
        h1 = spec.roles.get(Role.HEADING_1)
        base = h2 or h1
        if base:
            assert h3.font_name == base.font_name


def test_fallback_quote_from_body(reference_paras, reference_roles):
    """
    When quote is absent, derive as body + italic.
    We test this by patching the roles to remove any quote labels.
    """
    pkg = DocxPackage.open(REFERENCE)
    # Remove all quote labels from ref_roles
    no_quote_roles = [
        Role.BODY if r == Role.QUOTE else r
        for r in reference_roles
    ]
    spec = derive_spec(pkg, no_quote_roles, target_roles=[Role.QUOTE])
    q = spec.roles.get(Role.QUOTE)
    assert q is not None
    assert q.source == "fallback"
    assert q.italic is True
    assert q.font_name == spec.roles[Role.BODY].font_name


def test_fallback_warning_recorded(reference_paras, reference_roles):
    """derive_spec() must record a warning when a fallback is used."""
    pkg = DocxPackage.open(REFERENCE)
    no_quote_roles = [
        Role.BODY if r == Role.QUOTE else r
        for r in reference_roles
    ]
    spec = derive_spec(pkg, no_quote_roles, target_roles=[Role.QUOTE])
    assert any("quote" in w for w in spec.warnings), (
        f"Expected a warning about 'quote', got: {spec.warnings}"
    )


# ===========================================================================
# _mode helper
# ===========================================================================

def test_mode_returns_most_common():
    assert _mode([1, 2, 2, 3]) == 2


def test_mode_ignores_none():
    assert _mode([None, 1, 1, None]) == 1


def test_mode_all_none():
    assert _mode([None, None]) is None


def test_mode_empty():
    assert _mode([]) is None


def test_mode_strings():
    assert _mode(["a", "b", "a"]) == "a"


# ===========================================================================
# Section spec
# ===========================================================================

def test_section_spec_dataclass():
    s = SectionSpec(page_width=12240, page_height=20160,
                    margin_top=720, margin_right=720,
                    margin_bottom=720, margin_left=720)
    assert s.page_width == 12240
    assert s.has_header is False


def test_role_spec_dataclass():
    rs = RoleSpec(role=Role.BODY, font_name="TNR", font_size_half_points=44)
    assert rs.bold is False
    assert rs.source == "reference"


# ===========================================================================
# Formatting Policy & Constraints Tests
# ===========================================================================

def test_formatting_policy_dict_structure():
    """Verify FORMATTING_POLICY specifies all required rules/constraints."""
    assert FORMATTING_POLICY["min_font_size_pt"] == 22
    assert FORMATTING_POLICY["min_font_size_half_points"] == 44
    assert FORMATTING_POLICY["page_format"] == "legal"
    assert FORMATTING_POLICY["page_size"]["width"] == 12240
    assert FORMATTING_POLICY["page_size"]["height"] == 20160
    assert FORMATTING_POLICY["margins_in"] == {
        "left": 0.50,
        "right": 0.25,
        "top": 0.50,
        "bottom": 0.20,
    }
    assert FORMATTING_POLICY["margins_twips"] == {
        "left": 720,
        "right": 360,
        "top": 720,
        "bottom": 288,
    }
    assert FORMATTING_POLICY["line_break_before_heading"] is True


def test_apply_formatting_policy_clamps_min_font():
    """Any role with font < 22 pt (44 hp) is clamped to 44 hp."""
    roles = {
        Role.BODY: RoleSpec(role=Role.BODY, font_size_half_points=24),  # 12 pt
        Role.HEADING_1: RoleSpec(role=Role.HEADING_1, font_size_half_points=48),  # 24 pt
    }
    sec = SectionSpec()
    derived = DerivedSpec(roles=roles, section=sec, unmatched_roles=[], warnings=[])
    apply_formatting_policy(derived)

    assert derived.roles[Role.BODY].font_size_half_points == 44  # clamped to 22 pt
    assert derived.roles[Role.HEADING_1].font_size_half_points == 48  # preserved larger size


def test_apply_formatting_policy_page_legal_and_margins():
    """Enforces Legal size and (left: .50, right: .25, top: .50, bottom: .20)."""
    roles = {Role.BODY: RoleSpec(role=Role.BODY, font_size_half_points=44)}
    sec = SectionSpec(
        page_width=11906, page_height=16838,
        margin_top=1440, margin_right=1440, margin_bottom=1440, margin_left=1440
    )
    derived = DerivedSpec(roles=roles, section=sec, unmatched_roles=[], warnings=[])
    apply_formatting_policy(derived)

    assert derived.section.page_width == 12240
    assert derived.section.page_height == 20160
    assert derived.section.margin_left == 720
    assert derived.section.margin_right == 360
    assert derived.section.margin_top == 720
    assert derived.section.margin_bottom == 288


def test_apply_formatting_policy_heading_line_break():
    """Headings must have at least 1 line break space_before (>= 360 twips)."""
    roles = {
        Role.HEADING_1: RoleSpec(role=Role.HEADING_1, space_before=0),
        Role.HEADING_2: RoleSpec(role=Role.HEADING_2, space_before=None),
        Role.BODY: RoleSpec(role=Role.BODY, space_before=0),
    }
    sec = SectionSpec()
    derived = DerivedSpec(roles=roles, section=sec, unmatched_roles=[], warnings=[])
    apply_formatting_policy(derived)

    assert derived.roles[Role.HEADING_1].space_before >= 360
    assert derived.roles[Role.HEADING_2].space_before >= 360
    assert derived.roles[Role.BODY].space_before == 0  # body unaffected


def test_remove_big_line_breaks_intermediate_sectpr():
    """Intermediate w:sectPr inside body paragraphs must be stripped."""
    xml = etree.fromstring(f'''
    <w:document xmlns:w="{W}">
      <w:body>
        <w:p><w:r><w:t>Para 1</w:t></w:r></w:p>
        <w:p>
          <w:pPr>
            <w:sectPr><w:type w:val="nextPage"/></w:sectPr>
          </w:pPr>
        </w:p>
        <w:p><w:r><w:t>Para 2</w:t></w:r></w:p>
        <w:sectPr><w:type w:val="continuous"/></w:sectPr>
      </w:body>
    </w:document>
    ''')
    remove_big_line_breaks(xml)
    body = xml.find(f"{{{W}}}body")
    assert body.find(f"{{{W}}}sectPr") is not None
    for p in body.findall(f"{{{W}}}p"):
        assert p.find(f".//{{{W}}}sectPr") is None


def test_remove_big_line_breaks_empty_para_page_breaks():
    """Empty paragraphs must not contain w:br type='page' or w:pageBreakBefore."""
    xml = etree.fromstring(f'''
    <w:document xmlns:w="{W}">
      <w:body>
        <w:p>
          <w:pPr><w:pageBreakBefore/></w:pPr>
          <w:r><w:br w:type="page"/></w:r>
        </w:p>
      </w:body>
    </w:document>
    ''')
    remove_big_line_breaks(xml)
    p = xml.find(f".//{{{W}}}p")
    assert p.find(f".//{{{W}}}pageBreakBefore") is None
    assert p.find(f".//{{{W}}}br") is None

