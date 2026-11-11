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

## Done in this redesign (for reference)

- Chalk & Sky theme, header w/ login status, v4-style sidebar (flat filter
  rows), iOS route-type chips, compact fixed-width table (Style shorthand,
  numeric locale dates, no Rating column), right-hand Route Detail
  Inspector (Status/Ascents/Community grid, ascent log incl. original
  send, coordinates, photos), Community DB cloud + Owner everywhere,
  climb detail modal removed, Training/Stats/Admin themed, chart palette
  theme-aware, mock services at full inspector parity.
