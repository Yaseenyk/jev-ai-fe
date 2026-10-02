# CLAUDE.md — SRTM frontend (React)

Manager web app for Smart Resource–Task Matching. Backend, engine and **all project docs** live in
the companion repo `Yaseenyk/jev-ai` (locally the parent folder `D:\Sparity LLM`).

## Read before coding

- `../docs/04-frontend-standards.md` — toolchain, structure, **AI display rules (§4)**
- `../docs/06-api-contract.md` — endpoints and shapes (types in `src/api/types.ts` mirror it)
- `../docs/08-security-privacy-fairness.md` — human in the loop, forbidden attributes

## Hard rules

- **No UI element assigns a person.** Only "Accept as candidate" / "Reject (with reason)".
- Probabilities shown as whole percentages with bars for **every** option; bands always have text labels.
- Show code-computed facts next to AI decisions; explanations labelled AI-generated with their cited facts.
- Never render LLM text as HTML (`dangerouslySetInnerHTML` is forbidden).
- API types are **generated**: never hand-write one. After a backend API change run
  `uv run python scripts/export_openapi.py` (backend), then `npm run gen:api` here;
  `src/api/types.ts` only aliases `components['schemas']`.

## Current state

- `npm run dev:api` (mode `api`, `.env.api`: `VITE_USE_MOCKS=false`) runs against the **real backend**:
  Vite proxies `/api` to uvicorn on :8000; start the backend API and worker first (see `../docs/09`).
- `npm run dev` (default) runs against the in-browser mock API (MSW, `src/mocks/`) fed by
  `src/mocks/data/demo.json`, for offline demos; unit tests and `npm run e2e` use the mock too.
- Sign-in: `src/features/auth/` (in-memory access token, refresh via httpOnly cookie, silent renewal on 401, `RequireAuth` guard, `useCanEdit()` hides write actions from viewers). Mock mode signs in automatically.

## Verify before saying done

`npx tsc -b && npm run lint && npm run format:check && npm test && npm run build` (and `npm run e2e`
for flow changes). Node version in `.nvmrc`.
