# Ticket: Firebase Functions — write `areaSearch` on routes API

**Priority:** Medium · **Effort:** ~1–2h · **Depends on:** nothing (web side shipped)

## Background

Same as `docs/ticket-ios-areasearch.md`: the web admin browser's *area* search
needs `areaSearch = foldedForSearch(climbingArea)` on every route doc. The
backfill covered existing docs; **routes created/edited via the Cloud
Functions routes API lack the field** until their write paths add it.

## Scope

`functions/src/routes/` — every code path that creates or updates a route doc:

- [ ] Route creation handler — add `areaSearch`
- [ ] Route update handler(s) — recompute `areaSearch` whenever
      `climbingArea` changes
- [ ] Any bulk/backfill/imports endpoint that touches `climbingArea`

## Tasks

1. **Folding parity**: reuse the same fold logic the Functions already use for
   `nameSearch`/`cragSearch` (lowercase + strip `[\u0300-\u036f]` after NFD
   normalization). If there is no shared helper yet, extract one — web's
   reference implementation is `app/js/admin-routes-browser.js#foldedForSearch`.
2. **Jest tests** (`functions/tests/`, required by repo guidelines): folding
   correctness (diacritics, null/empty area → `""`) and that create/update
   payloads include `areaSearch`.
3. **Deploy**: `firebase deploy --only functions` after merge.

## Verification

- Call the API to create/update a route with `climbingArea: "Hohe Wand"` →
  doc contains `areaSearch: "hohe wand"`.
- Web admin area search finds it without re-running the backfill.
- Re-run the admin "Backfill areaSearch" once after deploy to catch any docs
  written in the interim (idempotent).

## Notes

- `firestore.indexes.json` (21 composites incl. `areaSearch`) is already
  deployed — no index work needed.
- Do NOT rename/re-purpose `nameSearch`/`cragSearch` — the app-side route
  picker (`searchRoutes`) and iOS depend on them.
