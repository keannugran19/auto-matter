"""
Tests for DocxPackage (SPEC.md §13, Step 2).

Success condition (from spec): read a .docx, unzip it, write it back, and get
a byte-identical file.  We test both fixtures.

The byte-identical contract: write_back() with no modifications must produce a
file whose SHA-256 matches the original.  This is achieved by a shutil.copy2()
when the dirty set is empty.
"""
import hashlib
import tempfile
import os
import zipfile

import pytest

# ---- path helpers ----------------------------------------------------------

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
ORIGINAL = os.path.join(FIXTURES, "climate_original.docx")
REFERENCE = os.path.join(FIXTURES, "climate_reference.docx")

# ---- import the module under test ------------------------------------------

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.app.ooxml.package import DocxPackage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sha256_file(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def sha256_content(path: str) -> str:
    """SHA-256 over sorted decompressed content of all zip entries."""
    h = hashlib.sha256()
    with zipfile.ZipFile(path) as zf:
        for name in sorted(zf.namelist()):
            h.update(name.encode())
            h.update(zf.read(name))
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Step 2 core: byte-identical round-trip
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("fixture", [ORIGINAL, REFERENCE])
def test_round_trip_byte_identical(fixture):
    """
    Open a docx, write it back without modifications, assert archive SHA-256
    is identical.  This is the strict success condition from SPEC.md §13 Step 2.
    """
    pkg = DocxPackage.open(fixture)
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        pkg.write_back(tmp_path)
        orig_sha = sha256_file(fixture)
        rt_sha = sha256_file(tmp_path)
        assert orig_sha == rt_sha, (
            f"Round-trip produced a different archive for {os.path.basename(fixture)}\n"
            f"  original : {orig_sha}\n"
            f"  round-trip: {rt_sha}"
        )
    finally:
        os.unlink(tmp_path)


@pytest.mark.parametrize("fixture", [ORIGINAL, REFERENCE])
def test_round_trip_content_identical_after_no_op_parse(fixture):
    """
    If we call get_xml() on a part but make no mutations, the written archive
    should be content-identical (decompressed bytes of all parts match).

    Note: this will NOT be archive-byte-identical because get_xml() marks the
    part dirty and triggers re-serialisation via lxml, which may differ in
    whitespace from the original.  The content (parsed XML) must be equivalent.
    """
    pkg = DocxPackage.open(fixture)
    # "Touch" document.xml without mutating anything
    _ = pkg.get_xml("word/document.xml")

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        pkg.write_back(tmp_path)

        # All non-dirty entries must be byte-identical
        with zipfile.ZipFile(fixture) as orig_zf, zipfile.ZipFile(tmp_path) as rt_zf:
            orig_names = set(orig_zf.namelist())
            rt_names = set(rt_zf.namelist())
            assert orig_names == rt_names, "Entry list changed"

            for name in sorted(orig_names):
                if name != "word/document.xml":
                    orig_bytes = orig_zf.read(name)
                    rt_bytes = rt_zf.read(name)
                    assert orig_bytes == rt_bytes, (
                        f"Unmodified entry {name!r} changed bytes"
                    )

        # document.xml: re-parsed content must have same text
        from lxml import etree
        W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        with zipfile.ZipFile(fixture) as orig_zf:
            orig_tree = etree.fromstring(orig_zf.read("word/document.xml"))
        with zipfile.ZipFile(tmp_path) as rt_zf:
            rt_tree = etree.fromstring(rt_zf.read("word/document.xml"))

        orig_text = "".join(orig_tree.itertext())
        rt_text = "".join(rt_tree.itertext())
        assert orig_text == rt_text, "Text content changed after no-op parse+write"
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Part listing
# ---------------------------------------------------------------------------

def test_list_parts_original():
    pkg = DocxPackage.open(ORIGINAL)
    parts = pkg.parts()
    assert "word/document.xml" in parts
    assert "word/styles.xml" in parts
    assert "word/numbering.xml" in parts
    assert "word/_rels/document.xml.rels" in parts
    assert "[Content_Types].xml" in parts
    assert "word/footer1.xml" in parts  # original has a footer


def test_list_parts_reference():
    pkg = DocxPackage.open(REFERENCE)
    parts = pkg.parts()
    assert "word/document.xml" in parts
    assert "word/styles.xml" in parts
    assert "word/numbering.xml" in parts
    # reference has no footer
    assert "word/footer1.xml" not in parts


def test_has_part():
    pkg = DocxPackage.open(ORIGINAL)
    assert pkg.has_part("word/document.xml")
    assert not pkg.has_part("word/nonexistent.xml")


def test_get_part_missing_raises():
    pkg = DocxPackage.open(ORIGINAL)
    with pytest.raises(KeyError):
        pkg.get_part("word/nonexistent.xml")


# ---------------------------------------------------------------------------
# XML parsing
# ---------------------------------------------------------------------------

def test_get_xml_returns_element():
    from lxml import etree
    pkg = DocxPackage.open(REFERENCE)
    root = pkg.get_xml("word/document.xml")
    assert isinstance(root, etree._Element)
    assert root.tag.endswith("}document") or root.tag == "document"


def test_get_xml_cached():
    pkg = DocxPackage.open(REFERENCE)
    a = pkg.get_xml("word/styles.xml")
    b = pkg.get_xml("word/styles.xml")
    assert a is b, "get_xml() should return the same object on repeated calls"


# ---------------------------------------------------------------------------
# Content fingerprint
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("fixture", [ORIGINAL, REFERENCE])
def test_content_fingerprint_stable(fixture):
    """content_fingerprint() must be the same across two independent loads."""
    pkg1 = DocxPackage.open(fixture)
    pkg2 = DocxPackage.open(fixture)
    assert pkg1.content_fingerprint() == pkg2.content_fingerprint()


# ---------------------------------------------------------------------------
# Media and relationship preservation (SPEC.md §12 assertion)
# ---------------------------------------------------------------------------

def test_original_hyperlink_rels_preserved():
    """After a no-op round-trip the hyperlink relationships must still be present."""
    pkg = DocxPackage.open(ORIGINAL)
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        pkg.write_back(tmp_path)
        rels = pkg.get_part("word/_rels/document.xml.rels").decode()
        # Re-open the written file and check same rels content
        with zipfile.ZipFile(tmp_path) as rt_zf:
            rt_rels = rt_zf.read("word/_rels/document.xml.rels").decode()
        assert rels == rt_rels, "document.xml.rels changed during round-trip"
    finally:
        os.unlink(tmp_path)
