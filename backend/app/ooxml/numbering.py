"""
numbering.py — STAGE 5e: Transfer list definitions from reference to target.

SPEC.md §8e: "The messiest part. Numbering definitions live in numbering.xml
with document-scoped IDs, so the reference's numId is meaningless in the target.
You must copy the w:abstractNum and w:num definitions across and remap IDs to
avoid collisions."

Algorithm
---------
1. Parse reference numbering.xml → collect all abstractNum and num definitions.
2. Find the highest existing abstractNumId / numId in the target (to avoid
   collisions).
3. Copy each reference abstractNum with a new abstractNumId = max_target + offset.
4. Copy each reference num with a new numId = max_target_num + offset, updating
   the abstractNumId reference to the remapped ID.
5. Return a dict mapping reference numId → target numId (the remap table).
6. Walk every list paragraph in the target document and rewrite numId to the
   remapped value.

If the target has no numbering.xml:
  Create the part, add its relationship to word/_rels/document.xml.rels,
  and add its Override to [Content_Types].xml.

Edge cases handled:
  - Target has numbering.xml with 0 entries (empty root).
  - Reference has multiple abstractNums (copy all).
  - abstractNum uses w:numStyleLink or w:styleLink references: preserved as-is
    (they are internal to the abstract definition, not cross-document IDs).
"""
from __future__ import annotations

import copy
from typing import Optional

from lxml import etree

from .constants import NS_W
from .package import DocxPackage


W    = NS_W
CT_NUMBERING = (
    "application/vnd.openxmlformats-officedocument"
    ".wordprocessingml.numbering+xml"
)
REL_NUMBERING = (
    "http://schemas.openxmlformats.org/officeDocument/2006"
    "/relationships/numbering"
)
CT_NS  = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def _w(local: str) -> str:
    return f"{{{W}}}{local}"


def _int_attr(el: etree._Element, local: str, default: int = 0) -> int:
    v = el.get(_w(local))
    if v is None:
        return default
    try:
        return int(v)
    except ValueError:
        return default


# ---------------------------------------------------------------------------
# Ensure target has numbering.xml (create if absent)
# ---------------------------------------------------------------------------

def _ensure_numbering_part(target_pkg: DocxPackage) -> None:
    """
    If the target has no word/numbering.xml, create it (empty root), add its
    relationship to word/_rels/document.xml.rels, and add its Override to
    [Content_Types].xml.
    SPEC.md §8e: "If the target has no numbering.xml at all, create the part
    AND add its relationship AND its [Content_Types].xml override."
    """
    if target_pkg.has_part("word/numbering.xml"):
        return

    # Create empty numbering root
    num_root = etree.Element(_w("numbering"), nsmap={"w": W})
    target_pkg.set_xml("word/numbering.xml", num_root)

    # Add Content_Types Override
    ct_root = target_pkg.get_xml("[Content_Types].xml")
    # Check it doesn't already exist
    ct_ns = CT_NS
    existing = [
        el for el in ct_root
        if etree.QName(el.tag).localname == "Override"
        and el.get("PartName") == "/word/numbering.xml"
    ]
    if not existing:
        override = etree.SubElement(
            ct_root,
            f"{{{ct_ns}}}Override",
        )
        override.set("PartName", "/word/numbering.xml")
        override.set("ContentType", CT_NUMBERING)

    # Add relationship in word/_rels/document.xml.rels
    rels_root = target_pkg.get_xml("word/_rels/document.xml.rels")
    # Find next available rId
    existing_ids = set()
    for rel in rels_root:
        rid = rel.get("Id", "")
        if rid.startswith("rId"):
            try:
                existing_ids.add(int(rid[3:]))
            except ValueError:
                pass
    next_id = max(existing_ids, default=0) + 1
    rel_el = etree.SubElement(
        rels_root,
        f"{{{REL_NS}}}Relationship",
    )
    rel_el.set("Id", f"rId{next_id}")
    rel_el.set("Type", REL_NUMBERING)
    rel_el.set("Target", "numbering.xml")


# ---------------------------------------------------------------------------
# Main transfer function
# ---------------------------------------------------------------------------

