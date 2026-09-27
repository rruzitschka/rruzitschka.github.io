# Ticket: iOS — record `recentEdits` audit entries on central route writes

**Priority:** Medium · **Effort:** ~2–3h · **Depends on:** web audit-trail diff
rendering (shipped with the admin routes browser) · **Status:** Planned

## Background

The web admin panel's route edit form shows a `recentEdits` audit trail
(timestamp + editor UID + per-field `changes` diff). The web writers
(`updateCentralRoute`, `adminSaveRoute`, country batch apply) record entries.
**The iOS app never writes `recentEdits`** — route edits done from the app
(creation, edit-overlay saves) are invisible in the audit trail.

## Current web contract

`routes/{id}.recentEdits` = newest-first array, capped at **3** entries:

```js
{
  editedAt: Date,
  editedBy: uid,
  note?: string,              // e.g. "admin country batch update"
  action?: string,            // "update" | "create" | ... (see below)
  changes?: [                 // per-field diff, capped ~10
    { field: "grade",   from: "7a", to: "7b" },
    { field: "country", from: null, to: "AT" }
  ]
}
```

Entries without `changes` render fine (old format is a valid subset).

## iOS implementation plan

1. **Serialization helper** — `CentralRoute+a11y`-style extension or in
   `RouteRepository.swift`:
   `static func recentEdit(action:changes:) -> [String: Any]` producing the
   shape above (`Timestamp(date:)`, `editedBy: uid`).
2. **Diff helper** — `static func routeFieldChanges(from: CentralRoute,
   to: CentralRoute) -> [[String: String?]]` comparing the human-meaningful
   fields only: `name`, `climbingArea`, `crag`, `grade`, `createdGrade`,
   `routeType`, `country`, `isOrphaned`. Skip `*Search` fields, counters,
   `updatedAt`. Cap at 10 entries. `null` → `NSNull()` (Firestore-compatible).
3. **Write points** (all inside the existing Firestore write paths in
   `RouteRepository.swift`):
   - Route **creation** → entry with `action: "create"`, `changes: []`
   - Route **edit** (transaction reads the current doc before writing — diff
     old vs. new `CentralRoute`, prepend entry, keep cap of 3)
   - Rating/counter increments: **no entry** (noise; the web also skips these)
4. **Permission note**: writes go through the same `setData`/`updateDoc` merge
   paths already used — `recentEdits` is an unrestricted field per the current
   Firestore rules; no rules change needed.
5. **Unit tests** (`ClimbingNotesTests`):
   - diff correctness (changed / unchanged / cleared-to-nil fields)
   - cap behavior (3 entries retained, newest first)
   - serialized shape matches the web's expected keys exactly
6. **Verify end-to-end**: edit a route in the app → admin panel edit form shows
   the entry with the field diff; old web entries still render.

## Out of scope

- Audit entries for counter bumps (sendCount/projectCount/ratings) — agreed too
  noisy.
- Backfilling history — only new edits are recorded.
