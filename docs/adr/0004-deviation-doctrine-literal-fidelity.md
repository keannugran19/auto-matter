# ADR-0004: Deviation Doctrine — Literal Fidelity with Warnings

## Status

Accepted

## Context

When applying the reference document's formatting to the target, there are cases where the
reference values may produce visually poor results in the target context. For example:
a 42 pt title style applied to a very long heading in the target could cause text to overflow
its container. Two strategies were considered:

- **Fit-aware adaptation:** The engine silently adjusts values when it detects that the reference
  value would produce an overflow or visual issue in the target.
- **Literal fidelity:** Apply the reference's values exactly as derived. When a likely overflow
  is detected, flag it as a warning in the change report but still apply the value.

## Decision

**Literal fidelity, with warnings.** Apply the reference's values exactly. If a value will
likely cause an overflow, flag it in the change report rather than quietly adapting.

A fit-aware mode may be added later as an explicit toggle, but it is not part of v1.

## Consequences

- **Predictable, auditable output.** The user sees exactly what the reference says.
- **Warnings surface overflow risks** via the `warnings` array in the change report
  (`severity: "warn"`, with `paragraphIndex` where applicable).
- **Users retain control.** They can decide to override problematic values in Word after download.
- **Fit-aware logic is deferred** to a future explicit opt-in mode, keeping v1 scope manageable.

## Spec Reference

SPEC.md §0 — "Deviation doctrine | Literal fidelity, with warnings | Apply the reference's
values exactly. If a value will likely overflow (e.g. a 42 pt title on a long heading), flag
it in the change report rather than quietly adapting. A fit-aware mode may be added later as
an explicit toggle."

## Implementation

- [`backend/app/ooxml/spec.py`](../../backend/app/ooxml/spec.py) — `DerivedSpec.warnings`
- [`backend/app/jobs.py`](../../backend/app/jobs.py) — `_build_report()` — warning serialization
