# TESTING — SendLog Web App

## Running

```bash
npx vitest run          # all tests
npx vitest run --coverage
npx eslint app/js tests # lint (no new issues)
```

## Principles

1. **Pure modules are fully unit-tested** (`route-entries.js`, `send-style.js`,
   `iso-countries.js` — DOM-free by design so this is possible).
2. **Firestore-touching modules are tested with mocked `firebase/firestore`**
   + mocked `firebase-config.js` / `firebase-auth.js` (see
   `tests/fetchRouteData.test.js` for the canonical mock setup). Snapshot
   shapes come from `makeSnap(rows)` helpers.
3. **DOM-only view code (ui.js, admin.js, stats.js, route-line-ui.js) is not
   unit-tested** — no jsdom/happy-dom dependency on purpose. Keep DOM
   functions thin; push logic down into pure modules (that is how
   `send-style.js` was extracted after a live bug).
4. `mock.js` mirrors the service API for `?mock=true` manual UI testing —
   when adding a service function, extend `mock.js` in the same change.

## Coverage policy

- `vitest.config.js` `coverage.include` lists the measurable modules; Sonar
  (`sonar.coverage.exclusions`) excludes the DOM/UI files. **Keep both lists
  in sync** — a new pure module missing from the vitest list counts as 0 %
  covered in the Sonar gate.
- Gate: new coverage ≥ 80, new violations = 0. If the gate fails, fix the
  cause — never bypass (`--no-verify`).

## Known issue

`tests/recentEdits.test.js` has a pre-existing eslint `no-dupe-keys` error
(duplicate `runTransaction` in a mock object literal) — harmless at runtime,
unfixed as of 4.0.0-prep.
