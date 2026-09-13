"""
resolver.py — STAGE 1: Compute effective formatting for every paragraph.

SPEC.md §3: "This is the highest-risk component."

Layering order (increasing precedence — later layers override earlier ones):
  1. docDefaults   (w:rPrDefault, w:pPrDefault in styles.xml)
  2. Style chain   (walk w:basedOn to root, then apply root→leaf; cycle-guarded)
  3. Numbering lvl (w:numPr → numbering.xml → w:abstractNum → w:lvl)
                   - w:lvl/w:pPr  applies to the paragraph's pPr
                   - w:lvl/w:rPr  applies to the list-label glyph ONLY, not body text
                     (ECMA-376 §17.9.6 — "formatting of the numbering symbol itself")
  4. Direct pPr    (w:p/w:pPr — overrides everything above for pPr properties)
  5. Run char style  (w:r/w:rPr/w:rStyle — character style chain)
  6. Direct rPr    (w:r/w:rPr — highest precedence)

Attribute-name duality:
  LibreOffice uses w:start/w:end for indent (OOXML Transitional).
  Word uses w:left/w:right.  We normalise both to indent_left / indent_right.

Units: stored as-is (twips for spacing/indent, half-points for size).
"""
from __future__ import annotations

import dataclasses
from typing import Optional

from lxml import etree

from .constants import NS_W
from .package import DocxPackage


W = NS_W


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclasses.dataclass
class RunRecord:
    text: str
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strike: bool = False
    vert_align: Optional[str] = None   # "superscript" | "subscript" | None


@dataclasses.dataclass
class ResolvedParagraph:
    # --- identity ---
    index: int
    style_id: Optional[str] = None
    outline_level: Optional[int] = None

    # --- list / numbering ---
    is_list: bool = False
    list_level: Optional[int] = None    # 0-based ilvl
    num_id: Optional[int] = None

    # --- run formatting (paragraph-level effective values) ---
    font_name: Optional[str] = None
    font_size_half_points: Optional[int] = None

    # --- paragraph spacing ---
    line_spacing: Optional[int] = None
    line_rule: Optional[str] = None     # "auto" | "exact" | "atLeast"
    space_before: Optional[int] = None
    space_after: Optional[int] = None

    # --- indentation (twips) ---
    indent_left: Optional[int] = None
    indent_right: Optional[int] = None
    indent_first_line: Optional[int] = None
    indent_hanging: Optional[int] = None

    # --- alignment ---
    alignment: Optional[str] = None

    # --- runs ---
    runs: list[RunRecord] = dataclasses.field(default_factory=list)


# ---------------------------------------------------------------------------
# Internal property dicts
# We collect effective formatting in plain dicts then build the dataclass.
# ---------------------------------------------------------------------------

def _empty_ppr() -> dict:
    return {
        "indent_left": None,
        "indent_right": None,
        "indent_first_line": None,
        "indent_hanging": None,
        "line_spacing": None,
        "line_rule": None,
        "space_before": None,
        "space_after": None,
        "alignment": None,
        "outline_level": None,
    }


def _empty_rpr() -> dict:
    return {
        "font_name": None,
        "font_size_half_points": None,
        "bold": False,
        "italic": False,
        "underline": False,
        "strike": False,
        "vert_align": None,
    }


# ---------------------------------------------------------------------------
# Attribute helpers
# ---------------------------------------------------------------------------

def _w(local: str) -> str:
    return f"{{{W}}}{local}"


def _get(el: Optional[etree._Element], local: str) -> Optional[str]:
    """Get a w:-namespaced attribute from an element."""
    if el is None:
        return None
    return el.get(_w(local))


def _int(val: Optional[str]) -> Optional[int]:
    """Parse an integer attribute value, returning None on failure."""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _bool_elem(el: Optional[etree._Element]) -> bool:
    """
    A w:b, w:i, etc. element is True if:
      - it exists and has no w:val attribute, OR
      - its w:val attribute is "true", "1", or "on"
    It is False if w:val is "false", "0", or "off".
    """
    if el is None:
        return False
    val = el.get(_w("val"))
    if val is None:
        return True
    return val.lower() not in ("false", "0", "off")


