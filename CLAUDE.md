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
- API types are hand-written only until the Phase 2 backend publishes OpenAPI (ADR 011), then generated.

## Current state
- Runs against an in-browser mock API (MSW, `src/mocks/`) fed by `src/mocks/data/demo.json`, exported
  from a recorded engine run by `backend/scripts/export_frontend_mock.py` in `jev-ai`.
- `VITE_USE_MOCKS=false` + `VITE_API_BASE_URL` point it at the real API once Phase 2 exists.

## Verify before saying done
`npx tsc -b && npm run lint && npm run format:check && npm test && npm run build` (and `npm run e2e`
for flow changes). Node version in `.nvmrc`.
