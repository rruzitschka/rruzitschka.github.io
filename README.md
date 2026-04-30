# SendLog Web App

A companion web dashboard for the ClimbingNotes iOS app. Provides a browser-based view of your climbing logbook with full CRUD support for climb notes, ascents, and training sessions.

## Tech Stack

- **Vanilla HTML/CSS/JavaScript** — no framework dependencies
- **Firebase JS SDK 10.x** (compat CDN) — Firestore, Auth, Storage
- **Chart.js 4.4.2** (CDN) — grade distribution and route type bar charts
- **Sign In with Apple** via Firebase Auth

## Architecture

```
app/
├── index.html              Main dashboard (auth gate + app shell)
├── login.html              Sign In with Apple landing page
├── css/
│   └── app.css             Design system (variables, components, overlays)
└── js/
    ├── firebase-config.js  Firebase project config + SDK init
    ├── firebase-auth.js    initAuth(), signInWithApple(), signOut()
    ├── firebase-climbs.js  fetchClimbs(), saveClimbNote(), saveAscent(), computeStats(), filterClimbs()
    ├── firebase-training.js fetchTrainingSessions(), saveTrainingSession(), computeTrainingStats()
    ├── grades.js           GRADES arrays, detectGradeSystem() — shared grade logic
    ├── stats.js            Client-side stats: summary, grade distribution, route types, heatmap, streaks, training
    ├── ui.js               All DOM rendering, overlays, event handlers, view routing
    ├── firebase-routes.js  Central Route Database service — search, create, and link shared route docs
    ├── firebase-api-keys.js API key management — create, list, revoke partner API keys
    └── mock.js             Mock mode — overrides all Firebase calls with local data
```

## Views

| View | Description |
|------|-------------|
| **Logbook** | Full send log with grade badges, ascent type chips, and route detail overlay |
| **Projects** | Routes marked as Project with progress notes |
| **Training** | Training session log with duration and type; summary stats (total sessions, hours, avg/week) |
| **Statistics** | Client-side analytics dashboard (see below) |
| **Account** | Sign-in status, grade preference, data export, API key management, danger zone |

### Statistics View

Computed entirely client-side from already-loaded climb and training data. No extra Firestore reads.

**Period filter:** All Time · This Year · This Month · This Week

| Section | Detail |
|---------|--------|
| Summary cards | Total climbs, unique routes, climbing days, avg rating, top area, hardest send |
| Grade Distribution | Bar chart (Chart.js) of sends by grade, hardest send inline label |
| Route Types | Bar chart — Boulder / Sport / Multi-Pitch breakdown |
| Activity Heatmap | 6-month CSS Grid heatmap, colour-coded by daily climb count |
| Streaks | Current streak and longest streak (calendar days with ≥1 climb) |
| Training Summary | Total sessions, total hours, avg sessions/week |
| Training by Type | Bar chart of sessions grouped by type |



Shared with iOS app. All paths are under `users/{uid}/`:

| Path | Entity |
|------|--------|
| `climbNotes/{id}` | Climb note (send or project) |
| `climbNotes/{id}/ascents/{id}` | Repeat ascent sub-collection |
| `climbNotes/{id}/photos/{id}` | Photo metadata sub-collection |
| `trainingSessions/{id}` | Training session |

All user documents include `updatedAt` (server timestamp) and soft-delete via `deletedAt`.

**Global collection** (not scoped to a user):

| Path | Entity |
|------|--------|
| `routes/{id}` | Central Route Database entry (shared across all users) |

## Send Types

Aligned with iOS app: `Redpoint`, `Pinkpoint`, `On Sight`, `Top Rope`, `All Free`, `Project`.

Color coding: Redpoint=red, On Sight=green, Pinkpoint=pink, Top Rope=slate, All Free=purple.

## Partner API Keys

Users can generate personal API keys from **Account → API Keys** to give third-party apps read access to their data. Keys are scoped (`climbs:read`, `training:read`, `goals:read`) and can be revoked at any time.

