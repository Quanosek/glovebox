---
name: "porzadki"
description: "Use when: an approved pull request was merged into master, or a series of large commits was pushed directly to master. Maintenance pass: remove unused code, improve readability and layout, extract shared helpers, update docs/AGENTS/README, extend critical-path tests, run every check."
argument-hint: "Optional: area or commit range to focus on"
agent: "agent"
---

Run the repository maintenance pass on the current `master` (optionally focused on: ${input:focus:whole repository}). Follow [AGENTS.md](../../AGENTS.md); keep its language rules (code, docs and commit messages in English, UI and README in Polish).

1. **Find unused code.** Run `pnpm unused` (knip), `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` and `pnpm lint:py`. Check every finding against its callers before deleting; keep documented public helpers (mark them `@public` with a reason).
2. **Readability and layout.** Split oversized files and functions into named steps or modules by responsibility, keep related code together, and extract code repeated in two or more places into shared helpers (TypeScript: `src/lib/`, `src/components/`; Python: `scripts/manual_extract/model.py`, `text.py`, `geometry.py`). Do not change behaviour; for extractor changes regenerate the local manuals into a temporary folder and confirm the JSON output is identical before replacing `database/` (never commit it).
3. **Tests of critical paths.** Make sure the tests cover what changed and the critical moments listed in AGENTS.md ("Conventions"): database reader, import validation, `/media` path safety, cross-site rejection of mutating API routes, storage validation, anchoring, service worker, install manifest and the extractor rules. Build test databases with `src/lib/__tests__/fixtures/database.ts`.
4. **Documentation.** Update `docs/*.md`, `AGENTS.md` (architecture tree, commands, conventions) and `README.md` (Polish, user commands) to match the code.
5. **Validate.** Run `pnpm check` and fix every failure, including formatting (`pnpm format`) and build warnings. Smoke-test the main pages with `pnpm start` when routes or data loading changed.
6. **Report** the removed code, refactors, new tests and any findings left open, then commit only when the user asks.
