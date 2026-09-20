# Ticket: iOS — write `areaSearch` on CentralRoute

**Priority:** Medium · **Effort:** ~1h · **Depends on:** nothing (web side shipped)

## Background

The web admin panel's routes browser searches `nameSearch`, `cragSearch`, and
`areaSearch` (all folded via `foldedForSearch()`: lowercase + NFD-stripped
diacritics). A one-time backfill added `areaSearch` to all existing route docs
(2026-09-20). **Routes created/edited by the iOS app don't write `areaSearch`**
— they are invisible in the admin *area* search (name/crag search unaffected)
until the backfill button is re-run.

## Tasks

1. **`CentralRoute` model** (`ClimbingNotes/ClimbingNotes`): add
   `areaSearch: String` to
   - `init` / `makeNew` — computed as `Self.foldedForSearch(climbingArea)`
   - `toFirestoreData()` — include `areaSearch`
2. **Folding parity**: iOS already folds `nameSearch`/`cragSearch` — find and
   reuse that same fold helper; the output must be identical to the web's
   `foldedForSearch` (`str.lowercased()`, `folding: .diacriticInsensitive`
   or NFD strip of `[\u0300-\u036f]`).
3. **Unit test**: assert `toFirestoreData()` contains `areaSearch` and that
   folding matches (e.g. `"Hohe Wand"` → `"hohe wand"`, `"Café"` → `"cafe"`).

## Deployment / verification

- Ship iOS release, create/edit a route, then in the web Admin Panel:
  area search must find it **without** re-running the backfill.
- One-off: re-run "Backfill areaSearch" once after the release to catch any
  routes created in the interim (idempotent, ~1 batch).

## Out of scope

- Functions API write path → separate ticket
  (`docs/ticket-functions-areasearch.md`)
- Storing folded copies for full-text *contains* search — rejected by design
  (incompatible with server-side pagination).
