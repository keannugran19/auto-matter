"""
DocxPackage — read/write wrapper around a DOCX (ZIP) file.

Round-trip contract
-------------------
When no parts have been modified (no set_xml() calls), write_back() produces a
byte-identical copy of the source archive.  This is implemented by a verbatim
file copy when the dirty set is empty.

When parts have been modified, write_back() rebuilds the archive: unmodified
entries are written with their original compress_type and decompressed bytes
(content-identical, though the DEFLATE stream may differ in raw bytes due to
different compressor state); modified entries are serialised from their lxml
trees.

Design notes
------------
- Use lxml for XML work, not python-docx.
- Never call get_xml() on a part you don't intend to modify; it creates a tree
  in memory unnecessarily.
- The ZipInfo entry order is preserved to minimise diffs.
"""
from __future__ import annotations

import hashlib
import io
import shutil
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

from .constants import NSMAP


# ---------------------------------------------------------------------------
# Serialisation helper
# ---------------------------------------------------------------------------

def _serialise(root: etree._Element) -> bytes:
    """Serialise an lxml element to UTF-8 bytes with XML declaration."""
    return etree.tostring(
        root,
        xml_declaration=True,
        encoding="UTF-8",
        standalone=True,
    )


# ---------------------------------------------------------------------------
# DocxPackage
# ---------------------------------------------------------------------------

class DocxPackage:
    """
    Wraps a .docx ZIP, providing access to OPC parts as bytes or lxml trees.

    Workflow
    --------
    pkg = DocxPackage.open(path)          # load
    tree = pkg.get_xml("word/document.xml")  # parse on demand
    # ... mutate tree in place ...
    pkg.write_back("/tmp/output.docx")    # write
    """

    def __init__(self, source_path: str | Path) -> None:
        self._source = Path(source_path)
        # Decompressed bytes for every entry, keyed by filename.
        self._raw: dict[str, bytes] = {}
        # Cached lxml trees for parsed entries.
        self._trees: dict[str, etree._Element] = {}
        # ZipInfo objects in original directory order.
        self._infos: list[zipfile.ZipInfo] = []
        # Names of entries that have been parsed (and possibly mutated).
        self._dirty: set[str] = set()

        self._load()

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    @classmethod
    def open(cls, path: str | Path) -> "DocxPackage":
        """Open an existing .docx file."""
        return cls(path)

    def _load(self) -> None:
        with zipfile.ZipFile(self._source, "r") as zf:
            self._infos = list(zf.infolist())
            for info in self._infos:
                self._raw[info.filename] = zf.read(info.filename)

    # ------------------------------------------------------------------
    # Part access
    # ------------------------------------------------------------------

    def parts(self) -> list[str]:
        """Return all ZIP entry names in their original directory order."""
        return [info.filename for info in self._infos]

    def has_part(self, name: str) -> bool:
        return name in self._raw

    def get_part(self, name: str) -> bytes:
        """Return decompressed bytes for an entry.  KeyError if absent."""
        if name not in self._raw:
            raise KeyError(f"Part not found: {name!r}")
        return self._raw[name]

    def get_xml(self, name: str) -> etree._Element:
        """
        Return a cached, mutable lxml tree for an XML part.

        Calling this marks the entry dirty; any subsequent write_back() will
        re-serialise the (possibly mutated) tree for this entry.
        """
        if name not in self._trees:
            raw = self.get_part(name)
            self._trees[name] = etree.fromstring(raw)
        self._dirty.add(name)
        return self._trees[name]

    def set_xml(self, name: str, root: etree._Element) -> None:
        """
        Register a tree (new or replacement) for an entry.

        For new parts (not in the original archive), also registers a ZipInfo
        so write_back() includes it.
        """
        self._trees[name] = root
        self._dirty.add(name)
        if name not in self._raw:
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            self._infos.append(info)
            self._raw[name] = b""

    def _info_for(self, name: str) -> zipfile.ZipInfo:
        for info in self._infos:
            if info.filename == name:
                return info
        raise KeyError(name)

    # ------------------------------------------------------------------
    # Write-back
    # ------------------------------------------------------------------

    def write_back(self, dest: str | Path) -> None:
        """
        Write the package to *dest*.

        If no entries are dirty, performs a byte-identical file copy.
        Otherwise rebuilds the archive, preserving content of unmodified
        entries.
        """
        dest = Path(dest)

        if not self._dirty:
            # Unmodified: verbatim copy → byte-identical.
            shutil.copy2(self._source, dest)
            return

        # Rebuild with modifications.
        with zipfile.ZipFile(dest, "w", allowZip64=True) as dst_zf:
            for info in self._infos:
                name = info.filename
                if name in self._dirty:
                    # Serialise the (mutated) lxml tree.
                    data = _serialise(self._trees[name])
                else:
                    # Use original decompressed bytes.
                    data = self._raw[name]

                out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
                out.compress_type = info.compress_type
                dst_zf.writestr(out, data)

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def sha256(self, name: str) -> str:
        """SHA-256 of the decompressed bytes of an entry."""
        return hashlib.sha256(self.get_part(name)).hexdigest()

    def content_fingerprint(self) -> str:
        """
        SHA-256 over the sorted, concatenated decompressed content of all entries.

        This is invariant to DEFLATE re-compression and entry ordering;
        use it to verify content identity across round-trips that modify
        the archive structure.
        """
        h = hashlib.sha256()
        for name in sorted(self._raw):
            h.update(name.encode())
            h.update(self._raw[name])
        return h.hexdigest()