# ---------------------------------------------------------------------------
# Parse a w:ind element into the property dict
# Handles both w:start/w:end (Transitional) and w:left/w:right (Strict).
# ---------------------------------------------------------------------------

def _apply_ind(props: dict, ind: Optional[etree._Element]) -> None:
    if ind is None:
        return
    # left / start
    left = _int(_get(ind, "left") or _get(ind, "start"))
    if left is not None:
        props["indent_left"] = left

    # right / end
    right = _int(_get(ind, "right") or _get(ind, "end"))
    if right is not None:
        props["indent_right"] = right

    # firstLine
    fl = _int(_get(ind, "firstLine"))
    if fl is not None:
        props["indent_first_line"] = fl
        props["indent_hanging"] = None  # firstLine and hanging are mutually exclusive

    # hanging
    hang = _int(_get(ind, "hanging"))
    if hang is not None:
        props["indent_hanging"] = hang
        props["indent_first_line"] = None


# ---------------------------------------------------------------------------
# Apply a w:spacing element
# ---------------------------------------------------------------------------

def _apply_spacing(props: dict, sp: Optional[etree._Element]) -> None:
    if sp is None:
        return
    before = _int(_get(sp, "before"))
    if before is not None:
        props["space_before"] = before

    after = _int(_get(sp, "after"))
    if after is not None:
        props["space_after"] = after

    line = _int(_get(sp, "line"))
    if line is not None:
        props["line_spacing"] = line

    rule = _get(sp, "lineRule")
    if rule is not None:
        props["line_rule"] = rule


# ---------------------------------------------------------------------------
# Apply a w:pPr element
# ---------------------------------------------------------------------------

def _apply_ppr(props: dict, ppr: Optional[etree._Element]) -> None:
    if ppr is None:
        return
    _apply_spacing(props, ppr.find(_w("spacing")))
    _apply_ind(props, ppr.find(_w("ind")))

    jc = ppr.find(_w("jc"))
    if jc is not None:
        props["alignment"] = _get(jc, "val")

    outlineLvl = ppr.find(_w("outlineLvl"))
    if outlineLvl is not None:
        lvl = _int(_get(outlineLvl, "val"))
        if lvl is not None:
            props["outline_level"] = lvl


# ---------------------------------------------------------------------------
# Apply a w:rPr element (paragraph-level effective run props)
# ---------------------------------------------------------------------------

def _apply_rpr(props: dict, rpr: Optional[etree._Element]) -> None:
    if rpr is None:
        return

    fonts = rpr.find(_w("rFonts"))
    if fonts is not None:
        # Prefer ascii; fall back to hAnsi, then cs.
        font = fonts.get(_w("ascii")) or fonts.get(_w("hAnsi")) or fonts.get(_w("cs"))
        if font:
            props["font_name"] = font

    sz = rpr.find(_w("sz"))
    if sz is not None:
        v = _int(_get(sz, "val"))
        if v is not None:
            props["font_size_half_points"] = v

    b = rpr.find(_w("b"))
    if b is not None:
        props["bold"] = _bool_elem(b)

    i = rpr.find(_w("i"))
    if i is not None:
        props["italic"] = _bool_elem(i)

    u = rpr.find(_w("u"))
    if u is not None:
        val = _get(u, "val")
        props["underline"] = val is not None and val != "none"

    strike = rpr.find(_w("strike"))
    if strike is not None:
        props["strike"] = _bool_elem(strike)

    dstrike = rpr.find(_w("dstrike"))
    if dstrike is not None and _bool_elem(dstrike):
        props["strike"] = True

    va = rpr.find(_w("vertAlign"))
    if va is not None:
        props["vert_align"] = _get(va, "val")


