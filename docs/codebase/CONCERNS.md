# CONCERNS — SendLog Web App

Known debt and risk areas. Update as items are resolved/discovered.

1. ~~**ui.js was a 2600-line monolith**~~ **Resolved 2026-11-13** — sliced down
   by `docs/plan-uijs-refactor.md`, all mandatory chunks (1–6) done 2026-11-11
   to 2026-11-13: training UI, send overlay, project overlay, account/stats/
   API-keys, table helpers, view-switcher → `training-ui.js`,
   `send-overlay-ui.js`, `project-overlay-ui.js`, `overlay-common.js`,
   `account-ui.js`, `climb-table-ui.js`, `view-switcher.js`,
   `send-form-model.js`, `project-form-model.js`; ui.js now 430 lines,
   Code Health 5.3 → 10, no function cc > 9. Optional Chunk 7 (grade picker
   polish) and the pending innerHTML-sanitizer sweep remain in the plan.
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

9. **New-UI leftovers (post-redesign, 2026-11)** — the Chalk & Sky GUI is
   deployed as the only UI (GUI switch removed), but polish is pending:
   see `docs/plan-new-ui-gui-followups.md`. In brief: the Training detail
   modal still uses old inline-styled markup, `admin.js` carries many inline
   light styles (covered by CSS overrides only), the user's own star rating
   is not displayed in the Route Inspector, and existing browsers may still
   carry the dead `sendlog_ui_theme` localStorage key (harmless, never read).
