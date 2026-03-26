# Backend Validation Checklist

Run this after changes. If a step fails, stop, record the failure, and do not continue to broader edits until the cause is understood.

## Install And Build

- Confirm dependencies are installed.
- Run `npm run build`.
- Stop if TypeScript compilation fails.

## Prisma Checks

- Run `npx prisma validate`.
- Run `npx prisma generate`.
- Stop if Prisma validation or client generation fails.

## Targeted Route Smoke Checks

- Confirm the server still mounts:
  - `/health`
  - `/auth`
  - `/user`
  - `/log`
  - `/activation`
  - `/plan`
  - `/clinic`
  - `/admin`
- Prefer curl or API-client smoke checks against a local dev server rather than broad refactors.

## Auth Smoke Check

- Signup path still returns the same contract shape.
- Login path still enforces current credentials, lockout, and verification behavior.
- `GET /auth/me` still requires a valid bearer token.
- Consent acceptance still works through the existing protected route.

## Clinic Route Smoke Check

- Clinic-authenticated access still reaches `GET /clinic/batches`.
- Cross-tenant creation and read restrictions still reject unauthorized clinic access.
- Owner-only admin flows remain isolated from clinic flows.

## Activation Smoke Check

- `POST /activation/claim` still validates code, email, and password.
- Claim flow still marks the code claimed and does not issue a JWT directly.
- Verification-email side effects remain consistent with current environment configuration.

## Logging Smoke Check

- Patient-only access to `/log/*` is still enforced.
- Entry create, update, and list flows still validate request payloads.
- Export routes still preserve audit-before-export behavior.

## Rollback / Stop Rule

- If build, Prisma validation, Prisma generation, or any targeted smoke check fails:
  - stop further work,
  - summarize the exact failing command or route,
  - revert only the current phase’s changes if needed,
  - do not stack more edits on top of a failing validation state.
