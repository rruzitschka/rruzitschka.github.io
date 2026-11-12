# Plan — ui.js refactor (Brain Class → focused modules)

**Status:** open · **Baseline:** ui.js Code Health 5.3 (2026-11-11), 2352 lines, 106 functions.

**Progress:** Chunk 1 ✅ done (ui.js Code Health 5.3 → 5.9, `training-ui.js` 10.0).
Chunk 2 ✅ done 2026-11-11 (ui.js 5.9 → 7.78 — goal ≥ 7.0 reached early;
`overlay-common.js` 10, `send-overlay-ui.js` 10, `send-form-model.js` 10;
`bindSendOverlayHandlers` cc=30 gone from ui.js, worst remaining method is
now `bindProjectOverlayHandlers` cc=18 → Chunk 3).
Chunk 3 ✅ done 2026-11-12 (ui.js 7.78 → 8.23; `project-overlay-ui.js` 10,
`project-form-model.js` 10; remaining cc>9 in ui.js are exactly the Chunk
4–6 targets: showAccountView 17, bindFilterHandlers.setActiveView 11,
gradeBadgeClass 11, showStatsView 10, loadData 10, bindApiKeyHandlers 10).
Chunk 4 ✅ done 2026-11-13 (ui.js 8.23 → 9.13; `account-ui.js` 10;
remaining cc>9 in ui.js are exactly the Chunk 5–6 targets:
gradeBadgeClass 11, bindFilterHandlers.setActiveView 11, loadData 10).

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

**Done 2026-11-11 (incl. mock-mode smoke test, verified by user):**
`training-ui.js` (Code Health 10) with all training view logic,
`showTrainingDetailModal`, overlays, `filterSessionsByPeriod` (pure, unit-tested
in `tests/training-ui.test.js`), `sessionFormPayload` (DOM read helper),
`setTrainingMockServices` for mock mode. `ui.js` keeps only imports +
`loadData` wiring. `showStatsView` shares the session cache via
`ensureTrainingSessionsLoaded()`. Mock parity gaps found during the smoke
test are fixed and documented in `plan-new-ui-gui-followups.md`
("Mock parity (fixed 2026-11-11)"); commits `8b52e94` + `c369d0c`.

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

## Chunk 2 — Send overlay module (`send-overlay-ui.js`) ✅

**Done 2026-11-11 (mock-mode smoke test verified by user, incl. follow-up
fixes: mock projectStatus → canonical values + defensive normalize,
"Find in Community DB" hidden while the soft link is active):** Three-way split, dependencies one-way (no circular
imports):
- `overlay-common.js` — shared overlay plumbing: `overlayState` (central-route
  soft-link state shared by Send + Project overlays), `bindOverlayCommon`,
  `bindOverlayDeleteHandler`, `buildRouteSearchOverlay`,
  `fetchRouteOwnershipThenSync`, `maybeCreateCentralRoute`,
  `maybePropagateToRoute`, `setDataLoader`/`refreshData` (loadData injected —
  no ui.js cycle), `setOverlayCommonMockServices`. Code Health 10.
- `send-overlay-ui.js` — add/edit send overlay, star picker, style-tab /
  route-type sync, inline ascent form, ascent list. `bindSendOverlayHandlers`
  split into per-concern binders (`bindSendOverlaySubmit` cc ≈ 4,
  `bindSendOverlayDelete`, `bindAscentForm`); save flow decomposed into
  `saveSend` / `applySendRatingReports` / `applySendCounters` /
  `deleteProjectRecord`. `setSendOverlayMockServices`. Code Health 10.
- `send-form-model.js` — pure, unit-tested (`tests/send-form-model.test.js`):
  `stylePillClass`, `buildSendSavePayload`, `sendRatingReportCalls`
  (community-rating delta logic), `buildAscentInput`. Code Health 10.
- `ui.js` keeps the project overlay (Chunk 3) wired to `overlayState` + the
  shared helpers; eslint config gained the three new modules.

Biggest win: `bindSendOverlayHandlers` (cc=30, 122 LoC, 4 bumps) was the worst
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

## Chunk 3 — Project overlay module (`project-overlay-ui.js`) ✅

**Done 2026-11-12:** ui.js no longer owns any overlay code.
- `project-overlay-ui.js` (Code Health 10) — add/edit project overlay,
  `bindProjectOverlayHandlers` split into `bindProjectOverlaySubmit`
  (cc ≈ 4), `bindProjectOverlayDelete`, `bindProjectMarkAsSent` (the plan's
  "bindProjectCompletion" — the project → send transition);
  `saveProject` decomposed into `retractPreviousRating` /
  `applyProjectCounters` / `buildMarkAsSentPrefill`. Grade-picker shim
  moved here. `setProjectOverlayMockServices`.
- `project-form-model.js` (pure, unit-tested in
  `tests/project-form-model.test.js`) — `buildProjectSavePayload`,
  `projectCounterChange` (increment on new / decrement on abandoned),
  `coerceAttemptCount`, `validateProjectDates` (new soft guard: last
  attempt cannot predate the first attempt).
- Depends on Chunk 2's overlay-common location — both overlay modules now
  import from `overlay-common.js`.

- Move: `showAddProjectOverlay`, `showEditProjectOverlay`, `bindProjectOverlayHandlers`
  (cc=18, 101 LoC), `fetchRouteOwnershipThenSync` (lives in overlay-common
  since Chunk 2), grade-picker glue (`initGradePicker`
  shim lives in ui.js — move it here).
- Split `bindProjectOverlayHandlers` into: `bindProjectOverlayFields`,
  `bindProjectOverlaySubmit`, `bindProjectCompletion` (send→project transition).
- Extract pure helpers: project payload builder, attempt-count/deadline validation.
- Depends on Chunk 2's `bindOverlayCommon`/`bindOverlayDeleteHandler` location —
  run after Chunk 2.

## Chunk 4 — Account / Stats / API-keys module (`account-ui.js`) ✅

**Done 2026-11-13:** ui.js 8.23 → 9.13 (693 lines), `account-ui.js` 10.
- `account-ui.js` — `showAccountView` split into `renderAccountCard` /
  `bindGradeSystemPreference`; `showStatsView`; `showLogbookView` (panel
  helper `setMainPanels` + `setActiveSidebarItem`); full API-keys section
  (`renderApiKeys`, `handleRevokeKey`, `openApiKeyOverlay`,
  `closeApiKeyOverlay`, `handleGenerateKey`, `bindApiKeyHandlers` split into
  `bindApiKeyOverlayHandlers` + `bindApiKeyCreatedHandlers`);
  `handleDeleteAccount`; `showConfirmDialog` (now owned here, exposed on
  `globalThis` — same shim pattern as training-ui/overlay-common; admin.js
  comment updated). `setAccountUIMockServices` wired into ui.js
  `setMockServices`; firebase-auth/firebase-api-keys imports + bindings
  (view-account, view-stats, delete-account-btn, api-key handlers) moved out
  of ui.js. `globalThis.showToast` now exposed by ui.js for the account shims.
- Verified: vitest 203 pass, eslint 0 errors, CodeScene pre-commit safeguard
  passed (ui.js verdict "improved": showAccountView cc=17, showStatsView
  cc=10, bindApiKeyHandlers cc=10 all fixed).

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
