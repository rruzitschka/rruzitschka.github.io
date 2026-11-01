# CONVENTIONS — SendLog Web App

Hard rules. Breaking any of these is a bug.

## Data

1. **Gym notes never touch `routes/`** (ADR 0005): no central route creation,
   no soft links, no community-rating or send/project-counter writes for
   `routeType` Gym / Gym Boulder. Enforced in the send save path; the
   project overlay must not offer gym types (projects are central-DB).
2. **Route `country` is an ISO 3166-1 alpha-2 code** (validate via
   `iso-countries.js`). Never leave `country` absent on a route doc — write
   `country: null` explicitly (Firestore null-equality vs field-absent bug).
3. **Equality filter order in `buildRouteQuery`** (isOrphaned → routeType →
   country) must match the composite indexes in `firestore.indexes.json`.
4. **GPS-backed routes are authoritative for country** — batch operations
   must never overwrite them; "Save GPS Pin" reverse-geocodes and overwrites,
   "Remove GPS" keeps the country.
5. **`sessionID` soft links are authoritative** — the same-day check is
   iOS-only at attach time. Web queries `climbNotes` where
   `sessionID == session.id` (`fetchSessionSends`).
6. **Gym sessions**: `gym` + `routes` (JSON array of TrainingRouteEntry).
   Save semantics mirror iOS `GymSessionWizardSave`: skip empty grades,
   renumber `order`, encode `null` when empty. Key order in the JSON matches
   iOS property order (see `route-entries.js`). Only "Gym Session" sessions
   get gym fields; saving another type must not clear them.
7. **Send types** are lowercase in Firestore (iOS-native), Title Case in the
   UI — always `canonicalizeSendType()` before write, `normalizeSendType()`
   for display (`send-style.js`).

## UI

8. Only "Gym Session" shows the gym/route-lines fields in the training
   overlay; Gym/Gym Boulder send types hide Area + Country and retitle
   Crag → Gym. Pinkpoint/All Free are outdoor-only (hidden in gyms).
9. Overlay-sync DOM lookups must be **guarded** (optional chaining) — a
   cached old `index.html` paired with fresh JS (deploy skew) must never
   throw and kill an overlay.
10. Element state set by sync helpers must be restorable: never reset
    `className` wholesale when a class list (e.g. `hidden`) carries sync
    state — remove specific classes instead.

## Process

11. Run `npx vitest run` + `npx eslint app/js tests` before committing; no
    new lint issues.
12. SonarQube pre-push gate: new violations = 0, new coverage ≥ 80. Coverage
    is measured only for pure/service modules (see vitest.config.js include
    list); DOM-only files are excluded in `sonar.coverage.exclusions` —
    update both lists together when adding modules.
13. Pushes require `PUSH_APPROVED=1` (explicit user approval).
14. Run `graphify update .` after code changes.
15. Update `docs/codebase/` after every push that changed code, commands, or
    conventions.