# ---------------------------------------------------------------------------
# Style cache
# ---------------------------------------------------------------------------

class _StyleCache:
    """Parsed representation of styles.xml for fast lookup."""

    def __init__(self, styles_root: etree._Element) -> None:
        # Map styleId -> style element
        self._styles: dict[str, etree._Element] = {}
        # docDefaults
        self._rpr_default: dict = _empty_rpr()
        self._ppr_default: dict = _empty_ppr()

        for el in styles_root:
            tag = etree.QName(el.tag).localname
            if tag == "style":
                sid = el.get(_w("styleId"))
                if sid:
                    self._styles[sid] = el
            elif tag == "docDefaults":
                self._parse_doc_defaults(el)

    def _parse_doc_defaults(self, docDefaults: etree._Element) -> None:
        rPrDef = docDefaults.find(_w("rPrDefault"))
        if rPrDef is not None:
            _apply_rpr(self._rpr_default, rPrDef.find(_w("rPr")))

        pPrDef = docDefaults.find(_w("pPrDefault"))
        if pPrDef is not None:
            _apply_ppr(self._ppr_default, pPrDef.find(_w("pPr")))

    def resolve_style_chain(
        self, style_id: Optional[str]
    ) -> tuple[dict, dict]:
        """
        Walk the basedOn chain, root-to-leaf, accumulating pPr and rPr props.
        Returns (ppr_props, rpr_props).
        Guards against cycles with a seen set.
        """
        ppr = dict(self._ppr_default)
        rpr = dict(self._rpr_default)

        if style_id is None:
            return ppr, rpr

        # Build chain from requested style to root
        chain: list[etree._Element] = []
        seen: set[str] = set()
        sid: Optional[str] = style_id

        while sid and sid not in seen:
            seen.add(sid)
            el = self._styles.get(sid)
            if el is None:
                break
            chain.append(el)
            basedOn = el.find(_w("basedOn"))
            sid = basedOn.get(_w("val")) if basedOn is not None else None

        # Apply root-to-leaf (reverse the chain)
        for style_el in reversed(chain):
            _apply_ppr(ppr, style_el.find(_w("pPr")))
            _apply_rpr(rpr, style_el.find(_w("rPr")))

        return ppr, rpr

    def resolve_char_style(self, style_id: str) -> dict:
        """
        Resolve a character style chain, returning rPr props.
        """
        rpr = _empty_rpr()
        chain: list[etree._Element] = []
        seen: set[str] = set()
        sid: Optional[str] = style_id

        while sid and sid not in seen:
            seen.add(sid)
            el = self._styles.get(sid)
            if el is None:
                break
            chain.append(el)
            basedOn = el.find(_w("basedOn"))
            sid = basedOn.get(_w("val")) if basedOn is not None else None

        for style_el in reversed(chain):
            _apply_rpr(rpr, style_el.find(_w("rPr")))

        return rpr


# ---------------------------------------------------------------------------
# Numbering cache
# ---------------------------------------------------------------------------

