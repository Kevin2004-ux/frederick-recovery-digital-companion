# Backend Source Of Truth

This file maps the current canonical owners for the Frederick Recovery backend. Use it before making changes.

## Canonical Runtime Ownership

- App bootstrap and router mounting:
  - `src/server.ts`
  - `src/app.ts`
  - `src/routes/index.ts`
- Auth:
  - `src/routes/auth/index.ts`
  - `src/controllers/authController.ts`
  - `src/middleware/requireAuth.ts`
  - `src/middleware/requireConsent.ts`
  - `src/middleware/requireOnboarding.ts`
  - `src/middleware/requireRole.ts`
  - `src/utils/jwt.ts`
  - `src/utils/mailer.ts`
  - `src/repositories/userRepo.ts`
- Activation:
  - `src/routes/activation/index.ts`
  - `src/db/prisma.ts`
  - `src/services/AuditService.ts`
- Clinic routes and tenant enforcement:
  - `src/routes/clinic/index.ts`
  - `src/middleware/requireAuth.ts`
  - `src/middleware/requireRole.ts`
  - `src/services/AuditService.ts`
- Plan generation:
  - `src/routes/plan/index.ts`
  - `src/services/plan/generatePlan.ts`
  - `src/services/plan/rules.ts`
  - `src/services/plan/contentLibrary.ts`
  - `src/services/plan/enforceClinicOverrides.ts`
- Logging and exports:
  - `src/routes/log/index.ts`
  - `src/repositories/logRepo.ts`
  - `src/services/export/PdfService.ts`
  - `src/utils/requireUser.ts`
- Audit:
  - `src/services/AuditService.ts`
  - `prisma/schema.prisma` (`SecurityAudit` model)
- Prisma access:
  - Canonical Prisma access path for future backend work: `src/db/prisma.ts`
  - Legacy / avoid for new work, inspect-before-touching: `src/prisma/client.ts`
  - Data model source of truth: `prisma/schema.prisma`
- Validation and error handling:
  - Route-local Zod schemas inside route files
  - `src/middleware/errorHandler.ts`

## Safe Files To Modify Later

- Files under `src/`, when the owning area above is confirmed first.
- `prisma/schema.prisma`, only when schema work is explicitly intended.
- `prisma/migrations/`, only when a schema change is explicitly approved.
- `scripts/`, for validation helpers or local verification support.
- Root documentation files such as this one, `AGENTS.md`, `VALIDATION_CHECKLIST.md`, and `CHANGE_PROTOCOL.md`.

## Do Not Edit Directly

- `dist/`
- `.env`
- Generated Prisma client output under `node_modules/.prisma/` or other generated client locations
- Existing migration SQL unless the task is explicitly a migration repair

## Suspicious Or Legacy-Looking Paths To Inspect Carefully

- `src/db/prisma.ts` and `src/prisma/client.ts`
  - Canonical future ownership is `src/db/prisma.ts`. `src/prisma/client.ts` should be treated as legacy until a dedicated consolidation pass is approved.
- `src/routes.ts`
  - This appears adjacent to `src/routes/index.ts`. Inspect carefully before assuming it is active.
- `dist/middleware/authMiddleware.js`
  - Compiled output exists for a middleware path that does not appear to be the current TypeScript source entrypoint. Never patch `dist/`; inspect `src/` ownership first.
- Mixed imports between `../../db/prisma.js` and `../../prisma/client.js`
  - Future work should avoid creating a third access pattern.
- Route-local validation schemas
  - Validation is currently distributed across route files rather than centralized. Preserve contracts when editing.
