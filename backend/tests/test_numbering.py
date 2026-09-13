"""
Tests for numbering.py (SPEC.md §13, Step 8).

Key assertions:
  1. transfer_numbering() copies abstractNum + num from reference to target
  2. IDs in target are remapped to avoid collisions
  3. Returns correct ref_numId → target_numId map
  4. remap_paragraph_numids() rewrites numId in list paragraphs
  5. apply_numbering() end-to-end: lists still render in output DOCX
  6. No-numbering reference → no-op, returns empty map
  7. Target-has-no-numbering-xml → part created with rels + content types
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
from backend.app.ooxml.numbering import (
    transfer_numbering,
    remap_paragraph_numids,
    apply_numbering,
    _ensure_numbering_part,
)
from backend.app.ooxml.restyle import restyle
from backend.app.ooxml.spec import derive_spec
from backend.app.classify.fallback import classify
from backend.app.ooxml.resolver import resolve_document
from backend.app.classify.taxonomy import Role

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
ORIGINAL  = os.path.join(FIXTURES, "climate_original.docx")
REFERENCE = os.path.join(FIXTURES, "climate_reference.docx")

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
CT_NS  = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def w(tag): return f"{{{W}}}{tag}"


def _pkg(path: str) -> DocxPackage:
    return DocxPackage.open(path)


# ===========================================================================
# 1. transfer_numbering: basic contract
# ===========================================================================

def test_transfer_returns_nonempty_map():
    """Reference has numId=1; transfer must return a non-empty map."""
    ref_pkg = _pkg(REFERENCE)
    tgt_pkg = _pkg(ORIGINAL)
    num_id_map = transfer_numbering(ref_pkg, tgt_pkg)
    assert num_id_map, "Expected a non-empty numId map"
    assert 1 in num_id_map, "Reference numId=1 should be in map"


def test_transfer_map_values_do_not_collide_with_target():
    """
    New numIds assigned to the reference's lists must not equal any
    existing numId already in the target's numbering.xml.
    """
    ref_pkg = _pkg(REFERENCE)
    tgt_pkg = _pkg(ORIGINAL)

    # Collect existing target numIds before transfer
    tgt_num = tgt_pkg.get_xml("word/numbering.xml")
    existing_ids = {
        int(n.get(w("numId"), "0"))
        for n in tgt_num.findall(w("num"))
    }

    num_id_map = transfer_numbering(ref_pkg, tgt_pkg)

    for new_id in num_id_map.values():
        assert new_id not in existing_ids, (
            f"New numId {new_id} collides with existing target numId"
        )


def test_transfer_abstractnum_copied():
    """The reference's abstractNum should appear in the target's numbering.xml after transfer."""
    ref_pkg = _pkg(REFERENCE)
    tgt_pkg = _pkg(ORIGINAL)

    # Reference has abstractNum 0 with decimal list at lvl 0
    tgt_num_before = set(
        int(an.get(w("abstractNumId"), "-1"))
        for an in tgt_pkg.get_xml("word/numbering.xml").findall(w("abstractNum"))
    )

    transfer_numbering(ref_pkg, tgt_pkg)

    tgt_num_after = tgt_pkg.get_xml("word/numbering.xml")
    abs_ids_after = {
        int(an.get(w("abstractNumId"), "-1"))
        for an in tgt_num_after.findall(w("abstractNum"))
    }
    # At least one new abstractNum was added
    new_abs_ids = abs_ids_after - tgt_num_before
    assert new_abs_ids, "Expected at least one new abstractNum after transfer"


def test_transfer_num_entry_copied():
    """The reference's num entry should appear in the target's numbering.xml after transfer."""
    ref_pkg = _pkg(REFERENCE)
    tgt_pkg = _pkg(ORIGINAL)

    tgt_num_before = set(
        int(n.get(w("numId"), "-1"))
        for n in tgt_pkg.get_xml("word/numbering.xml").findall(w("num"))
    )

    num_id_map = transfer_numbering(ref_pkg, tgt_pkg)

    tgt_num_after = tgt_pkg.get_xml("word/numbering.xml")
    num_ids_after = {
        int(n.get(w("numId"), "-1"))
        for n in tgt_num_after.findall(w("num"))
    }
    new_num_ids = num_ids_after - tgt_num_before
    assert new_num_ids, "Expected at least one new num entry after transfer"
    # The mapped values should be in the new set
    for new_id in num_id_map.values():
        assert new_id in num_ids_after, f"Mapped numId {new_id} not in target"


def test_transfer_internal_abstractnum_ref_updated():
    """
    Each copied w:num must reference the REMAPPED abstractNumId (not the
    original reference ID).
    """
    ref_pkg = _pkg(REFERENCE)
    tgt_pkg = _pkg(ORIGINAL)

    num_id_map = transfer_numbering(ref_pkg, tgt_pkg)

    tgt_num = tgt_pkg.get_xml("word/numbering.xml")
    abs_ids = {
        int(an.get(w("abstractNumId"), "-1"))
        for an in tgt_num.findall(w("abstractNum"))
    }

    for num_el in tgt_num.findall(w("num")):
        ref_el = num_el.find(w("abstractNumId"))
        if ref_el is not None:
            abs_ref = int(ref_el.get(w("val"), "-1"))
            assert abs_ref in abs_ids, (
                f"num element references abstractNumId={abs_ref} which is not in target"
            )


# ===========================================================================
# 2. remap_paragraph_numids
# ===========================================================================

def _doc_with_list_para(num_id: int) -> etree._Element:
    """Build a minimal document root with one list paragraph using num_id."""
    doc = etree.fromstring(f"""