class _NumberingCache:
    """Parsed representation of numbering.xml for fast lookup."""

    def __init__(self, num_root: Optional[etree._Element]) -> None:
        # abstractNumId -> dict of ilvl -> (ppr_props, rpr_props)
        self._abstract: dict[str, dict[int, tuple[dict, dict]]] = {}
        # numId -> abstractNumId
        self._num_to_abstract: dict[str, str] = {}

        if num_root is None:
            return

        for el in num_root:
            tag = etree.QName(el.tag).localname
            if tag == "abstractNum":
                aid = el.get(_w("abstractNumId"))
                if aid:
                    self._abstract[aid] = self._parse_abstract(el)
            elif tag == "num":
                nid = el.get(_w("numId"))
                abst = el.find(_w("abstractNumId"))
                if nid and abst is not None:
                    self._num_to_abstract[nid] = abst.get(_w("val"), "")

    def _parse_abstract(
        self, absNum: etree._Element
    ) -> dict[int, tuple[dict, dict]]:
        levels: dict[int, tuple[dict, dict]] = {}
        for lvl in absNum.findall(_w("lvl")):
            ilvl_str = lvl.get(_w("ilvl"))
            if ilvl_str is None:
                continue
            ilvl = int(ilvl_str)
            ppr: dict = _empty_ppr()
            rpr: dict = _empty_rpr()
            _apply_ppr(ppr, lvl.find(_w("pPr")))
            _apply_rpr(rpr, lvl.find(_w("rPr")))
            levels[ilvl] = (ppr, rpr)
        return levels

    def get_level_props(
        self, num_id: str, ilvl: int
    ) -> Optional[tuple[dict, dict]]:
        """
        Return (ppr_props, rpr_props) for a numbering level.
        Returns None if the numId or ilvl is unknown.

        Note: rpr_props here is for the list-label glyph only (ECMA-376 §17.9.6).
        We expose it for completeness but callers must not apply it to body text.
        """
        aid = self._num_to_abstract.get(num_id)
        if aid is None:
            return None
        levels = self._abstract.get(aid, {})
        return levels.get(ilvl)


# ---------------------------------------------------------------------------
# Run resolution
# ---------------------------------------------------------------------------

def _resolve_run(
    run: etree._Element,
    para_rpr: dict,
    style_cache: _StyleCache,
) -> Optional[RunRecord]:
    """
    Resolve effective formatting for a single w:r.

    Precedence (within a run):
      - Paragraph effective rPr (already accumulated)  ← baseline
      - Character style (w:rPr/w:rStyle)
      - Direct w:rPr on the run

    Only returns a RunRecord for actual text runs (w:t present).
    Returns None for runs that produce no text (e.g. field codes, bookmarks).
    """
    # Collect text
    t_els = run.findall(_w("t"))
    if not t_els:
        return None
    text = "".join(
        (t.text or "") + (t.tail or "") for t in t_els
        # Note: w:t.tail is typically empty; just be safe.
    ).rstrip("\n")
    # Filter out empty runs (they may exist as formatting carriers)
    # but still include empty-text runs so the caller can count runs.
    # Actually the caller will filter by text if needed.
    # We include them here for completeness.

    # Start from paragraph-level effective rPr
    props = dict(para_rpr)

    # Layer 5: character style
    rPr = run.find(_w("rPr"))
    if rPr is not None:
        rStyle = rPr.find(_w("rStyle"))
        if rStyle is not None:
            char_style_id = _get(rStyle, "val")
            if char_style_id:
                char_props = style_cache.resolve_char_style(char_style_id)
                # Merge (char style overrides paragraph-level defaults)
                for k, v in char_props.items():
                    if v is not None or isinstance(v, bool):
                        props[k] = v

    # Layer 6: direct run formatting
    if rPr is not None:
        _apply_rpr(props, rPr)

    return RunRecord(
        text=text,
        bold=props["bold"],
        italic=props["italic"],
        underline=props["underline"],
        strike=props["strike"],
        vert_align=props["vert_align"],
    )


# ---------------------------------------------------------------------------
# Main resolver
# ---------------------------------------------------------------------------

def resolve_document(pkg: DocxPackage) -> list[ResolvedParagraph]:
    """
    Compute effective formatting for every paragraph in the document.

    Returns a list of ResolvedParagraph, one per w:p in the body, in order.
    Paragraphs inside w:tbl are skipped (table interiors are out of scope, §8f).
    """
    styles_root = pkg.get_xml("word/styles.xml")
    style_cache = _StyleCache(styles_root)

    # Numbering (optional part)
    num_cache: _NumberingCache
    if pkg.has_part("word/numbering.xml"):
        num_cache = _NumberingCache(pkg.get_xml("word/numbering.xml"))
    else:
        num_cache = _NumberingCache(None)

    doc_root = pkg.get_xml("word/document.xml")
    body = doc_root.find(_w("body"))
    if body is None:
        return []

    results: list[ResolvedParagraph] = []
    index = 0

    # Only direct children of body (skip table paragraphs, per §8f)
    for child in body:
        tag = etree.QName(child.tag).localname
        if tag != "p":
            continue
        rp = _resolve_paragraph(child, index, style_cache, num_cache)
        results.append(rp)
        index += 1

    return results


