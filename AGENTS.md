# SendLog Web App — Agent Instructions

## CodeScene

- After changing code, run `code_health_review` on the changed files. If Code Health drops, fix the issues, run the review again, and use `code_health_score` to confirm the result.
- Before finishing, run `pre_commit_code_health_safeguard` and only stop when it passes.

## Behaviour

- Be short and concise. Never start implementation without asking for confirmation first. Always ask if something is unclear.
- Never push without explicit user approval (the push hook enforces `PUSH_APPROVED=1`).

## Project

- Static ES modules, no bundler: `app/index.html` + `app/js/*.js`. Put new logic in small, focused modules (see `iso-countries.js`, `overlay-country.js`, `route-link-ui.js`).
- Keep helpers Firestore-free and DOM-free where possible so they stay vitest-testable (`tests/`); mock `firebase/firestore` + `firebase-config.js` in tests that need it.
- Run `npx vitest run` and `npx eslint` on changed files before committing — no new lint issues.
- After code changes run `graphify update .` (knowledge graph in `graphify-out/`).

## Conventions

- Route `country` is an ISO 3166-1 alpha-2 code (validate via `iso-countries.js`). **Never leave `country` absent on a route doc — write `country: null` explicitly** (Firestore null equality never matches field-absent docs; that bug class is known).
- Equality filter order in `buildRouteQuery` (isOrphaned → routeType → country) must match the composite indexes in `firestore.indexes.json`.
- GPS-backed routes (latitude set) are authoritative for country — batch operations must never overwrite them.
- Admin "Save GPS Pin" reverse-geocodes the country (BigDataCloud, see `reverse-geocode.js`) and overwrites any existing value; "Remove GPS" keeps the country.
