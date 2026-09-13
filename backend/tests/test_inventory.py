"""
Tests for inventory.py (SPEC.md §13, Step 4) and
       fallback.py  (SPEC.md §13, Step 5).

Fixtures (reference_paras, original_paras, reference_digests, original_digests,
reference_roles, original_roles) are defined in conftest.py and shared across
the session to avoid repeated file I/O.
"""
from __future__ import annotations

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.ooxml.package import DocxPackage
from backend.app.ooxml.resolver import ResolvedParagraph, RunRecord, resolve_document
from backend.app.classify.taxonomy import Role, validate
from backend.app.classify.fallback import classify, _ratios, _modal_size
from backend.app.ooxml.inventory import digest

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
REFERENCE = os.path.join(FIXTURES, "climate_reference.docx")
ORIGINAL  = os.path.join(FIXTURES, "climate_original.docx")


# ===========================================================================
# Taxonomy
# ===========================================================================

class TestTaxonomy:

    def test_all_roles_have_values(self):
        for r in Role:
            assert isinstance(r.value, str) and len(r.value) > 0

    def test_validate_known_labels(self):
        assert validate("heading_1") == Role.HEADING_1
        assert validate("list_item") == Role.LIST_ITEM
        assert validate("body")      == Role.BODY

    def test_validate_unknown_returns_body(self):
        assert validate("invented_role") == Role.BODY
        assert validate("")              == Role.BODY
        assert validate("TITLE")         == Role.BODY   # case-sensitive

    def test_default_is_body(self):
        assert Role.default() == Role.BODY

    def test_role_compares_to_string(self):
        # Role(str, Enum) so values compare equal to their string
        assert Role.HEADING_1 == "heading_1"
        assert Role.BODY == "body"


# ===========================================================================
# Inventory: structural / contract tests
# ===========================================================================

REQUIRED_FIELDS = {
    "index", "role_hint", "text_excerpt", "font", "size_pt",
    "bold_ratio", "italic_ratio", "underline_ratio",
    "alignment", "indent_first", "space_before",
    "is_list", "outline_level", "style_id", "char_count",
}


def test_ref_has_all_fields(reference_digests):
    for d in reference_digests:
        missing = REQUIRED_FIELDS - set(d.keys())
        assert not missing, f"Para {d['index']} missing fields: {missing}"


def test_orig_has_all_fields(original_digests):
    for d in original_digests:
        missing = REQUIRED_FIELDS - set(d.keys())
        assert not missing, f"Para {d['index']} missing fields: {missing}"


def test_ref_digest_count(reference_digests):
    assert len(reference_digests) == 38


def test_orig_digest_count(original_digests):
    assert len(original_digests) == 41


def test_ref_indices_sequential(reference_digests):
    for i, d in enumerate(reference_digests):
        assert d["index"] == i


def test_orig_indices_sequential(original_digests):
    for i, d in enumerate(original_digests):
        assert d["index"] == i


def test_type_contracts(reference_digests):
    for d in reference_digests:
        assert isinstance(d["index"],            int)
        assert isinstance(d["role_hint"],        str)
        assert isinstance(d["text_excerpt"],     str)
        assert isinstance(d["font"],             str)
        assert isinstance(d["size_pt"],          (int, float))
        assert isinstance(d["bold_ratio"],       float)
        assert isinstance(d["italic_ratio"],     float)
        assert isinstance(d["underline_ratio"],  float)
        assert isinstance(d["alignment"],        str)
        assert isinstance(d["indent_first"],     int)
        assert isinstance(d["space_before"],     int)
        assert isinstance(d["is_list"],          bool)
        assert d["outline_level"] is None or isinstance(d["outline_level"], int)
        assert isinstance(d["style_id"],         str)
        assert isinstance(d["char_count"],       int)


def test_ratios_in_0_1(reference_digests):
    for d in reference_digests:
        assert 0.0 <= d["bold_ratio"]      <= 1.0
        assert 0.0 <= d["italic_ratio"]    <= 1.0
        assert 0.0 <= d["underline_ratio"] <= 1.0


def test_size_pt_non_negative(reference_digests):
    for d in reference_digests:
        assert d["size_pt"] >= 0.0


def test_role_hints_are_valid_taxonomy(reference_digests, original_digests):
    """Every role_hint must be a member of the closed taxonomy."""
    valid = {r.value for r in Role}
    for d in reference_digests + original_digests:
        assert d["role_hint"] in valid, (
            f"Para {d['index']} role_hint {d['role_hint']!r} not in taxonomy"
        )


def test_text_excerpt_max_length(reference_digests):
    """text_excerpt may be at most 150 chars + 1 ellipsis = 151 chars."""
    for d in reference_digests:
        assert len(d["text_excerpt"]) <= 151


