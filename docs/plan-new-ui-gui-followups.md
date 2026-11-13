# Plan — New-UI GUI follow-ups (Chalk & Sky)

Status: **resolved 2026-11-11** (item 6 = ongoing verification duty).
Created 2026-11-06 after the redesign shipped (`3e9f539` redesign,
`4c369d9` GUI-switch removal, `84ede60` docs). Historical reference — the
remaining live work is item 6 after each push.

## Context for the next session

- The new UI is **unconditional** — `html[data-theme="chalk-sky"]` is set
  statically; there is no Classic fallback, no theme toggle, no
  `classic-only`/`cs-only` branches left in markup or JS. Do not re-add any.
- Where things live:
  - Pure helpers (unit-tested): `app/js/ui-theme.js` — route-type chips,
    compact climb rows (`buildCompactClimbRowCellsHtml`), style
    abbreviations (`styleAbbreviation`, `STYLE_ABBREVIATIONS`), shared
    Route Detail card (`renderInspectorHtml`), ascent combiner
    (`combineAscentsWithOriginalSend`).
  - DOM wiring: `app/js/climb-inspector-ui.js` — chip bar (two-way synced
    with the hidden `#filter-routetype`), Route Detail Inspector
    (`selectClimbInInspector`), row-click binding, table header sync.
  - Theme styles: `app/css/theme-chalk-sky.css` (scoped under
    `html[data-theme="chalk-sky"]`).
- Conventions to respect: `docs/codebase/CONVENTIONS.md` § New UI
  (tokens `#0d1117/#161b22/#30363d/#76D6FF`, **no emojis** — SVG stroke
  icons, style abbreviations with full-name `title` tooltips, cloud symbol
  + "Owner" for community DB, ISO country pill).
- How to test: `node serve.cjs` → `http://localhost:8080/app/index.html`
  (real login) or `?mock=true` (mock user). Mock-1 **Biographie** is linked
  to community route `r-01` (GPS, `FR`, owned by the mock user → cloud +
  Owner, `★ 4.7 (10)`, 2 repeat ascents) — it exercises the full Inspector.
  Any other mock climb shows the empty ascent log state.
- Gates before finishing: `npx vitest run`, `npx eslint app/js tests`,
  CodeScene `pre_commit_code_health_safeguard`, `graphify update .`,
  update `docs/codebase/` after the push. Pushing needs the user's approval
  (🚀 dialog in the pi UI) and the SonarQube gate must pass.

## Remaining GUI issues (resolved 2026-11-11)

1. **Training detail modal** — ✅ rebuilt on the shared card renderer:
   `renderTrainingDetailHtml` in `ui-theme.js` (session variant: type title,
   Date/Duration/Intensity `.insp-grid` row, gym info, warm-up routes,
   async attached-sends section, notes, Edit Session button via
   `.insp-actions`). Intensity dots are pure `.intensity-dot`/`.filled` CSS
   (no inline colors). `buildWarmupRoutesHtml`/`buildSessionSendsTableHtml`
   moved from `route-line-ui.js` to `ui-theme.js`; status colors are class-
   based (`setAdminStatus`), no `style.color` writes.
2. **`admin.js` inline styles** — ✅ all 120 inline styles replaced with
   semantic `ad-*` classes in `theme-chalk-sky.css`; the
   `[style*="background:#f8fafc"]` attribute-selector override hacks are
   deleted. Route-type chips are `ad-chip-*` classes (dark-theme tints),
   dialogs are `ad-dialog-*`, status tones are `ad-status-*`.
3. **User's own star rating in the Route Inspector** — ✅ 4th grid cell
   "Your Rating" (grid widened to `repeat(4, 1fr)`); `userRating` passed
   through `buildInspectorMeta`, stars rendered by `renderStarsHtml`.
4. **Ascent-log fallback date** — ✅ already resolved by
   `combineAscentsWithOriginalSend` (`3e9f539`): the climb's own send is
   always the first log entry when a date/style exists. Only climbs with
   neither a date nor a send type show "No ascents logged yet" (no send
   date exists to show).
5. **Dead localStorage key** — ✅ `sendlog_ui_theme` no longer appears in
   `app/` or `tests/`; nothing to clean up.
6. **Live-site verification on a real account** — open duty after each
   push: verify filters/chips/inspector/edit overlays/Training/Stats/Admin
   with real Firebase data (mock mode already exercises the pane).

## Open follow-ups (2026-11-11)