<w:document xmlns:w="{W}">
  <w:body>
    <w:p>
      <w:pPr>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="{num_id}"/>
        </w:numPr>
      </w:pPr>
      <w:r><w:t>Item</w:t></w:r>
    </w:p>
  </w:body>
</w:document>""")
    return doc


def test_remap_changes_numid():
    doc = _doc_with_list_para(1)
    remap_paragraph_numids(doc, {1: 99})
    ni = doc.find(f".//{w('numId')}")
    assert ni.get(w("val")) == "99"


def test_remap_leaves_unmapped_numid_unchanged():
    doc = _doc_with_list_para(5)
    remap_paragraph_numids(doc, {1: 99})  # 5 not in map
    ni = doc.find(f".//{w('numId')}")
    assert ni.get(w("val")) == "5"


def test_remap_empty_map_no_change():
    doc = _doc_with_list_para(1)
    remap_paragraph_numids(doc, {})
    ni = doc.find(f".//{w('numId')}")
    assert ni.get(w("val")) == "1"


def test_remap_multiple_paras():
    doc = etree.fromstring(f"""
<w:document xmlns:w="{W}">
  <w:body>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>A</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>
      <w:r><w:t>B</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>C</w:t></w:r>
    </w:p>
  </w:body>
</w:document>""")
    remap_paragraph_numids(doc, {1: 10, 2: 20})
    ni_els = doc.findall(f".//{w('numId')}")
    vals = [ni.get(w("val")) for ni in ni_els]
    assert "10" in vals
    assert "20" in vals


# ===========================================================================
# 3. apply_numbering end-to-end
# ===========================================================================

def test_apply_numbering_list_paras_remapped(tmp_path):
    """
    After apply_numbering(), list paragraphs in the target must reference
    valid numIds (present in the target's numbering.xml).
    """
    ref_pkg = _pkg(REFERENCE)
    tgt_pkg = _pkg(ORIGINAL)

    apply_numbering(ref_pkg, tgt_pkg)

    tgt_num = tgt_pkg.get_xml("word/numbering.xml")
    valid_num_ids = {
        int(n.get(w("numId"), "-1"))
        for n in tgt_num.findall(w("num"))
    }

    doc_root = tgt_pkg.get_xml("word/document.xml")
    body = doc_root.find(w("body"))
    for para in body:
        if etree.QName(para.tag).localname != "p":
            continue
        pPr = para.find(w("pPr"))
        if pPr is None:
            continue
        numPr = pPr.find(w("numPr"))
        if numPr is None:
            continue
        ni = numPr.find(w("numId"))
        if ni is None:
            continue
        num_id_val = int(ni.get(w("val"), "0"))
        if num_id_val == 0:  # numId=0 means "remove numbering", valid
            continue
        assert num_id_val in valid_num_ids, (
            f"Paragraph references numId={num_id_val} which is not in numbering.xml"
        )


def test_no_reference_numbering_returns_empty_map():
    """If reference has no numbering.xml, transfer returns empty map."""
    # Build a minimal ref pkg without numbering
    import tempfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", """<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>""")
        zf.writestr("_rels/.rels", """<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""")
        zf.writestr("word/document.xml", f"""<?xml version="1.0"?>
<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>""")
        zf.writestr("word/styles.xml", f"""<?xml version="1.0"?>
<w:styles xmlns:w="{W}"><w:docDefaults/></w:styles>""")
        zf.writestr("word/_rels/document.xml.rels", """<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>""")
    buf.seek(0)

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
        f.write(buf.read())
        tmp_path = f.name

    import os
    no_num_pkg = DocxPackage.open(tmp_path)
    os.unlink(tmp_path)

    tgt_pkg = _pkg(ORIGINAL)
    result = transfer_numbering(no_num_pkg, tgt_pkg)
    assert result == {}, "No-numbering reference should return empty map"


# ===========================================================================
# 4. Full pipeline: lists present in output DOCX
# ===========================================================================

def test_full_pipeline_with_numbering(tmp_path, reference_paras, reference_roles):
    """
    Full restyle pipeline (with ref_pkg) must produce a DOCX where:
    - numbering.xml exists and contains the reference's list definitions
    - list paragraphs reference valid numIds
    - text content is preserved
    """
    ref_pkg = _pkg(REFERENCE)
    derived = derive_spec(ref_pkg, reference_roles)

    tgt_pkg = _pkg(ORIGINAL)
    tgt_paras = resolve_document(tgt_pkg)
    tgt_roles = classify(tgt_paras)

    out_path = str(tmp_path / "restyled_with_lists.docx")
    restyle(tgt_pkg, derived, tgt_roles, out_path, ref_pkg=ref_pkg)

    # Output is valid ZIP
    assert zipfile.is_zipfile(out_path)

    out_pkg = DocxPackage.open(out_path)

    # numbering.xml exists
    assert out_pkg.has_part("word/numbering.xml"), "numbering.xml should exist in output"

    # All list paragraph numIds reference valid entries
    num_root = out_pkg.get_xml("word/numbering.xml")
    valid_ids = {
        int(n.get(w("numId"), "-1"))
        for n in num_root.findall(w("num"))
    }
    doc_root = out_pkg.get_xml("word/document.xml")
    body = doc_root.find(w("body"))
    for para in body:
        if etree.QName(para.tag).localname != "p":
            continue
        pPr = para.find(w("pPr"))
        if pPr is None:
            continue
        numPr = pPr.find(w("numPr"))
        if numPr is None:
            continue
        ni = numPr.find(w("numId"))
        if ni is None:
            continue
        num_id_val = int(ni.get(w("val"), "0"))
        if num_id_val == 0:
            continue
        assert num_id_val in valid_ids, (
            f"Output paragraph references numId={num_id_val} not in numbering.xml"
        )

    # Text content preserved
    orig_texts = [t.text or "" for t in _pkg(ORIGINAL).get_xml("word/document.xml").iter(w("t"))]
    out_texts  = [t.text or "" for t in doc_root.iter(w("t"))]
    assert orig_texts == out_texts


# ===========================================================================
# 5. _ensure_numbering_part on target without numbering.xml
# ===========================================================================

def test_ensure_numbering_creates_part():
    """_ensure_numbering_part must create word/numbering.xml when absent."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", f"""<?xml version="1.0"?>
<Types xmlns="{CT_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>""")
        zf.writestr("_rels/.rels", f"""<?xml version="1.0"?>
<Relationships xmlns="{REL_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""")
        zf.writestr("word/document.xml", f"""<?xml version="1.0"?>
<w:document xmlns:w="{W}"><w:body><w:p/></w:body></w:document>""")
        zf.writestr("word/styles.xml", f"""<?xml version="1.0"?>
<w:styles xmlns:w="{W}"><w:docDefaults/></w:styles>""")
        zf.writestr("word/_rels/document.xml.rels", f"""<?xml version="1.0"?>
<Relationships xmlns="{REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""")
    buf.seek(0)

    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
        f.write(buf.read())
        tmp = f.name

    pkg = DocxPackage.open(tmp)
    os.unlink(tmp)

    assert not pkg.has_part("word/numbering.xml")
    _ensure_numbering_part(pkg)
    assert pkg.has_part("word/numbering.xml"), "numbering.xml should be created"

    # Content type override should be present
    ct_root = pkg.get_xml("[Content_Types].xml")
    ct_ns = CT_NS
    overrides = [
        el for el in ct_root
        if etree.QName(el.tag).localname == "Override"
        and el.get("PartName") == "/word/numbering.xml"
    ]
    assert overrides, "Content type Override for numbering.xml should be added"

    # Relationship should be present
    rels_root = pkg.get_xml("word/_rels/document.xml.rels")
    num_rels = [
        el for el in rels_root
        if "numbering" in el.get("Type", "")
    ]
    assert num_rels, "Relationship for numbering.xml should be added"


def test_ensure_numbering_idempotent():
    """Calling _ensure_numbering_part twice should not add duplicate entries."""
    pkg = _pkg(ORIGINAL)  # already has numbering.xml
    _ensure_numbering_part(pkg)
    _ensure_numbering_part(pkg)
    # Should still have exactly one relationship entry for numbering
    rels_root = pkg.get_xml("word/_rels/document.xml.rels")
    num_rels = [
        el for el in rels_root
        if "numbering" in el.get("Type", "")
    ]
    assert len(num_rels) == 1, f"Expected 1 numbering relationship, got {len(num_rels)}"