def test_text_excerpt_ellipsised_when_long(original_digests):
    """Paragraphs with char_count > 150 must end with '…'."""
    long_paras = [d for d in original_digests if d["char_count"] > 150]
    assert long_paras, "Expected some paragraphs > 150 chars in original"
    for d in long_paras:
        assert d["text_excerpt"].endswith("…"), (
            f"Para {d['index']} (char_count={d['char_count']}) should end with '…'"
        )


def test_char_count_equals_full_text_length(reference_digests):
    """char_count must be the full text length, never capped at 150."""
    # Para 2 in the reference has char_count=155 (longer than 150);
    # verify char_count != len(text_excerpt) for truncated paragraphs.
    for d in reference_digests:
        if d["text_excerpt"].endswith("…"):
            assert d["char_count"] > 150, (
                f"Para {d['index']} is truncated but char_count={d['char_count']} <= 150"
            )
        else:
            assert d["char_count"] == len(d["text_excerpt"]), (
                f"Para {d['index']}: char_count={d['char_count']} != "
                f"len(text_excerpt)={len(d['text_excerpt'])}"
            )


def test_no_role_hints_defaults_to_body(reference_paras):
    digests_no_hints = digest(reference_paras, role_hints=None)
    assert all(d["role_hint"] == "body" for d in digests_no_hints)


def test_mismatched_hints_length_raises(reference_paras):
    with pytest.raises(ValueError, match="role_hints length"):
        digest(reference_paras, role_hints=[Role.BODY])  # wrong length


def test_digests_are_json_serialisable(reference_digests):
    """Digests will be sent to the LLM; they must serialise cleanly."""
    loaded = json.loads(json.dumps(reference_digests))
    assert len(loaded) == len(reference_digests)


# ===========================================================================
# Inventory: snapshot values (§12 expected spec)
# ===========================================================================

def test_ref_font_is_tnr(reference_digests):
    """All reference digests report Times New Roman (from docDefaults)."""
    for d in reference_digests:
        assert d["font"] == "Times New Roman", f"Para {d['index']} font: {d['font']!r}"


def test_ref_body_size_22pt(reference_digests):
    """Non-title reference body paragraphs are 22 pt (44 half-points)."""
    for d in reference_digests:
        if d["index"] == 1:
            continue   # title has a different size in run rPr
        assert d["size_pt"] == 22.0, f"Para {d['index']}: {d['size_pt']}pt"


def test_ref_body_para_bold_ratio(reference_digests):
    """Para 5 (plain body prose) has bold_ratio=0.0."""
    assert reference_digests[5]["bold_ratio"] == 0.0


def test_ref_list_items(reference_digests):
    """Paras 35-37 in reference are list items."""
    for d in reference_digests[35:38]:
        assert d["is_list"] is True
        assert d["role_hint"] == "list_item"


def test_ref_indent_first(reference_digests):
    """Para 5 has first-line indent = 720 twips."""
    assert reference_digests[5]["indent_first"] == 720


def test_ref_space_before_heading(reference_digests):
    """Para 3 ('Introduction:') has space_before >= 400."""
    assert reference_digests[3]["space_before"] >= 400


def test_orig_style_ids_in_digests(original_digests):
    style_ids = {d["style_id"] for d in original_digests}
    for expected in ("Heading3", "Heading4", "BodyText", "ListParagraph"):
        assert expected in style_ids


def test_orig_list_paras(original_digests):
    for idx in [37, 38, 40]:
        assert original_digests[idx]["is_list"] is True
        assert original_digests[idx]["role_hint"] == "list_item"


# ===========================================================================
# Fallback classifier
# ===========================================================================

def test_fallback_ref_output_length(reference_roles, reference_paras):
    assert len(reference_roles) == len(reference_paras)


def test_fallback_orig_output_length(original_roles, original_paras):
    assert len(original_roles) == len(original_paras)


def test_all_fallback_roles_valid(reference_roles, original_roles):
    for role in reference_roles + original_roles:
        assert isinstance(role, Role), f"Not a Role: {role!r}"


def test_orig_listparagraph_classified(original_roles, original_paras):
    for i, p in enumerate(original_paras):
        if p.style_id == "ListParagraph":
            assert original_roles[i] == Role.LIST_ITEM, (
                f"Para {i} style=ListParagraph → got {original_roles[i].value}"
            )


def test_orig_heading3_classified(original_roles, original_paras):
    for i, p in enumerate(original_paras):
        if p.style_id == "Heading3":
            assert original_roles[i] == Role.HEADING_3, (
                f"Para {i} style=Heading3 → got {original_roles[i].value}"
            )


