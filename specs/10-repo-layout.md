# Repository Layout (SPEC.md §11)

> **Canonical source:** [`../SPEC.md § 11. Repo layout`](../SPEC.md#11-repo-layout)

---

## Directory Structure

```
auto-matter/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app — routes, validation, CORS
│   │   ├── jobs.py                  # In-memory job store + background runner
│   │   ├── render.py                # LibreOffice + pdftoppm preview rendering
│   │   ├── ooxml/
│   │   │   ├── constants.py         # OOXML namespaces + schema-mandated element orders
│   │   │   ├── package.py           # Zip archive wrapper + byte-identical round-tripper
│   │   │   ├── resolver.py          # STAGE 1 — 6-layer effective formatting cascade
│   │   │   ├── inventory.py         # STAGE 2 — compact paragraph digest generator
│   │   │   ├── spec.py              # STAGE 4 — mode-based formatting spec derivation
│   │   │   ├── sanitize.py          # STAGE 5a — presentation property stripper
│   │   │   ├── restyle.py           # STAGE 5 — patch orchestrator + FT_* style injector
│   │   │   └── numbering.py         # STAGE 5e — list definition copying + numId remapping
│   │   └── classify/
│   │       ├── taxonomy.py          # Closed 15-role enum + JSON schema + validation
│   │       ├── llm.py               # STAGE 3 — structured LLM call + SHA-256 caching
│   │       └── fallback.py          # STAGE 3 fallback — deterministic heuristics
│   ├── tests/
│   │   ├── fixtures/
│   │   │   ├── climate_original.docx    # Messy source test document
│   │   │   └── climate_reference.docx  # Hand-formatted target look
│   │   ├── conftest.py              # Session-level shared fixtures
│   │   ├── test_acceptance.py       # End-to-end ground truth acceptance tests (§12)
│   │   ├── test_api.py              # FastAPI route and validation tests
│   │   ├── test_inventory.py        # Digest, taxonomy, and fallback tests
│   │   ├── test_llm.py              # LLM prompt, caching, and fallback tests
│   │   ├── test_numbering.py        # Numbering transfer + remap tests
│   │   ├── test_package.py          # Zip archive + byte-identical tests
│   │   ├── test_render.py           # Preview generation + pdftoppm tests
│   │   ├── test_resolver.py         # Precedence resolution + edge-case tests
│   │   ├── test_restyle.py          # Sanitise, style injection, + patch tests
│   │   ├── test_spec.py             # Specification derivation + mode tests
│   │   └── SPEC_COVERAGE.md         # Test-to-spec traceability index
│   ├── requirements.txt
│   └── Dockerfile                   # Python 3.12 + LibreOffice + Poppler
├── frontend/                        # Next.js + TypeScript
│   └── app/
│       ├── page.tsx                 # Primary application page with state polling
│       ├── components/
│       │   ├── DropZone.tsx         # Drag-and-drop dual document uploader
│       │   ├── PreviewPane.tsx      # Synchronized split-screen page previewer
│       │   └── ChangeReport.tsx     # Changes breakdown table + download button
│       └── api/[...path]/route.ts   # Next.js API proxy rewrite to backend
├── specs/                           # Decomposed feature specs (SDD)
│   └── README.md                    # Spec directory index
├── docs/
│   ├── adr/                         # Architecture Decision Records
│   │   └── README.md                # ADR index
│   └── SPEC_COMPLIANCE.md           # Living spec compliance matrix
├── docker-compose.yml
├── SPEC.md                          # Authoritative technical specification
├── CHANGELOG.md                     # Version history
└── README.md                        # Project documentation
```

---

## Key Dependency Notes (from SPEC.md §11)

Suggested backend deps: `fastapi`, `uvicorn`, `lxml`, `pydantic`, `python-multipart`.

> **Use `lxml` for XML work, not `python-docx`** — python-docx abstracts away exactly the
> layers the engine needs control over.
