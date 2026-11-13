# STRUCTURE — SendLog Web App

Canonical file map. Update after every structural change.

## Repository layout

```
app/               the web app (SPA-ish, tab-based)
  index.html       app shell, import map, view sections
  js/              ES modules (see below)
  css/app.css      app styles
index.html         landing page (marketing + changelog) — lives at repo root
pages/             landing subpages: manual.html, policy.html, api.html
css/               landing page styles (legacy, separate from app/css)
tests/             vitest suites (mock firebase/firestore + firebase-config)
docs/              canonical dev docs (codebase/) + historical plans/tickets
sonar-project.properties, eslint.config.js, vitest.config.js
serve.cjs          local static server (node serve.cjs . 8080)
```

**Deploy note:** one repo serves everything via GitHub Pages. Pushing commits
that only touch `app/` changes the web app but leaves the landing page and
manual byte-identical — use this to ship app changes ahead of a landing-page
update (e.g. for an app release). Landing/manual content is published by the
same push that touches those files, so keep release-coupled landing changes
on a held-back branch until the release.

## app/js modules

### firebase-* service modules (Firestore access, one per collection domain)

| Module | Responsibility |
| --- | --- |
| `firebase-config.js` | Firebase init, `db` export |
| `firebase-auth.js` | Auth (Apple sign-in), `getCurrentUser` |
| `firebase-climbs.js` | climbNotes CRUD, ascents, stats, filters (`matchesRouteTypeFilter`: Gym filter covers Gym + Gym Boulder), `fetchSessionSends`, photo helpers (`fetchPhotos` incl. `isTopo`, `uploadPhoto`, `setPhotoIsTopo`, `softDeletePhoto`) |
| `firebase-training.js` | trainingSessions CRUD + `computeTrainingStats` |
| `firebase-routes.js` | Central route DB (`routes/`): search, create/update, counters, ratings |
| `firebase-api-keys.js` | API key management (admin) |

### Pure logic modules (Firestore-free, DOM-free, vitest-testable)

| Module | Responsibility |
| --- | --- |
| `route-entries.js` | Warm-up route entries wire format (iOS `TrainingRouteEntry`): tolerant decode, iOS save semantics, byte-compatible encode |
| `send-style.js` | Send-type vocabulary + route-type compatibility rules (boulder/gym predicates, coercion on type switch, style-tab visibility predicate) |
| `iso-countries.js` | ISO 3166-1 alpha-2 validation/names |
| `photo-form-model.js` | Photo feature pure helpers (unit-tested): iOS-parity constants (2048px, JPEG 0.85, `{noteId}_{uuid}.jpg` file names), Storage path builder, topo split, overlay photo-grid HTML |

### DOM-only helper modules (no module state, split out of ui.js)

| Module | Responsibility |
| --- | --- |
| `route-line-ui.js` | Training overlay gym route lines (DOM wiring only — detail-card HTML builders moved to `ui-theme.js`) |
| `admin.js` | Admin panel; markup built with semantic `ad-*` classes (no inline styles) |
| `route-link-ui.js` | Find-route button state for the soft-link UI |
| `ui-theme.js` | New-UI pure helpers: route-type chips (canonical order via `orderRouteTypeFilterValues`, Gym Boulder merged into Gym, colored label font), compact climb rows (shorthand styles, locale dates, colored Type badge), shared Route Detail card renderer incl. the Log Attempt section (`renderInspectorAttemptSectionHtml`), training-session detail card (`renderTrainingDetailHtml`), star rows (`renderStarsHtml`) |
| `climb-inspector-ui.js` | New-UI DOM wiring: route-type chip bar (synced with #filter-routetype), right-hand Route Detail Inspector incl. the interactive Log Attempt section (expandable pane form; on success re-renders the completed detail explicitly since the climb left the Projects filter), mock services via `setClimbInspectorMockServices` |
| `overlay-country.js` | Country select sync for overlays |
| `reverse-geocode.js` | BigDataCloud reverse geocoding (admin GPS pin) |
| `admin-routes-browser.js` | Admin route browser query helpers (search folding, filter order, sort — nameSearch asc default, createdAt desc "newest first" browse-all) |
| `photo-dom.js` | Client-side image pipeline: canvas downscale + JPEG re-encode (also strips EXIF/GPS — privacy) |
| `photo-overlay-ui.js` | Photo section in the send/project edit overlays: thumbnails with mark-as-topo toggle + confirmed delete; upload immediate on edit, queued until save on add (`flushPendingPhotos`); session guard against overlay switches; mock services via `setPhotoOverlayMockServices` |
| `lightbox-ui.js` | Full-screen photo viewer (iOS `TopoViewerSheet` parity): prev/next/close, arrow-key + Escape navigation, backdrop close |

### View/controller modules

| Module | Responsibility |
| --- | --- |
| `ui.js` | Dashboard data loading (`loadData` split into `applyLoadedClimbs`/`scheduleSideLoads`), filter/search wiring, CSV export, community-rating bootstrap (~430 lines after Chunks 2–6 of `docs/plan-uijs-refactor.md` — Code Health 10, no function cc > 9; refactor goal reached) |
| `climb-table-ui.js` | Climbs table: stats bar, table rows, pagination, filter options, grade badge (`gradeBadgeClass`), `formatDate`, toast, loading skeleton, route-data maps (Chunk 5 of the ui.js refactor; pure helpers unit-tested in `tests/climb-table-ui.test.js`) |
| `view-switcher.js` | Sidebar All/Projects/Sent view switching: active states, view label, context-aware header action buttons (Chunk 6 of the ui.js refactor) |
| `account-ui.js` | Account view (user card, grade-system preference, API keys overlay), stats view, logbook view panels, confirm dialog, account deletion (Chunk 4 of the ui.js refactor) |
| `training-ui.js` | Training view: session list, log/edit overlay, detail modal, period filters (Chunk 1 of the ui.js refactor) |
| `send-overlay-ui.js` | Send overlay: add/edit send, star picker, style-tab/route-type sync, inline ascent form + ascent list, save flow (Chunk 2) |
| `overlay-common.js` | Shared overlay plumbing for Send + Project overlays: `overlayState` (central-route soft-link state), close/find-route wiring, route search overlay, delete binding, central-route create/propagate, hidden find-route button while linked |
| `send-form-model.js` | Pure send-overlay helpers (unit-tested): save-payload builder, community-rating delta logic (`sendRatingReportCalls`), style-pill class, ascent input builder |
| `project-overlay-ui.js` | Project overlay: add/edit project, attempts counters, mark-as-sent (project → send transition), community-rating retraction |
| `project-form-model.js` | Pure project-overlay helpers (unit-tested): save-payload builder, counter bookkeeping (`projectCounterChange`), attempt-count coercion, date validation |
| `attempt-form-model.js` | Pure Log-Attempt helpers (unit-tested, iOS `AttemptLogView` parity): `buildAttemptFields` payload builder, shared `saveAttempt` pipeline (save → fire-and-forget route counter → refresh) used by both the project overlay and the inspector pane, `attemptProjectStateFromClimb` |
| `stats.js` | Stats page (legacy script, window globals) |
| `grades.js` | Grade systems + pickers (legacy script, window globals) |
| `admin.js` | Admin panel |
| `mock.js` | In-memory mock services for `?mock=true` (no sign-in, no data risk); `fetchClimbs` normalizes sendType on read like `firebase-climbs` (Title Case display); photo store + upload/toggle/delete services (Mock-1 Biographie has a photo + a topo) |