def _resolve_paragraph(
    para: etree._Element,
    index: int,
    style_cache: _StyleCache,
    num_cache: _NumberingCache,
) -> ResolvedParagraph:
    pPr = para.find(_w("pPr"))

    # --- Determine style_id ---
    style_id: Optional[str] = None
    if pPr is not None:
        ps = pPr.find(_w("pStyle"))
        if ps is not None:
            style_id = _get(ps, "val")

    # --- Layer 1+2: docDefaults + style chain ---
    ppr_props, rpr_props = style_cache.resolve_style_chain(style_id)

    # --- Layer 3: numbering level pPr ---
    is_list = False
    num_id: Optional[int] = None
    list_level: Optional[int] = None

    if pPr is not None:
        numPr = pPr.find(_w("numPr"))
        if numPr is not None:
            ni = numPr.find(_w("numId"))
            il = numPr.find(_w("ilvl"))
            num_id_str = _get(ni, "val") if ni is not None else None
            ilvl_str = _get(il, "val") if il is not None else None

            # numId=0 means "remove numbering" (override to disable list)
            if num_id_str and num_id_str != "0":
                num_id = int(num_id_str)
                list_level = int(ilvl_str) if ilvl_str is not None else 0
                is_list = True

                # Apply numbering-level pPr (layer 3)
                # Note: numbering-level rPr applies to the label glyph only,
                # NOT to the paragraph body text (ECMA-376 §17.9.6).
                lvl_props = num_cache.get_level_props(num_id_str, list_level)
                if lvl_props is not None:
                    lvl_ppr, _lvl_rpr = lvl_props
                    # Merge numbering-level pPr into accumulated pPr
                    for k, v in lvl_ppr.items():
                        if v is not None:
                            ppr_props[k] = v

    # --- Layer 4: direct paragraph pPr (highest precedence for pPr) ---
    _apply_ppr(ppr_props, pPr)

    # --- Resolve runs ---
    # The paragraph-level effective rPr forms the baseline for all runs.
    runs: list[RunRecord] = []
    for child in para:
        tag = etree.QName(child.tag).localname
        if tag == "r":
            rec = _resolve_run(child, rpr_props, style_cache)
            if rec is not None:
                runs.append(rec)
        elif tag == "hyperlink":
            # Hyperlinks contain runs — resolve them
            for r_el in child.findall(_w("r")):
                rec = _resolve_run(r_el, rpr_props, style_cache)
                if rec is not None:
                    runs.append(rec)
        elif tag == "ins":
            # Tracked insertion — resolve contained runs
            for r_el in child.findall(_w("r")):
                rec = _resolve_run(r_el, rpr_props, style_cache)
                if rec is not None:
                    runs.append(rec)

    return ResolvedParagraph(
        index=index,
        style_id=style_id,
        outline_level=ppr_props.get("outline_level"),
        is_list=is_list,
        list_level=list_level,
        num_id=num_id,
        font_name=rpr_props.get("font_name"),
        font_size_half_points=rpr_props.get("font_size_half_points"),
        line_spacing=ppr_props.get("line_spacing"),
        line_rule=ppr_props.get("line_rule"),
        space_before=ppr_props.get("space_before"),
        space_after=ppr_props.get("space_after"),
        indent_left=ppr_props.get("indent_left"),
        indent_right=ppr_props.get("indent_right"),
        indent_first_line=ppr_props.get("indent_first_line"),
        indent_hanging=ppr_props.get("indent_hanging"),
        alignment=ppr_props.get("alignment"),
        runs=runs,
    )
