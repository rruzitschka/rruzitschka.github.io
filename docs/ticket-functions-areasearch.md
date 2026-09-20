# Ticket: Firebase Functions — write `areaSearch` on routes API

**Status:** ✅ CLOSED — not applicable (investigated 2026-09-20)

## Investigation result

The Cloud Functions codebase (`functions/src/`) has **no route-creation or
route-edit endpoint**. Verified write targets across `src/`:

| Location | Writes | Touches `climbingArea`? |
| --- | --- | --- |
| `index.ts` — `orphanRoutesOnUserDelete` | `isOrphaned`, `orphanedAt`, `updatedAt` on `routes/` docs | ❌ no |
| `routes/climbs.ts` | read-only batch `get` of route docs (GPS lookup) | ❌ n/a |
| `routes/keys.ts` | `users/{uid}/apiKeys/` only | ❌ n/a |
| `routes/training.ts`, `routes/goals.ts` | unrelated collections | ❌ n/a |

`routes/` documents are written exclusively by:

1. **Web app** — ✅ writes `areaSearch` (shipped with the admin routes browser)
2. **iOS app** — ✅ writes `areaSearch` (`feature/areasearch-write-path`,
   merged to `main`; effective in the next app release)

Both write `areaSearch = foldedForSearch(climbingArea)` with identical
folding (lowercase + NFD-stripped diacritics). No Functions change is
required — nothing in the Functions codebase can create or alter
`climbingArea`.

## Residual maintenance note

If a routes write path is ever added to the Functions API, it must write
`areaSearch` alongside `climbingArea` (see web reference implementation in
`app/js/admin-routes-browser.js#foldedForSearch`) and add Jest coverage.
Until then, legacy docs missing the field are covered by the idempotent
"Backfill areaSearch" button in the web Admin Panel.
