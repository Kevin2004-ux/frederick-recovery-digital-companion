# Backend Guardrails

This backend is in a foundation-freeze phase. Prefer minimal, additive changes.

## Pre-Flight

- Before risky work, check whether the worktree is already dirty.
- If the worktree is already dirty, stop and warn before starting a major change unless the task is explicitly limited and additive.

## Editable Source Of Truth

- `src/` is the editable source of truth for application behavior.
- `dist/` is generated output and must never be edited directly.
- `.env` must never be modified as part of Codex implementation work.
- Generated Prisma client files must never be edited directly.

## Non-Negotiable Safety Rules

- Do not introduce parallel auth systems.
- Do not create duplicate service ownership for the same domain behavior.
- Do not create destructive migrations without explicit approval.
- Do not remove legacy code unless explicitly approved and validated.
- Prefer additive changes over breaking rewrites.

## Work Sequence

- Inspect first.
- Patch second.
- Validate last.

## Behavior To Preserve

- Strict auth enforcement and current route contracts.
- Role isolation and tenant enforcement.
- Token invalidation behavior.
- Audit logging behavior, including fail-closed critical audit paths.
- Encrypted field handling and related utility usage.
- Activation-code integrity and claim/approval flow correctness.

## Change Style

- Make the smallest diff that solves the problem.
- Do not edit generated output to simulate a fix.
- Keep ownership clear: one canonical auth path, one canonical audit path, one canonical Prisma access path per runtime area.

## Completion Requirements

- Every major change must end with validation notes.
- Every major change must include rollback notes.