def transfer_numbering(
    ref_pkg: DocxPackage,
    target_pkg: DocxPackage,
) -> dict[int, int]:
    """
    Copy list definitions from reference into target, remapping IDs to avoid
    collisions.

    Returns
    -------
    dict[int, int]
        Maps reference numId → new target numId.
        Target list paragraphs must be rewritten using this map.
        Call ``remap_paragraph_numids()`` afterwards.
    """
    if not ref_pkg.has_part("word/numbering.xml"):
        return {}  # Reference has no lists; nothing to transfer.

    _ensure_numbering_part(target_pkg)

    ref_num  = ref_pkg.get_xml("word/numbering.xml")
    tgt_num  = target_pkg.get_xml("word/numbering.xml")

    # --- Find max existing abstractNumId and numId in target ---
    max_abs_id = 0
    for an in tgt_num.findall(_w("abstractNum")):
        max_abs_id = max(max_abs_id, _int_attr(an, "abstractNumId"))

    max_num_id = 0
    for n in tgt_num.findall(_w("num")):
        max_num_id = max(max_num_id, _int_attr(n, "numId"))

    # --- Copy abstractNums from reference, remapping IDs ---
    abs_id_map: dict[int, int] = {}  # ref abstractNumId → new target id

    for ref_an in ref_num.findall(_w("abstractNum")):
        ref_abs_id = _int_attr(ref_an, "abstractNumId")
        new_abs_id = max_abs_id + 1 + ref_abs_id  # guaranteed > max_abs_id
        abs_id_map[ref_abs_id] = new_abs_id

        new_an = copy.deepcopy(ref_an)
        new_an.set(_w("abstractNumId"), str(new_abs_id))
        tgt_num.append(new_an)

    # --- Copy nums from reference, remapping IDs and abstractNumId refs ---
    num_id_map: dict[int, int] = {}  # ref numId → new target numId

    for ref_num_el in ref_num.findall(_w("num")):
        ref_num_id = _int_attr(ref_num_el, "numId")
        new_num_id = max_num_id + 1 + ref_num_id

        new_num_el = copy.deepcopy(ref_num_el)
        new_num_el.set(_w("numId"), str(new_num_id))

        # Update the abstractNumId reference inside this num element
        ref_abs_ref = new_num_el.find(_w("abstractNumId"))
        if ref_abs_ref is not None:
            old_abs = int(ref_abs_ref.get(_w("val"), "0"))
            ref_abs_ref.set(_w("val"), str(abs_id_map.get(old_abs, old_abs)))

        tgt_num.append(new_num_el)
        num_id_map[ref_num_id] = new_num_id

    return num_id_map


# ---------------------------------------------------------------------------
# Remap numId references in target paragraphs
# ---------------------------------------------------------------------------

def remap_paragraph_numids(
    doc_root: etree._Element,
    num_id_map: dict[int, int],
) -> None:
    """
    Walk every body paragraph that has a w:numPr and rewrite its numId from
    the target's original numId to the transferred reference numId.

    This is called AFTER transfer_numbering() to point list paragraphs at the
    reference's list definitions.

    Note: We replace the target's numIds with the reference's numIds because
    the goal is for the target's lists to look like the reference's lists.
    If a target numId has no entry in num_id_map, it is left unchanged
    (the target has a list style not present in the reference).
    """
    if not num_id_map:
        return

    body = doc_root.find(_w("body"))
    if body is None:
        return

    for child in body:
        if etree.QName(child.tag).localname != "p":
            continue
        pPr = child.find(_w("pPr"))
        if pPr is None:
            continue
        numPr = pPr.find(_w("numPr"))
        if numPr is None:
            continue
        ni = numPr.find(_w("numId"))
        if ni is None:
            continue
        val_str = ni.get(_w("val"), "")
        try:
            old_id = int(val_str)
        except ValueError:
            continue
        if old_id in num_id_map:
            ni.set(_w("val"), str(num_id_map[old_id]))


# ---------------------------------------------------------------------------
# Integration point for restyle.py
# ---------------------------------------------------------------------------

def apply_numbering(
    ref_pkg: DocxPackage,
    target_pkg: DocxPackage,
) -> dict[int, int]:
    """
    Transfer reference numbering definitions to target and remap paragraph
    numId references.

    Returns the numId remap table (ref numId → target numId) for the caller's
    use in reporting or further patching.

    This is the single call site in restyle.restyle().
    """
    num_id_map = transfer_numbering(ref_pkg, target_pkg)
    if num_id_map:
        doc_root = target_pkg.get_xml("word/document.xml")
        remap_paragraph_numids(doc_root, num_id_map)
    return num_id_map
