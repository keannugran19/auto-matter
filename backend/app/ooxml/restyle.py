"""
restyle.py — STAGE 5: Orchestrate the in-place patch.

SPEC.md §8: Operate on the unzipped original. Touch only what you must.

The patch pipeline:
  1. Sanitise    (§8a) — strip target's presentation formatting
  2. Inject FT_* styles into styles.xml  (§8c)
  3. Point each paragraph's pStyle at the appropriate FT_* style (§8c)
  4. Rewrite sectPr  (§8d) — page size, margins, header/footer
  5. (§8e — lists handled by numbering.py, called separately)

Style injection strategy (§8c):
  Inject one named style per role, prefixed "FT_" (e.g. FT_body, FT_heading_1).
  This avoids colliding with existing styles and keeps the document editable
  afterwards — the user can tweak "FT_heading_1" in Word normally.

No-op mode:
  With an empty DerivedSpec or no target_roles mapping, restyle() just runs
  sanitise + writes back.  This is the step-7 "no-op patch round-trip" test:
  the output is a valid DOCX whose content is unchanged.
"""
from __future__ import annotations

import copy
import dataclasses
from typing import Optional

from lxml import etree

from .constants import NS_W, PPR_ORDER_INDEX, RPR_ORDER_INDEX
from .package import DocxPackage
from .sanitize import sanitise_document, _insert_ordered_ppr, _insert_ordered_rpr
from .spec import DerivedSpec, RoleSpec, SectionSpec
from .numbering import apply_numbering
from ..classify.taxonomy import Role


W = NS_W

# Style ID prefix (§8c: namespace injected style IDs to avoid collisions)
_FT_PREFIX = "FT_"


def _w(local: str) -> str:
    return f"{{{W}}}{local}"


# ---------------------------------------------------------------------------
# Style injection (§8c)
# ---------------------------------------------------------------------------

def _ft_style_id(role: Role) -> str:
    return f"{_FT_PREFIX}{role.value}"


def _make_style_element(role: Role, rs: RoleSpec) -> etree._Element:
    """
    Build a w:style element for the given role spec.
    """
    style = etree.Element(_w("style"), nsmap={"w": W})
    style.set(_w("type"), "paragraph")
    style.set(_w("styleId"), _ft_style_id(role))

    name = etree.SubElement(style, _w("name"))
    name.set(_w("val"), f"FT {role.value.replace('_', ' ')}")

    # Base on Normal so it inherits document defaults
    basedOn = etree.SubElement(style, _w("basedOn"))
    basedOn.set(_w("val"), "Normal")

    # pPr
    pPr = etree.SubElement(style, _w("pPr"))

    if rs.line_spacing is not None or rs.space_before is not None or rs.space_after is not None:
        sp = etree.SubElement(pPr, _w("spacing"))
        if rs.space_before is not None:
            sp.set(_w("before"), str(rs.space_before))
        if rs.space_after is not None:
            sp.set(_w("after"), str(rs.space_after))
        if rs.line_spacing is not None:
            sp.set(_w("line"), str(rs.line_spacing))
        if rs.line_rule is not None:
            sp.set(_w("lineRule"), rs.line_rule)

    # Indentation
    has_ind = any([
        rs.indent_left, rs.indent_right,
        rs.indent_first_line, rs.indent_hanging,
    ])
    if has_ind:
        ind = etree.SubElement(pPr, _w("ind"))
        if rs.indent_left       is not None: ind.set(_w("left"),      str(rs.indent_left))
        if rs.indent_right      is not None: ind.set(_w("right"),     str(rs.indent_right))
        if rs.indent_first_line is not None: ind.set(_w("firstLine"), str(rs.indent_first_line))
        if rs.indent_hanging    is not None: ind.set(_w("hanging"),   str(rs.indent_hanging))

    if rs.alignment is not None:
        jc = etree.SubElement(pPr, _w("jc"))
        jc.set(_w("val"), rs.alignment)

    # rPr
    rPr = etree.SubElement(style, _w("rPr"))

    if rs.font_name:
        fonts = etree.SubElement(rPr, _w("rFonts"))
        fonts.set(_w("ascii"),  rs.font_name)
        fonts.set(_w("hAnsi"), rs.font_name)
        fonts.set(_w("cs"),    rs.font_name)

    if rs.bold:
        etree.SubElement(rPr, _w("b"))
        etree.SubElement(rPr, _w("bCs"))

    if rs.italic:
        etree.SubElement(rPr, _w("i"))
        etree.SubElement(rPr, _w("iCs"))

    if rs.font_size_half_points is not None:
        sz = etree.SubElement(rPr, _w("sz"))
        sz.set(_w("val"), str(rs.font_size_half_points))
        szCs = etree.SubElement(rPr, _w("szCs"))
        szCs.set(_w("val"), str(rs.font_size_half_points))

    # Clean up empty pPr / rPr
    if len(pPr) == 0:
        style.remove(pPr)
    if len(rPr) == 0:
        style.remove(rPr)

    return style


def inject_styles(
    styles_root: etree._Element,
    role_specs: dict[Role, RoleSpec],
) -> None:
    """
    Inject FT_* styles into the styles.xml root element.
    Overwrites any existing FT_* styles with the same ID.
    """
    # Remove existing FT_ styles to avoid duplicates on repeated calls
    to_remove = [
        el for el in styles_root
        if etree.QName(el.tag).localname == "style"
        and el.get(_w("styleId"), "").startswith(_FT_PREFIX)
    ]
    for el in to_remove:
        styles_root.remove(el)

    for role, rs in role_specs.items():
        style_el = _make_style_element(role, rs)
        styles_root.append(style_el)


