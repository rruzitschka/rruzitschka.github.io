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

7. **Training details in the sidebar (Route Inspector)** — present the
   training session detail in the right-hand inspector pane like the Send
   details, instead of the current overlay modal. Reuse the Route Detail
   Inspector chrome (`.insp-grid` rows, sections, Edit button) and
   `renderTrainingDetailHtml` as the card body; keep the session list
   selection driving the pane. Decide modal fallback behaviour for
   narrow screens.
8. **"Add Attempt" flow in the project overlay (iOS parity, agreed
   2026-11-11)** — the web project overlay only has the raw Attempts count
   field. iOS `AttemptLogView.swift` has the real flow: date, duration,
   was-successful toggle, high point, notes → increments attemptCount,
   sets lastAttemptDate, prepends "Attempt #N" (+ duration when it was a
   failed try) to the project notes, sets status `active` if unset, and on
   success marks the project `completed`, flips sendType to `redpoint`,
   sets the send date + climbDuration, and bumps the central route's
   attempt counter (fire-and-forget). Port as a section in the project
   overlay: pure attempt-entry builder in a form-model module + unit
   tests, wired like `send-form-model.js`.
9. **Multi-Pitch UI (web gap, agreed 2026-11-11)** — the web treats
   Multi-Pitch identically to Sport (rope style tabs, nothing else);
   selecting it changes nothing. iOS has the richer model
   (`MultiPitchPlanSection`: pitches + equipment). The CSV export already
   carries the ClimbNote-level fields (`numberOfPitches`,
   `approachNotes`, `descentNotes`, `gearNotes`), so the data model
   partially exists client-side. Plan a proper web UI (pitch list +
   equipment in the send overlay, inspector display) after Chunk 3 of
   `plan-uijs-refactor.md` — it touches the same overlay code.

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