- `firebase-api-keys.js` wraps the three key management REST endpoints (`POST /v1/keys`, `GET /v1/keys`, `DELETE /v1/keys/:id`)
- The raw key is shown exactly once in a one-time display overlay after creation — it is never stored in Firestore in plaintext
- Full API reference: [`docs/api.md`](docs/api.md)

## Central Route Database

A shared, global Firestore collection (`routes/`) that lives outside the per-user path. Any logged-in user can search for and link to an existing route, or create a new one. This enables cross-user statistics (e.g. total sends on a route) without duplicating route metadata in every user's document.

### How it works

1. A **🔍 icon** appears next to the "Route Name" label in the log form. Clicking it opens a search overlay.
2. Typing in the overlay queries `searchRoutes()`, which prefix-searches on the route name and crag using folded (lowercase, diacritic-stripped) search fields.
3. Selecting a result **pre-fills** the form's name, crag, area, and grade fields.
4. A **"Create new route"** option is always available at the bottom of results if the route doesn't exist yet.
5. On save, `centralRouteID` is written to the `climbNote` document and the matching route's counter is incremented atomically.
6. **Drift detection:** if the user edits name, crag, or area after linking, `shouldClearSoftLink()` detects the mismatch and silently clears `centralRouteID` before saving.
7. **👤 icon** appears next to routes in search results and edit overlays when the logged-in user is the creator.

### `routes/{id}` document schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display route name |
| `crag` | string | Crag / cliff name |
| `climbingArea` | string | Broader area (region) |
| `grade` | string | Canonical French grade |
| `sendCount` | number | Atomic counter — incremented/decremented on save/delete |
| `projectCount` | number | Atomic counter — incremented/decremented when saved as Project |
| `createdBy` | string | UID of the user who created the route |
| `createdAt` | timestamp | Server timestamp |
| `nameFolded` | string | Lowercase, diacritic-stripped name (for prefix search) |
| `cragFolded` | string | Lowercase, diacritic-stripped crag (for prefix search) |

### `firebase-routes.js` API

| Function | Description |
|----------|-------------|
| `searchRoutes(query, options)` | Prefix-search by name/crag; returns id, name, crag, climbingArea, grade, sendCount, projectCount, createdBy |
| `createCentralRoute(data)` | Creates a new route doc with grade normalization and folded search fields |
| `incrementSendCount(id)` / `decrementSendCount(id)` | Atomic send counter update |
| `incrementProjectCount(id)` / `decrementProjectCount(id)` | Atomic project counter update |
| `completedProject(id)` | Atomic: decrement projectCount + increment sendCount in a single write |
| `shouldClearSoftLink(linked, current)` | Returns `true` if form fields have drifted from the linked route |

Grade normalization: input is stored as a canonical French grade. YDS and UIAA input is detected and converted automatically before writing to Firestore.

## Development

### Mock Mode (no login required)

```bash
cd WebSite/sendlogwebsite
python3 -m http.server 8080
# Open: http://localhost:8080/app/?mock=true
```

Mock mode loads `mock.js` instead of Firebase, which overrides all data calls with in-memory fixtures. No authentication or network access required.

| Mocked data | Detail |
|-------------|--------|
| Climbs | 22 sample sends and projects across various grades and areas |
| Training sessions | 14 sample sessions across all session types |
| API keys | 2 pre-seeded keys; generate/revoke fully functional in-memory |

### Production

Requires Firebase project with:
- Firestore database
- Firebase Auth with Sign In with Apple enabled
- `firebase-config.js` with your project credentials (not committed)

## Known Limitations

- Photos: iOS app uploads/downloads photos via Firebase Storage. Web app reads photo metadata but has no upload UI yet.
- Scale: per-note sub-collection fetches; tested up to ~200 notes.
- Central Route Database: web-only for now; iOS app does not yet read or write `centralRouteID` or increment route counters (implementation pending).

