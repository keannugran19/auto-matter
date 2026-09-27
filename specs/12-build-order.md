# Build Order (SPEC.md §13)

> **Canonical source:** [`../SPEC.md § 13. Build order`](../SPEC.md#13-build-order)

---

## Recommended Implementation Sequence

Ship stages 1–2 with tests before touching the LLM, and get the patch engine round-tripping
a file unchanged before it changes anything.

| Step | Component                                                                                    | Spec Section | Status  |
| ---- | -------------------------------------------------------------------------------------------- | ------------ | ------- |
| 1    | Docker image with LibreOffice + Poppler; confirm headless conversion works                   | §9           | ✅ Done |
| 2    | `constants.py`, `package.py` — read a docx, list parts, write it back **byte-identical**     | §11          | ✅ Done |
| 3    | `resolver.py` + unit tests against both fixtures ← _the hard part, do it properly_           | §3           | ✅ Done |
| 4    | `inventory.py` + digest snapshot tests                                                       | §4           | ✅ Done |
| 5    | `fallback.py` (so there's a working classifier before any API dependency)                    | §6           | ✅ Done |
| 6    | `spec.py` — derive the spec from the reference; assert it matches the §12 table              | §7           | ✅ Done |
| 7    | `sanitize.py` + `restyle.py` — first make a no-op patch round-trip cleanly, then apply specs | §8           | ✅ Done |
| 8    | `numbering.py` — lists                                                                       | §8e          | ✅ Done |
| 9    | `render.py` — previews                                                                       | §9           | ✅ Done |
| 10   | `llm.py` — swap in real classification; compare against fallback on the fixtures             | §5           | ✅ Done |
| 11   | FastAPI routes + job runner                                                                  | §10          | ✅ Done |
| 12   | Frontend two-pane UI                                                                         | §11, §12     | ✅ Done |
| 13   | Change report, validation, cleanup, wider corpus                                             | §10, §12     | ✅ Done |

---

## Key Principle

> Ship stages 1–2 with tests **before** touching the LLM. Get the patch engine round-tripping
> a file unchanged **before** it changes anything.

This principle ensures that each stage is independently verifiable before the next stage depends on it.
