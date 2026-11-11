# Plan — New-UI GUI follow-ups (Chalk & Sky)

Status: **open** · Created 2026-11-06 after the redesign shipped
(`3e9f539` redesign, `4c369d9` GUI-switch removal, `84ede60` docs).
Working plan for picking the last GUI issues up in a fresh session.

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

## Remaining GUI issues (in suggested order)

1. **Training detail modal** — the last view still built from old
   inline-styled markup in `ui.js` (`showTrainingDetailModal`). Rebuild it
   on a shared card renderer like `renderInspectorHtml` (a session variant:
   type/date/duration/intensity rows, gym info, warm-up routes, attached
   sends, notes, Edit Session button). Watch out: intensity dots must use
   `.intensity-dot`/`.filled` (sky-blue), not inline colors — that bug was
   fixed once already. Keep `hideDetailModal` + the `✕` close behaviour.
2. **`admin.js` inline styles** — many hardcoded light styles
   (`background:#f8fafc`, `#f1f5f9`, type-chip colors). Currently covered by
   the attribute-selector overrides at the end of `theme-chalk-sky.css`
   (`[style*="background:#f8fafc"]` etc.). Preferred end state: replace the
   inline styles with semantic classes and drop the override hacks.
3. **User's own star rating is not displayed in the Route Inspector** —
   dropped when the grid became Style/Ascents/Community (user approved the
   screenshot). If wanted back, add a 4th cell — grid is
   `repeat(3, 1fr)` in `theme-chalk-sky.css`; a 4th cell wraps to a second
   row (or widen to `repeat(4, 1fr)`). Needs `starsHtml` passed through
   `buildInspectorMeta` in `climb-inspector-ui.js`.
4. **Ascent-log fallback date** — a climb with zero repeat ascents shows
   "No ascents logged yet"; its own send date appears nowhere in the pane
   (table + edit overlay still show it). Decide: keep as-is (screenshot
   parity) or render the send date when the log is empty.
5. **Dead localStorage key** — browsers that once toggled the old
   Classic/GUI switch still carry `sendlog_ui_theme`. Nothing reads it;
   optional one-line cleanup script or just ignore (expires naturally).
6. **Live-site verification on a real account** — deployed via GitHub Pages
   after push; verify filters/chips/inspector/edit overlays/Training/Stats/
   Admin with real Firebase data (mock mode already exercises the pane).

## Done in this redesign (for reference)

- Chalk & Sky theme, header w/ login status, v4-style sidebar (flat filter
  rows), iOS route-type chips, compact fixed-width table (Style shorthand,
  numeric locale dates, no Rating column), right-hand Route Detail
  Inspector (Status/Ascents/Community grid, ascent log incl. original
  send, coordinates, photos), Community DB cloud + Owner everywhere,
  climb detail modal removed, Training/Stats/Admin themed, chart palette
  theme-aware, mock services at full inspector parity.