def test_orig_heading4_classified(original_roles, original_paras):
    for i, p in enumerate(original_paras):
        if p.style_id == "Heading4":
            assert original_roles[i] == Role.HEADING_1, (
                f"Para {i} style=Heading4 → got {original_roles[i].value}"
            )


def test_ref_italic_paras_quote_or_ref(reference_roles, reference_paras):
    for i, p in enumerate(reference_paras):
        _, italic_ratio, _ = _ratios(p)
        if italic_ratio >= 0.9:
            assert reference_roles[i] in (
                Role.QUOTE, Role.REFERENCE_LINE, Role.DEFINITION_META
            ), (
                f"Para {i} italic={italic_ratio:.2f} → got {reference_roles[i].value}"
            )


def test_ref_list_paras_classified(reference_roles):
    for idx in [35, 36, 37]:
        assert reference_roles[idx] == Role.LIST_ITEM


def test_modal_size_reference(reference_paras):
    assert _modal_size(reference_paras) == 22.0


def test_modal_size_original(original_paras):
    assert _modal_size(original_paras) == 12.0


def test_modal_size_empty():
    assert _modal_size([]) is None


def test_ratios_empty_para():
    p = ResolvedParagraph(index=0, runs=[])
    assert _ratios(p) == (0.0, 0.0, 0.0)


def test_ratios_fully_bold():
    p = ResolvedParagraph(index=0, runs=[
        RunRecord(text="hello", bold=True, italic=False, underline=False, strike=False),
    ])
    b, i, u = _ratios(p)
    assert b == 1.0 and i == 0.0


def test_ratios_mixed():
    p = ResolvedParagraph(index=0, runs=[
        RunRecord(text="hel", bold=True,  italic=False, underline=False, strike=False),
        RunRecord(text="lo",  bold=False, italic=True,  underline=False, strike=False),
    ])
    b, i, _ = _ratios(p)
    assert abs(b - 3/5) < 0.001
    assert abs(i - 2/5) < 0.001


# --- Unit tests for individual fallback rules ---

def _make_para(**kwargs) -> ResolvedParagraph:
    defaults = dict(
        index=0, style_id=None, outline_level=None,
        is_list=False, list_level=None, num_id=None,
        font_name="Times New Roman", font_size_half_points=44,
        line_spacing=None, line_rule=None,
        space_before=None, space_after=None,
        indent_left=None, indent_right=None,
        indent_first_line=None, indent_hanging=None,
        alignment="both", runs=[],
    )
    defaults.update(kwargs)
    return ResolvedParagraph(**defaults)


def test_rule_is_list():
    p = _make_para(is_list=True, num_id=1, list_level=0)
    assert classify([p])[0] == Role.LIST_ITEM


def test_rule_outline_0():
    assert classify([_make_para(outline_level=0)])[0] == Role.HEADING_1


def test_rule_outline_1():
    assert classify([_make_para(outline_level=1)])[0] == Role.HEADING_2


def test_rule_outline_2():
    assert classify([_make_para(outline_level=2)])[0] == Role.HEADING_3


def test_rule_italic_quote_with_indent():
    runs = [RunRecord(text="A " * 20, bold=False, italic=True, underline=False, strike=False)]
    p = _make_para(runs=runs, indent_first_line=720)
    assert classify([p])[0] == Role.QUOTE


def test_rule_italic_short_no_indent_is_ref_or_quote():
    runs = [RunRecord(text="Psalm 46:2-3,", bold=False, italic=True, underline=False, strike=False)]
    p = _make_para(index=5, runs=runs, indent_first_line=None, indent_left=None)
    assert classify([p])[0] in (Role.REFERENCE_LINE, Role.QUOTE)


def test_rule_style_title():
    assert classify([_make_para(style_id="Title")])[0] == Role.TITLE


def test_rule_style_heading1():
    assert classify([_make_para(style_id="Heading1")])[0] == Role.HEADING_1


def test_rule_style_listparagraph():
    p = _make_para(style_id="ListParagraph", is_list=True, num_id=1, list_level=0)
    assert classify([p])[0] == Role.LIST_ITEM


def test_rule_style_caption():
    assert classify([_make_para(style_id="Caption")])[0] == Role.CAPTION


def test_rule_unknown_style_no_crash():
    role = classify([_make_para(style_id="SomeWeirdStyle123")])[0]
    assert isinstance(role, Role)


def test_rule_default_is_body():
    runs = [RunRecord(text="Normal text here.", bold=False, italic=False,
                      underline=False, strike=False)]
    p = _make_para(runs=runs, index=5)
    assert classify([p])[0] == Role.BODY


def test_classify_empty_list():
    assert classify([]) == []
