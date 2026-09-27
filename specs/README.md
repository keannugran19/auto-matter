# Specs Directory — Auto-Matter

This directory contains the **decomposed feature specifications** for Auto-Matter.

> **Canonical source of truth:** [`../SPEC.md`](../SPEC.md)
>
> The files here are scoped views of `SPEC.md`, one per domain area. They exist to make
> individual sections navigable and linkable without requiring readers to open the full spec.
> If there is ever a conflict between a file here and `SPEC.md`, `SPEC.md` wins.

---

## Index

| File                                                           | Canonical Section | Topic                                                                |
| -------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| [`00-locked-decisions.md`](00-locked-decisions.md)             | SPEC.md §0        | Scope — decisions that are locked and must not be silently revisited |
| [`01-architecture.md`](01-architecture.md)                     | SPEC.md §2        | 5-stage pipeline architecture and data flow                          |
| [`02-formatting-resolver.md`](02-formatting-resolver.md)       | SPEC.md §3        | Stage 1 — ECMA-376 6-layer effective formatting resolver             |
| [`03-digest.md`](03-digest.md)                                 | SPEC.md §4        | Stage 2 — compact paragraph digest for classification                |
| [`04-classification.md`](04-classification.md)                 | SPEC.md §5        | Stage 3 — LLM classification, closed taxonomy, caching               |
| [`05-deterministic-fallback.md`](05-deterministic-fallback.md) | SPEC.md §6        | Deterministic fallback classifier                                    |
| [`06-spec-derivation.md`](06-spec-derivation.md)               | SPEC.md §7        | Stage 4 — mode-based formatting spec derivation                      |
| [`07-in-place-patch.md`](07-in-place-patch.md)                 | SPEC.md §8        | Stage 5 — in-place OOXML patching (sanitize, styles, section, lists) |
| [`08-preview-rendering.md`](08-preview-rendering.md)           | SPEC.md §9        | LibreOffice + pdftoppm preview rendering                             |
| [`09-api-contract.md`](09-api-contract.md)                     | SPEC.md §10       | REST API contract — all endpoints, payloads, status codes            |
| [`10-repo-layout.md`](10-repo-layout.md)                       | SPEC.md §11       | Repository directory structure                                       |
| [`11-test-fixtures.md`](11-test-fixtures.md)                   | SPEC.md §12       | Acceptance test fixtures and expected derived spec values            |
| [`12-build-order.md`](12-build-order.md)                       | SPEC.md §13       | Recommended build/implementation order                               |
| [`13-known-pitfalls.md`](13-known-pitfalls.md)                 | SPEC.md §14       | Pitfalls learned the hard way                                        |

---

## How to Use This Directory

- **Finding a feature spec:** Look up the relevant section in the table above and open the file.
- **Filing a spec change:** Edit `SPEC.md` first, then update the corresponding file here to stay in sync.
- **Tracing a spec to code:** See [`../docs/SPEC_COMPLIANCE.md`](../docs/SPEC_COMPLIANCE.md).
- **Tracing a spec to tests:** See [`../backend/tests/SPEC_COVERAGE.md`](../backend/tests/SPEC_COVERAGE.md).
- **ADRs (Architecture Decision Records):** See [`../docs/adr/`](../docs/adr/).
