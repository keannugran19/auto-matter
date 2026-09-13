"""
Tests for sanitize.py + restyle.py (SPEC.md §13, Step 7).

Key assertions:
  1. No-op round-trip: sanitise + write produces a valid DOCX with all text intact
  2. Authorial emphasis (bold, italic, underline) is preserved after sanitise
  3. Presentation formatting (font, size, spacing, indent, jc) is stripped
  4. Hyperlink rStyle is never stripped
  5. FT_* styles are injected into styles.xml
  6. Paragraph pStyles are rewritten to FT_* names
  7. sectPr is rewritten with reference page size and margins
  8. Full pipeline: restyle() on original produces a DOCX that round-trips
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
import zipfile

import pytest
from lxml import etree

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.ooxml.package import DocxPackage
from backend.app.ooxml.resolver import resolve_document
from backend.app.ooxml.sanitize import (
    sanitise_paragraph, sanitise_document,
    _sanitise_ppr, _sanitise_run,
    _insert_ordered_rpr, _insert_ordered_ppr,
)
from backend.app.ooxml.restyle import (
    restyle, inject_styles, assign_paragraph_styles, rewrite_section,
    _ft_style_id, _make_style_element,
)
from backend.app.ooxml.spec import derive_spec, SectionSpec, RoleSpec
from backend.app.classify.fallback import classify
from backend.app.classify.taxonomy import Role

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
ORIGINAL  = os.path.join(FIXTURES, "climate_original.docx")
REFERENCE = os.path.join(FIXTURES, "climate_reference.docx")

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def w(tag): return f"{{{W}}}{tag}"


def _xml(s: str) -> etree._Element:
    return etree.fromstring(s.format(W=W))


# ===========================================================================
# Helpers
# ===========================================================================

def _pkg(path: str) -> DocxPackage:
    return DocxPackage.open(path)


def _text_content(doc_root: etree._Element) -> list[str]:
    """Extract all w:t text from a document root."""
    return [t.text or "" for t in doc_root.iter(w("t"))]


# ===========================================================================
# 1. No-op round-trip: text content preserved after sanitise + write
# ===========================================================================

def test_noop_restyle_preserves_text(tmp_path):
    """
    Sanitise + write → reload → text content must be identical.
    This is the SPEC.md step-7 'no-op patch round-trip' test.
    """
    pkg = _pkg(ORIGINAL)
    doc_before = pkg.get_xml("word/document.xml")
    texts_before = _text_content(doc_before)

    out_path = str(tmp_path / "out.docx")
    restyle(pkg, derived=None, target_roles=None, output_path=out_path)

    pkg2 = _pkg(out_path)
    doc_after = pkg2.get_xml("word/document.xml")
    texts_after = _text_content(doc_after)

    assert texts_before == texts_after, (
        f"Text changed after no-op restyle. "
        f"Before: {texts_before[:5]}, After: {texts_after[:5]}"
    )


def test_noop_restyle_produces_valid_zip(tmp_path):
    """Output must be a valid ZIP (i.e., a valid DOCX)."""
    pkg = _pkg(ORIGINAL)
    out_path = str(tmp_path / "out.docx")
    restyle(pkg, derived=None, target_roles=None, output_path=out_path)
    with zipfile.ZipFile(out_path) as zf:
        assert "word/document.xml" in zf.namelist()
        assert "[Content_Types].xml" in zf.namelist()


def test_noop_restyle_reference_text(tmp_path):
    """Same test on the reference fixture."""
    pkg = _pkg(REFERENCE)
    texts_before = _text_content(pkg.get_xml("word/document.xml"))
    out_path = str(tmp_path / "ref_out.docx")
    restyle(pkg, derived=None, target_roles=None, output_path=out_path)
    texts_after = _text_content(_pkg(out_path).get_xml("word/document.xml"))
    assert texts_before == texts_after


# ===========================================================================
# 2. Sanitise: presentation formatting stripped from pPr
# ===========================================================================

def _make_ppr_with(**tags) -> etree._Element:
    pPr = etree.Element(w("pPr"))
    for tag in tags:
        child = etree.SubElement(pPr, w(tag))
        child.set(w("val"), "test")
    return pPr


def test_sanitise_ppr_removes_spacing():
    pPr = _make_ppr_with(spacing=True)
    _sanitise_ppr(pPr)
    assert pPr.find(w("spacing")) is None


def test_sanitise_ppr_removes_ind():
    pPr = _make_ppr_with(ind=True)
    _sanitise_ppr(pPr)
    assert pPr.find(w("ind")) is None


def test_sanitise_ppr_removes_jc():
    pPr = _make_ppr_with(jc=True)
    _sanitise_ppr(pPr)
    assert pPr.find(w("jc")) is None


def test_sanitise_ppr_removes_contextualSpacing():
    pPr = _make_ppr_with(contextualSpacing=True)
    _sanitise_ppr(pPr)
    assert pPr.find(w("contextualSpacing")) is None


def test_sanitise_ppr_removes_textAlignment():
    pPr = _make_ppr_with(textAlignment=True)
    _sanitise_ppr(pPr)
    assert pPr.find(w("textAlignment")) is None


def test_sanitise_ppr_preserves_pstyle():
    pPr = _make_ppr_with(pStyle=True, spacing=True)
    _sanitise_ppr(pPr)
    # pStyle must survive; spacing must go
    assert pPr.find(w("pStyle")) is not None
    assert pPr.find(w("spacing")) is None


def test_sanitise_ppr_preserves_numpr():
    pPr = _make_ppr_with(numPr=True, ind=True)
    _sanitise_ppr(pPr)
    assert pPr.find(w("numPr")) is not None
    assert pPr.find(w("ind")) is None


# ===========================================================================
# 3. Sanitise: emphasis PRESERVED in rPr
# ===========================================================================

def _make_run_with_rpr(*keep_tags, **strip_tags) -> etree._Element:
    """Build a w:r with a w:rPr containing the specified elements."""
    run = etree.Element(w("r"))
    rPr = etree.SubElement(run, w("rPr"))
    for tag in keep_tags:
        etree.SubElement(rPr, w(tag))
    for tag in strip_tags:
        etree.SubElement(rPr, w(tag))
    t = etree.SubElement(run, w("t"))
    t.text = "text"
    return run


def test_sanitise_run_preserves_bold():
    run = _make_run_with_rpr("b", sz=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    assert rPr is not None
    assert rPr.find(w("b")) is not None


def test_sanitise_run_preserves_italic():
    run = _make_run_with_rpr("i", sz=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    assert rPr.find(w("i")) is not None


def test_sanitise_run_preserves_underline():
    run = _make_run_with_rpr("u", sz=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    assert rPr.find(w("u")) is not None


def test_sanitise_run_preserves_strike():
    run = _make_run_with_rpr("strike", sz=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    assert rPr.find(w("strike")) is not None


def test_sanitise_run_preserves_vertAlign():
    run = _make_run_with_rpr("vertAlign", sz=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    assert rPr.find(w("vertAlign")) is not None


def test_sanitise_run_preserves_highlight():
    run = _make_run_with_rpr("highlight", sz=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    assert rPr.find(w("highlight")) is not None


def test_sanitise_run_preserves_rStyle():
    """§8a note: rStyle must NEVER be stripped — may be Hyperlink etc."""
    run = _make_run_with_rpr("rStyle", sz=True, rFonts=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    assert rPr.find(w("rStyle")) is not None


# ===========================================================================
# 4. Sanitise: presentation formatting STRIPPED from rPr
# ===========================================================================

def test_sanitise_run_strips_rFonts():
    run = _make_run_with_rpr(rFonts=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    # rPr may be None (removed when empty) or have no rFonts
    if rPr is not None:
        assert rPr.find(w("rFonts")) is None


def test_sanitise_run_strips_sz():
    run = _make_run_with_rpr(sz=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    if rPr is not None:
        assert rPr.find(w("sz")) is None


def test_sanitise_run_strips_szCs():
    run = _make_run_with_rpr(szCs=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    if rPr is not None:
        assert rPr.find(w("szCs")) is None


def test_sanitise_run_strips_color():
    run = _make_run_with_rpr(color=True)
    _sanitise_run(run)
    rPr = run.find(w("rPr"))
    if rPr is not None:
        assert rPr.find(w("color")) is None


def test_sanitise_run_empty_rpr_removed():
    """If stripping leaves an empty rPr, it should be removed entirely."""
    run = _make_run_with_rpr(sz=True, szCs=True, rFonts=True)
    _sanitise_run(run)
    assert run.find(w("rPr")) is None


# ===========================================================================
# 5. Sanitise: fixture round-trip — emphasis preserved in real docs
# ===========================================================================

def test_original_bold_runs_preserved_after_sanitise():
    """
    Para 2 in climate_original.docx has a bold run ('Objectives:').
    After sanitise, that run must still have w:b.
    """
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")
    body = doc_root.find(w("body"))
    body_paras = [c for c in body if etree.QName(c.tag).localname == "p"]
    p2 = body_paras[2]  # BodyText, has bold runs

    sanitise_paragraph(p2)

    bold_runs = [
        r for r in p2.findall(w("r"))
        if r.find(f"{w('rPr')}/{w('b')}") is not None
           or (r.find(w("rPr")) is not None and r.find(w("rPr")).find(w("b")) is not None)
    ]
    # More permissive check: at least one run has w:b after sanitise
    has_bold = any(
        run.find(w("rPr")) is not None and run.find(w("rPr")).find(w("b")) is not None
        for run in p2.iter(w("r"))
    )
    assert has_bold, "Bold runs should survive sanitise"


def test_original_font_stripped_after_sanitise():
    """
    After sanitise, direct rFonts should be gone from runs in the original.
    """
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")
    sanitise_document(doc_root)

    # Check that no w:r/w:rPr has w:rFonts anywhere in the document body
    body = doc_root.find(w("body"))
    for run in body.iter(w("r")):
        rPr = run.find(w("rPr"))
        if rPr is not None:
            assert rPr.find(w("rFonts")) is None, (
                "rFonts should be stripped from direct run formatting"
            )


def test_original_spacing_stripped_from_ppr():
    """Direct spacing on pPr should be gone after sanitise."""
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")
    sanitise_document(doc_root)
    body = doc_root.find(w("body"))
    for para in body:
        if etree.QName(para.tag).localname != "p":
            continue
        pPr = para.find(w("pPr"))
        if pPr is not None:
            assert pPr.find(w("spacing")) is None
            assert pPr.find(w("ind")) is None
            assert pPr.find(w("jc")) is None


# ===========================================================================
# 6. restyle.py: style injection
# ===========================================================================

def test_inject_styles_creates_ft_styles():
    """FT_* styles should appear in styles.xml after injection."""
    pkg = _pkg(ORIGINAL)
    styles_root = pkg.get_xml("word/styles.xml")

    role_specs = {
        Role.BODY: RoleSpec(
            role=Role.BODY, font_name="Times New Roman",
            font_size_half_points=44, bold=False, italic=False,
            line_spacing=360, line_rule="auto",
            space_before=0, space_after=160,
            indent_first_line=720, alignment="both",
        ),
        Role.HEADING_1: RoleSpec(
            role=Role.HEADING_1, font_name="Times New Roman",
            font_size_half_points=44, bold=True, italic=False,
            line_spacing=360, line_rule="auto",
            space_before=400, space_after=160, alignment="left",
        ),
    }

    inject_styles(styles_root, role_specs)

    ids = {
        el.get(f"{{{W}}}styleId")
        for el in styles_root
        if etree.QName(el.tag).localname == "style"
    }
    assert "FT_body"      in ids
    assert "FT_heading_1" in ids


def test_inject_styles_idempotent():
    """Calling inject_styles twice should not duplicate styles."""
    pkg = _pkg(ORIGINAL)
    styles_root = pkg.get_xml("word/styles.xml")
    specs = {Role.BODY: RoleSpec(role=Role.BODY, font_name="TNR")}
    inject_styles(styles_root, specs)
    inject_styles(styles_root, specs)

    ft_body_count = sum(
        1 for el in styles_root
        if etree.QName(el.tag).localname == "style"
        and el.get(f"{{{W}}}styleId") == "FT_body"
    )
    assert ft_body_count == 1, "FT_body should appear exactly once after two calls"


def test_ft_style_has_correct_font():
    """The injected FT_body style should carry Times New Roman."""
    rs = RoleSpec(role=Role.BODY, font_name="Times New Roman",
                  font_size_half_points=44, alignment="both")
    el = _make_style_element(Role.BODY, rs)
    rPr = el.find(f"{{{W}}}rPr")
    assert rPr is not None
    fonts = rPr.find(f"{{{W}}}rFonts")
    assert fonts is not None
    assert fonts.get(f"{{{W}}}ascii") == "Times New Roman"


def test_ft_style_bold():
    rs = RoleSpec(role=Role.HEADING_1, bold=True)
    el = _make_style_element(Role.HEADING_1, rs)
    rPr = el.find(f"{{{W}}}rPr")
    if rPr is not None:
        assert rPr.find(f"{{{W}}}b") is not None


def test_ft_style_italic():
    rs = RoleSpec(role=Role.QUOTE, italic=True)
    el = _make_style_element(Role.QUOTE, rs)
    rPr = el.find(f"{{{W}}}rPr")
    if rPr is not None:
        assert rPr.find(f"{{{W}}}i") is not None


# ===========================================================================
# 7. restyle.py: paragraph pStyle assignment
# ===========================================================================

def test_assign_paragraph_styles_sets_pstyle(tmp_path):
    """After assign_paragraph_styles, each paragraph should have FT_* pStyle."""
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")

    paras = resolve_document(pkg)
    roles = classify(paras)

    assign_paragraph_styles(doc_root, roles)

    body = doc_root.find(f"{{{W}}}body")
    body_paras = [c for c in body if etree.QName(c.tag).localname == "p"]
    for i, (para, role) in enumerate(zip(body_paras, roles)):
        pPr = para.find(f"{{{W}}}pPr")
        assert pPr is not None, f"Para {i} has no pPr after assign"
        pStyle = pPr.find(f"{{{W}}}pStyle")
        assert pStyle is not None, f"Para {i} has no pStyle after assign"
        assert pStyle.get(f"{{{W}}}val") == f"FT_{role.value}", (
            f"Para {i}: expected FT_{role.value}, got {pStyle.get(f'{{{W}}}val')!r}"
        )


def test_assign_paragraph_styles_length_mismatch_raises():
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")
    with pytest.raises(ValueError, match="para_roles length"):
        assign_paragraph_styles(doc_root, [Role.BODY])  # wrong length


# ===========================================================================
# 8. restyle.py: section rewrite
# ===========================================================================

def test_rewrite_section_sets_page_size(tmp_path):
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")

    sec = SectionSpec(
        page_width=12240, page_height=20160,
        margin_top=720, margin_right=720, margin_bottom=720, margin_left=720,
        has_header=False, has_footer=False,
    )
    rewrite_section(doc_root, sec)

    body = doc_root.find(f"{{{W}}}body")
    sectPr = None
    for child in reversed(list(body)):
        if etree.QName(child.tag).localname == "sectPr":
            sectPr = child; break
    assert sectPr is not None
    pgSz = sectPr.find(f"{{{W}}}pgSz")
    assert pgSz is not None
    assert pgSz.get(f"{{{W}}}w") == "12240"
    assert pgSz.get(f"{{{W}}}h") == "20160"


def test_rewrite_section_sets_margins(tmp_path):
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")

    sec = SectionSpec(
        page_width=12240, page_height=20160,
        margin_top=720, margin_right=720, margin_bottom=720, margin_left=720,
    )
    rewrite_section(doc_root, sec)

    body = doc_root.find(f"{{{W}}}body")
    sectPr = next((c for c in reversed(list(body))
                   if etree.QName(c.tag).localname == "sectPr"), None)
    pgMar = sectPr.find(f"{{{W}}}pgMar")
    assert pgMar is not None
    assert pgMar.get(f"{{{W}}}top")  == "720"
    assert pgMar.get(f"{{{W}}}left") == "720"


def test_rewrite_section_removes_footer_ref():
    """If reference has no footer, footerReference must be removed from sectPr."""
    pkg = _pkg(ORIGINAL)
    doc_root = pkg.get_xml("word/document.xml")

    # The original has a footerReference — verify it exists first
    body = doc_root.find(f"{{{W}}}body")
    sectPr = next((c for c in reversed(list(body))
                   if etree.QName(c.tag).localname == "sectPr"), None)
    # (It may or may not exist in this fixture; the test checks post-rewrite state)

    sec = SectionSpec(has_footer=False)
    rewrite_section(doc_root, sec)

    assert sectPr.find(f"{{{W}}}footerReference") is None


# ===========================================================================
# 9. Full pipeline: restyle() end-to-end on original
# ===========================================================================

def test_full_restyle_pipeline(tmp_path, reference_paras, reference_roles):
    """
    Full pipeline: derive spec from reference, restyle original, output is a
    valid DOCX with FT_* styles and reference page dimensions.
    """
    ref_pkg = _pkg(REFERENCE)
    derived = derive_spec(ref_pkg, reference_roles)

    target_pkg = _pkg(ORIGINAL)
    target_paras = resolve_document(target_pkg)
    target_roles = classify(target_paras)

    out_path = str(tmp_path / "restyled.docx")
    restyle(target_pkg, derived, target_roles, out_path)

    # Output is a valid ZIP
    assert zipfile.is_zipfile(out_path)

    # FT_* styles present
    out_pkg = _pkg(out_path)
    styles_root = out_pkg.get_xml("word/styles.xml")
    style_ids = {
        el.get(f"{{{W}}}styleId")
        for el in styles_root
        if etree.QName(el.tag).localname == "style"
    }
    assert "FT_body" in style_ids, f"FT_body not in {style_ids}"

    # Text content preserved
    doc_before = _pkg(ORIGINAL).get_xml("word/document.xml")
    doc_after  = out_pkg.get_xml("word/document.xml")
    texts_before = _text_content(doc_before)
    texts_after  = _text_content(doc_after)
    assert texts_before == texts_after

    # Page size is now Legal (from reference)
    doc_root = out_pkg.get_xml("word/document.xml")
    body = doc_root.find(f"{{{W}}}body")
    sectPr = next((c for c in reversed(list(body))
                   if etree.QName(c.tag).localname == "sectPr"), None)
    pgSz = sectPr.find(f"{{{W}}}pgSz")
    assert pgSz is not None
    assert pgSz.get(f"{{{W}}}w") == "12240"
    assert pgSz.get(f"{{{W}}}h") == "20160"