7. **Training details in the sidebar (Route Inspector)** — ✅ done 2026-11-12:
   `#training-view` now has its own split workspace (`.training-workspace`:
   session list card + `#training-inspector` aside, same grid/responsive
   stack-under-980px as the logbook). Session-row click →
   `selectSessionInInspector(session)` in `training-ui.js` — mirrors
   `selectClimbInInspector`: `renderTrainingDetailHtml` card body, selected-row
   highlight (`.session-row.cs-row-selected`), Edit button →
   `showEditTrainingOverlay`, async attached-sends fetch guarded on
   `isConnected`. `renderTrainingPage` re-syncs the selection after each
   render (keep-selected, else first, else empty state);
   `renderInspectorEmptyHtml` takes an optional message. The detail modal
   (`showTrainingDetailModal`) was deleted — no modal fallback, the pane
   stacks below the list on narrow screens.
8. **"Add Attempt" flow in the project overlay (iOS parity, agreed
   2026-11-11)** — ✅ done 2026-11-12: "Log Attempt" section in the project
   overlay (edit mode, hidden for completed/abandoned projects — like iOS).
   Pure builder `app/js/attempt-form-model.js` (`durationLabel`,
   `buildAttemptFields`, unit-tested in `tests/attempt-form-model.test.js`,
   mirroring `AttemptLogView.saveAttempt()`: increment attemptCount,
   lastAttemptDate, highPoint preserve-or-update, prepended
   "Attempt #N - <date> (duration)" project notes, nil status → `active`,
   success → `completed` + `redpoint` + send date + `climbDuration`).
   `incrementAttemptCount` fire-and-forget in `firebase-routes.js` + mock
   no-op; `climbDuration` added to the climbNotes read/write mapping.
   Follow-on fix surfaced by review: **repo-wide uniform local-date scheme**
   — `parseLocalDate`/`formatDateInput` in `ui-theme.js` replace all
   `new Date("YYYY-MM-DD")` UTC parses and `toISOString().slice(0,10)`
   hydration (project/send/training/attempt forms); iOS writes local-midnight
   dates, web's UTC-midnight writes were the outlier. Legacy web records
   (exactly `00:00:00.000Z`) are normalized at read time by
   `normalizeLegacyUtcMidnight` (no-op for iOS writes and real datetimes).
   Note: a successful attempt does NOT call `completedProject` on the route
   (project/send counters) — iOS `AttemptLogView.saveAttempt` only bumps the
   attempt counter; `completedProject` is exclusive to the Convert-to-Send
   flow. Known limitation (pre-existing, shared with Save Project): clearing
   a central-route link cannot clear the stored `centralRouteID` via
   merge-save.
9. **Multi-Pitch UI (web gap, agreed 2026-11-11)** — ✅ done 2026-11-12:
   "Multi-Pitch Plan" section (Pitches 0–99, Approach, Descent, Gear) in
   the send and project overlays, **visible only when Type = Multi-Pitch**
   (iOS parity), and a pure `renderMultiPitchPlanHtml` inspector section
   (rendered only for Multi-Pitch with plan data — `hasPlanDetails` parity).
   `firebase-climbs.js` now fetches/writes the plan fields (the CSV export
   previously exported blanks); merge semantics distinguish `undefined`
   (not part of the save → merge-preserved, e.g. Sport↔Multi-Pitch flips
   keep plan data like iOS) from `null` (explicit clear). Shared helpers in
   `ui-theme.js` (`coercePitchCount`) and `overlay-common.js`
   (`syncMultiPitchSection`, `fill/resetMultiPitchFields`,
   `multiPitchFieldsFromOverlay`). Out of scope (iOS-only): Navigate-to-Start
   (inspector already has Coordinates) and topo photos (web RoutePhoto has
   no isTopo flag).

## Mock parity (fixed 2026-11-11)

- `fetchAllClimbAscents` was never mocked — mock mode hit real Firestore
  in `loadData()` and the logbook stayed empty. Now mocked from the
  embedded `MOCK_CLIMBS` ascents.
- `reportRating`/`incrementSendCount`/`incrementProjectCount`/
  `decrementProjectCount`/`completedProject` were `const` bindings in
  `ui.js`, so `setMockServices` could never override them. Now `let` +
  registered in `SERVICE_MOCK_SETTERS`.
- `training-ui.js` imported `fetchSessionSends` from `firebase-training.js`
  (it lives in `firebase-climbs.js`) — a hard module-load SyntaxError;
  fixed. Static import/export check across all `app/js` modules passes.
- `tests/training-ui.test.js` week/month/year tests were date-sensitive;
  rewritten relative to the current date.

## Done in this redesign (for reference)

- Chalk & Sky theme, header w/ login status, v4-style sidebar (flat filter
  rows), iOS route-type chips, compact fixed-width table (Style shorthand,
  numeric locale dates, no Rating column), right-hand Route Detail
  Inspector (Status/Ascents/Community grid, ascent log incl. original
  send, coordinates, photos), Community DB cloud + Owner everywhere,
  climb detail modal removed, Training/Stats/Admin themed, chart palette
  theme-aware, mock services at full inspector parity.
