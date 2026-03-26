# Backend Change Protocol

Use this protocol for every non-trivial backend change.

## Before Risky Work

- Create a branch before major work begins.
- Never start major work directly on `main`.
- Create a checkpoint commit before risky phases begin.
- Inspect the owning source files before editing.

## During The Change

- Keep an explicit changed-files summary.
- Keep an explicit unresolved-risks summary.
- Prefer small, reversible phases over wide rewrites.

## End Of Each Major Phase

- Add a rollback note for that phase.
- Record validation performed.
- Record any unresolved risks that remain.
