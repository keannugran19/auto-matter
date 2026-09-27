# Stage 2 — Digest (SPEC.md §4)

> **Canonical source:** [`../SPEC.md § 4. Stage 2 — the digest`](../SPEC.md#4-stage-2--the-digest)

---

## Responsibility

Reduce each resolved document to a compact, one-line-per-paragraph representation suitable
for sending to the LLM classifier without transmitting the full document text.

---

## Rationale

Do **not** send whole documents to the model. The digest format:

- Cuts token usage by roughly an order of magnitude vs. full text.
- Limits how much of a user's document leaves the server.
- Loses almost nothing for classification purposes.

---

## Digest Fields (Per Paragraph)

```
{
  index,           # paragraph position (0-based)
  role_hint,       # deterministic fallback's guess (prior for the model)
  text_excerpt,    # first ~150 characters, ellipsised
  font,            # font name
  size_pt,         # font size in points
  bold_ratio,      # fraction of characters that are bold
  italic_ratio,    # fraction of characters that are italic
  underline_ratio, # fraction of characters that are underlined
  alignment,       # e.g. "both", "left", "center"
  indent_first,    # first-line indent in twips
  space_before,    # space before in twips
  is_list,         # boolean
  outline_level,   # OOXML outline level (0–8, or None)
  style_id,        # w:pStyle value
  char_count       # total character count
}
```

### Notes on Key Fields

- **`text_excerpt`** — first ~150 characters, ellipsised. Sufficient for role inference.
- **`*_ratio`** — fraction of characters carrying that emphasis. Strong signal: a paragraph
  over ~60% italic is almost always a quotation block.
- **`role_hint`** — the deterministic fallback's guess (§6), so the model has a prior.

---

## Implementation Reference

| Artifact | Path                                                                    |
| -------- | ----------------------------------------------------------------------- |
| Module   | [`backend/app/ooxml/inventory.py`](../backend/app/ooxml/inventory.py)   |
| Tests    | [`backend/tests/test_inventory.py`](../backend/tests/test_inventory.py) |
