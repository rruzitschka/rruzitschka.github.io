# Plan — ui.js refactor (Brain Class → focused modules)

**Status:** open · **Baseline:** ui.js Code Health 5.3 (2026-11-11), 2352 lines, 106 functions.

**Progress:** Chunk 1 ✅ done (ui.js Code Health 5.3 → 5.9, `training-ui.js` 10.0).

**Goal:** split `ui.js` into focused view modules so Code Health reaches green (≥ 7.0)
and no single function exceeds cc ≈ 9. Every chunk is independently executable,
one commit, app working after each chunk.

**Chunk verification gates (every chunk):**
`npx vitest run` · `npx eslint app/js tests` · `code_health_review` on changed files
(no Code Health drop, report score) · `pre_commit_code_health_safeguard` ·
`graphify update .` · mock-mode smoke (`index.html?mock=true`): views open,
overlays open, save flows work.

---

## Chunk 1 — Training UI module (`training-ui.js`) ✅

Easiest, most self-contained win. ~250 lines out of ui.js.

**Done 2026-11-11:** `training-ui.js` (10.0) with all training view logic,
`showTrainingDetailModal`, overlays, `filterSessionsByPeriod` (pure, unit-tested
in `tests/training-ui.test.js`), `sessionFormPayload` (DOM read helper),
`setTrainingMockServices` for mock mode. `ui.js` keeps only imports +
`loadData` wiring. `showStatsView` shares the session cache via
`ensureTrainingSessionsLoaded()`.

- Move: `showTrainingView`, `showTrainingDetailModal`, `showAddTrainingOverlay`,
  `showEditTrainingOverlay`, `bindTrainingOverlayHandlers` (cc=13), `loadTrainingData`,
  `renderTrainingPage` (cc=13), `bindPeriodTabs`, `setIntensity`, `updateSessionSends`.
- Reuse existing pure helpers from `ui-theme.js` (`renderStarsHtml`,
  `renderTrainingDetailHtml`, `buildSessionSendsTableHtml`).
- Extract pure helpers where handlers are tangled: session-form payload builder
  (DOM-free, unit-tested in `tests/`), period aggregation.
- `ui.js` keeps only the sidebar view-switch wiring (`showTrainingView` re-exported).
- Removes: `bindTrainingOverlayHandlers` cc=13, `renderTrainingPage` cc=13,
  `showTrainingView` cc=10 from ui.js.

## Chunk 2 — Send overlay module (`send-overlay-ui.js`)

Biggest win: `bindSendOverlayHandlers` (cc=30, 122 LoC, 4 bumps) is the worst
method in the codebase. ~450 lines out of ui.js.

- Move: `showAddSendOverlay`, `showEditSendOverlay`, `bindSendOverlayHandlers`,
  `bindOverlayCommon` (cc=11), `bindOverlayDeleteHandler`, `submitAscentFromOverlay`,
  `_maybeCreateCentralRoute`, `_maybePropagateToRoute`, `buildRouteSearchOverlay`
  (cc=9), `syncStyleTabVisibility`, `syncCragFieldForGym`, `syncSendOverlayForRouteType`,
  `setStylePill`, `setStarRating`, `bindStarPicker`.
- Split `bindSendOverlayHandlers` into per-concern binders:
  `bindSendOverlayFields` (route-type/style sync), `bindSendOverlayRouteSearch`,
  `bindSendOverlaySubmit` (cc target ≤ 9), `bindSendOverlayDelete`.
- Extract pure, DOM-free helpers into `ui-theme.js` (or a new `send-form-model.js`):
  save-payload builder, ascent validation, style-pill normalization. Unit-test those.
- `bindOverlayCommon` stays as the shared overlay plumbing (close/error handlers).

## Chunk 3 — Project overlay module (`project-overlay-ui.js`)

- Move: `showAddProjectOverlay`, `showEditProjectOverlay`, `bindProjectOverlayHandlers`
  (cc=18, 101 LoC), `fetchRouteOwnershipThenSync`, grade-picker glue (`initGradePicker`
  shim lives in ui.js — move it here).
- Split `bindProjectOverlayHandlers` into: `bindProjectOverlayFields`,
  `bindProjectOverlaySubmit`, `bindProjectCompletion` (send→project transition).
- Extract pure helpers: project payload builder, attempt-count/deadline validation.
- Depends on Chunk 2's `bindOverlayCommon`/`bindOverlayDeleteHandler` location —
  run after Chunk 2.

## Chunk 4 — Account / Stats / API-keys module (`account-ui.js`)

- Move: `showAccountView` (cc=17), `showStatsView` (cc=11), `showLogbookView`,
  `bindApiKeyHandlers` (cc=10), `handleGenerateKey`, `closeApiKeyOverlay`,
  `deleteAccount` glue, `showConfirmDialog`.
- Split `showAccountView` into: render account card / render api-keys section /
  bind api-keys handlers (cc target ≤ 9 each).

## Chunk 5 — Table & rendering helpers (`climb-table-ui.js`)

- Move: `renderStatsBar`, `renderClimbsTable`, `renderPagination`, `renderAscentsList`,
  `populateFilters`, `gradeBadgeClass` (cc=11), `formatDate`, `showLoading`,
  `showToast`, `hideDetailModal`.
- `formatDate` also feeds `climb-inspector-ui.js` via deps — move it to
  `ui-theme.js` (pure) and pass it down, or keep a shared `format.js`.
- All pure → direct unit tests (`tests/climb-table-ui.test.js`).

## Chunk 6 — ui.js slim-down & Brain Class resolution

Only after 1–5: `ui.js` shrinks to ~500–700 lines — under the Brain Class
threshold (functions ≈ 40–50).

- Keep: module init + `setMockServices`, `loadData` (cc=10), `bindFilterHandlers` /
  `setActiveView` (cc=11), `showAddSendOverlay` callers, `showDetailModal` (detail
  modal orchestration), `bootstrapCommunityRatings`.
- Split `bindFilterHandlers.setActiveView` into a `view-switcher.js` (sidebar,
  hash routing, per-view init).
- Re-measure: `code_health_review` on `ui.js` — target no function cc > 9,
  Code Health ≥ 7.0.
- Update `docs/codebase/STRUCTURE.md` (new modules) and `docs/codebase/STACK.md`
  if module list changed.

---

## Chunk 7 — Optional: grade picker & shared overlay plumbing

- `gradeBadgeClass` (cc=11) → pure helper in `ui-theme.js` (grade-array driven).
- `bindOverlayCommon."input"` complex conditionals (2 expressions) → encapsulate.
- `bindSendOverlayHandlers`-style bumps: verify no remaining function has > 2
  nested-conditional bumps (Bumpy Road).

**Ordering:** 1 → 2 → 3 → 4 → 5 → 6 → 7. Chunks 1–2 unblock 3; 4–5 are independent
of 2–3 but sequenced after for review simplicity. Each chunk ends with: commit,
`pre_commit_code_health_safeguard`, docs update, push approval request.
