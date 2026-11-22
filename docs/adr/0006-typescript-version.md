# ADR-0006: TypeScript version for apps/web

- **Status:** Accepted — Opus reviewed (generator crash with TS 7.0.2 confirmed in evidence; peer range typescript@^5) and owner approved 2026-11-22 · **Date:** 2026-11-22
- **Decision:** Pin TypeScript **6.0.3** for V1.
- **Evidence:** With TypeScript 7.0.2 installed, `openapi-typescript@7.13.0` (`pnpm gen:api`) crashed on import: `TypeError: Cannot read properties of undefined (reading 'createKeywordTypeNode')` (7.x has no JS compiler API; the package also declares peer `typescript@^5.x`). `tsc --noEmit` from 7.0.2 itself ran. ESLint/Next with TS 7 were NOT TESTED (stopped at the generator failure).
- **Consequences:** Revisit when openapi-typescript supports TS 7 or an alternative generator is adopted (change requires ADR update).