# ---------------------------------------------------------------------------
# Paragraph pStyle assignment (§8c)
# ---------------------------------------------------------------------------

def _assign_pstyle(pPr: etree._Element, style_id: str) -> None:
    """Set or replace w:pStyle on a pPr element."""
    existing = pPr.find(_w("pStyle"))
    if existing is not None:
        existing.set(_w("val"), style_id)
    else:
        new_el = etree.Element(_w("pStyle"))
        new_el.set(_w("val"), style_id)
        _insert_ordered_ppr(pPr, new_el)


def assign_paragraph_styles(
    doc_root: etree._Element,
    para_roles: list[Role],
) -> None:
    """
    Point each body paragraph's pStyle at the appropriate FT_* style.

    para_roles must have the same length and order as the body-level paragraphs
    in the document (i.e., excluding table paragraphs).
    """
    body = doc_root.find(_w("body"))
    if body is None:
        return

    body_paras = [child for child in body
                  if etree.QName(child.tag).localname == "p"]

    if len(body_paras) != len(para_roles):
        raise ValueError(
            f"para_roles length ({len(para_roles)}) != "
            f"body paragraph count ({len(body_paras)})"
        )

    for para, role in zip(body_paras, para_roles):
        pPr = para.find(_w("pPr"))
        if pPr is None:
            pPr = etree.Element(_w("pPr"))
            para.insert(0, pPr)
        _assign_pstyle(pPr, _ft_style_id(role))


# ---------------------------------------------------------------------------
# Section properties (§8d)
# ---------------------------------------------------------------------------

def rewrite_section(
    doc_root: etree._Element,
    section: SectionSpec,
) -> None:
    """
    Rewrite w:sectPr in the document body to match the reference section spec.

    - Replaces w:pgSz and w:pgMar.
    - Removes w:headerReference and w:footerReference if the reference has none.
    """
    body = doc_root.find(_w("body"))
    if body is None:
        return

    # Remove any intermediate sectPr inside body paragraphs to prevent unwanted section breaks
    for p in body.findall(_w("p")):
        pPr = p.find(_w("pPr"))
        if pPr is not None:
            for s in pPr.findall(_w("sectPr")):
                pPr.remove(s)

    sectPr = None
    for child in reversed(list(body)):
        if etree.QName(child.tag).localname == "sectPr":
            sectPr = child
            break

    if sectPr is None:
        sectPr = etree.SubElement(body, _w("sectPr"))


    # Remove header/footer references if reference has none (§8d)
    if not section.has_header:
        for el in sectPr.findall(_w("headerReference")):
            sectPr.remove(el)
    if not section.has_footer:
        for el in sectPr.findall(_w("footerReference")):
            sectPr.remove(el)

    # Remove and replace pgSz
    for el in sectPr.findall(_w("pgSz")):
        sectPr.remove(el)
    if section.page_width is not None and section.page_height is not None:
        pgSz = etree.SubElement(sectPr, _w("pgSz"))
        pgSz.set(_w("w"), str(section.page_width))
        pgSz.set(_w("h"), str(section.page_height))

    # Remove and replace pgMar
    for el in sectPr.findall(_w("pgMar")):
        sectPr.remove(el)
    pgMar = etree.SubElement(sectPr, _w("pgMar"))
    if section.margin_top    is not None: pgMar.set(_w("top"),    str(section.margin_top))
    if section.margin_right  is not None: pgMar.set(_w("right"),  str(section.margin_right))
    if section.margin_bottom is not None: pgMar.set(_w("bottom"), str(section.margin_bottom))
    if section.margin_left   is not None: pgMar.set(_w("left"),   str(section.margin_left))


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def restyle(
    target_pkg: DocxPackage,
    derived: Optional[DerivedSpec],
    target_roles: Optional[list[Role]],
    output_path: str,
    ref_pkg: Optional[DocxPackage] = None,
) -> None:
    """
    Apply the derived spec to the target document and write the result.

    Parameters
    ----------
    target_pkg:
        The target DocxPackage (source to be restyled).
    derived:
        The DerivedSpec from spec.derive_spec().  Pass None or an empty spec
        for the no-op round-trip test (step 7a): sanitise only.
    target_roles:
        One Role per body paragraph in target_pkg.  Must align with
        resolve_document(target_pkg) paragraph order.
        Pass None for the no-op test.
    output_path:
        Destination path for the restyled DOCX.
    ref_pkg:
        Optional reference DocxPackage.  When provided, list definitions are
        transferred from the reference to the target (§8e).
    """
    doc_root    = target_pkg.get_xml("word/document.xml")
    styles_root = target_pkg.get_xml("word/styles.xml")

    # --- Stage 5a: Sanitise ---
    sanitise_document(doc_root)

    if derived is not None and target_roles is not None:
        # --- Stage 5c: Inject FT_* styles ---
        inject_styles(styles_root, derived.roles)

        # --- Stage 5c: Assign paragraph styles ---
        assign_paragraph_styles(doc_root, target_roles)

        # --- Stage 5d: Rewrite section properties ---
        rewrite_section(doc_root, derived.section)

        # --- Stage 5e: Transfer numbering definitions ---
        if ref_pkg is not None:
            apply_numbering(ref_pkg, target_pkg)

    target_pkg.write_back(output_path)
