# TESTING — SendLog Web App

## Running

```bash
npx vitest run          # all tests
npx vitest run --coverage
npx eslint app/js tests # lint (no new issues)
```

## Principles

1. **Pure modules are fully unit-tested** (`route-entries.js`, `send-style.js`,
   `iso-countries.js`, `photo-form-model.js` — DOM-free by design so this is
   possible).
2. **Firestore-touching modules are tested with mocked `firebase/firestore`**
   + mocked `firebase-config.js` / `firebase-auth.js` (see
   `tests/fetchRouteData.test.js` for the canonical mock setup). Snapshot
   shapes come from `makeSnap(rows)` helpers.
3. **DOM-only view code (ui.js, admin.js, stats.js, route-line-ui.js,
   photo-dom.js, photo-overlay-ui.js, lightbox-ui.js) is not unit-tested** —
   no jsdom/happy-dom dependency on purpose. Keep DOM functions thin; push
   logic down into pure modules (that is how `send-style.js` was extracted
   after a live bug).
4. `mock.js` mirrors the service API for `?mock=true` manual UI testing —
   when adding a service function, extend `mock.js` in the same change.

## Coverage policy

- `vitest.config.js` `coverage.include` lists the measurable modules; Sonar
  (`sonar.coverage.exclusions`) excludes the DOM/UI files. **Keep both lists
  in sync** — a new pure module missing from the vitest list counts as 0 %
  covered in the Sonar gate, and a new DOM module missing from the Sonar
  exclusions drags new coverage below the 80 gate (hit in practice with the
  photo modules, fixed in `d791da7`).
- `firebase/storage` is CDN-loaded (index.html import map), not an installed
  package — tests resolve it via the `tests/stubs/firebase-storage.js` alias
  in `vitest.config.js`. Per-test `vi.mock("firebase/firestore")` keeps
  working alongside it.
- Gate: new coverage ≥ 80, new violations = 0. If the gate fails, fix the
  cause — never bypass (`--no-verify`).

## Known issue

`tests/recentEdits.test.js` has a pre-existing eslint `no-dupe-keys` error
(duplicate `runTransaction` in a mock object literal) — harmless at runtime,
unfixed as of 4.0.0-prep.
