# CONCERNS — SendLog Web App

Known debt and risk areas. Update as items are resolved/discovered.

1. **ui.js is a 2600-line monolith** — mean complexity is above the Sonar
   threshold, several functions exceed complexity limits, ~100 functions in
   one module. Mitigation pattern established: extract DOM helpers
   (`route-line-ui.js`, `route-link-ui.js`) and pure rules (`send-style.js`,
   `route-entries.js`). Continue slicing on every touch, don't big-bang.
2. **Deploy skew between `index.html` and `app/js/*.js`** — GitHub Pages
   caches 10 min; a browser can pair fresh JS with stale HTML (or reverse).
   Overlay sync paths are guarded with optional chaining, but any new
   HTML-coupled feature should keep that armor. No cache-busting hashes
   exist (no bundler) — file-level cache skew is a permanent constraint.
3. **Legacy non-module scripts** (`stats.js`, `grades.js`) communicate via
   `window` globals and are linted separately. They still need manual
   review when grade data changes (V-scale/FB grades not yet supported —
   W5 pending).
4. **Web gym features are live before iOS 4.0.0 ships** — intentional
   (forward-compatible data), but the landing page/manual still describe the
   old feature set until the held-back landing update merges.
5. **No E2E/browser tests** — regression rely on unit tests of pure modules
   plus manual testing (live + `?mock=true`). The 3ade6a3-era incident
   (`.has()` on an array) showed DOM-path bugs escape easily; the mitigation
   is the pure-module extraction pattern.
6. **`saveClimbNote` merge semantics** — `setDoc(..., { merge: true })`
   preserves unknown fields (iOS-written data survives web edits), but a
   *cleared* field needs an explicit `null` write (date/country pattern).
   Any new optional field must decide which behavior it needs.
7. **pre-existing lint error** in `tests/recentEdits.test.js`
   (`no-dupe-keys`) — cosmetic, unfixed.
8. **Sonar "new code" spans everything since the last analysis** with static
   `projectVersion=1.0`; large feature pushes can dip coverage/violations —
   run the scanner locally before pushing big changes.
