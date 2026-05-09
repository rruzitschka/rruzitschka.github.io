# SendLog Web App

A companion web dashboard for the ClimbingNotes iOS app. Provides a browser-based view of your climbing logbook with full CRUD support for climb notes, ascents, training sessions, and the shared central route database — including community average ratings contributed by all users across iOS and web.

## Tech Stack

- **Vanilla HTML/CSS/JavaScript** — no framework, no build step
- **Firebase JS SDK 12.12.1** (modular CDN via import map) — Firestore, Auth, Storage
- **Chart.js 4.4.2** (CDN) — grade distribution and route type bar charts
- **Sign In with Apple** via Firebase Auth

## Architecture

```
app/
├── index.html               Main dashboard (auth gate + app shell)
├── login.html               Sign In with Apple landing page
├── css/
│   └── app.css              Design system (variables, components, overlays)
└── js/
    ├── firebase-config.js   Firebase init — exports db, auth, app, storage
    ├── firebase-auth.js     initAuth(), signInWithApple(), signOut(), getCurrentUser()
    ├── firebase-climbs.js   fetchClimbs(), saveClimbNote(), saveAscent(), computeStats(), filterClimbs()
    ├── firebase-training.js fetchTrainingSessions(), saveTrainingSession(), computeTrainingStats()
    ├── grades.js            GRADES arrays, detectGradeSystem() — shared grade logic (regular script)
    ├── stats.js             Client-side stats: summary, grade distribution, route types, heatmap, streaks (regular script)
    ├── firebase-routes.js   Central Route Database service — search, create, link, owner update, admin ops
    ├── firebase-api-keys.js API key management — create, list, revoke partner API keys
    ├── admin.js             Admin panel — route moderation, ownership transfer, audit trail
    ├── ui.js                All DOM rendering, overlays, event handlers, view routing
    └── mock.js              Mock mode — exports mock implementations of all Firebase service functions
```

### Module system

All `firebase-*.js`, `admin.js`, and `ui.js` are **ES modules** loaded via a `<script type="importmap">` in `index.html` that maps bare specifiers (`firebase/app`, `firebase/firestore`, etc.) to the Firebase 12.12.1 CDN URLs. There is no build step or bundler — modules are resolved natively by the browser.

`grades.js` and `stats.js` remain regular `<script>` tags (no imports/exports needed) and are loaded before any module scripts. They expose globals on `window` (`window.GRADES`, `window.detectGradeSystem`, etc.) that ES modules access at runtime.

The single entry-point module is an inline `<script type="module">` at the bottom of `index.html`. It imports from `firebase-auth.js` and `ui.js`, which cascade all other imports. In mock mode (`?mock=true`) it dynamically imports `mock.js` and calls `setMockServices()` to swap all Firebase bindings before `loadData()` runs.

## Views

| View | Description |
|------|-------------|
| **Logbook** | Full send log with grade badges, ascent type chips, and route detail overlay |
| **Projects** | Routes marked as Project with progress notes |
| **Training** | Training session log with duration and type; summary stats (total sessions, hours, avg/week) |
| **Statistics** | Client-side analytics dashboard (see below) |
| **Account** | Sign-in status, grade preference, data export, API key management, danger zone |
| **Admin** | *(admin users only)* Central route database moderation panel — visible only when the signed-in user is in the `admins` Firestore collection |

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

## Firestore Data Model

Shared with the iOS app. All paths under `users/{uid}/`:

| Path | Entity |
|------|--------|
| `users/{uid}` | User registration doc — written on first web sign-in and first iOS sync. Fields: `uid`, `registeredAt`, `lastSeenWeb` / `lastSeenIOS` |
| `climbNotes/{id}` | Climb note (send or project) |
| `climbNotes/{id}/ascents/{id}` | Repeat ascent sub-collection |
| `climbNotes/{id}/photos/{id}` | Photo metadata sub-collection |
| `trainingSessions/{id}` | Training session |

All user documents include `updatedAt` (server timestamp) and soft-delete via `deletedAt`.

**Global collections** (not scoped to a user):

| Path | Entity |
|------|--------|
| `routes/{id}` | Central Route Database entry (shared across all users) |
| `admins/{uid}` | Admin roster — presence of a document grants admin privileges |

## Send Types

Aligned with iOS app: `Redpoint`, `Pinkpoint`, `On Sight`, `Top Rope`, `All Free`, `Project`.

Color coding: Redpoint=red, On Sight=green, Pinkpoint=pink, Top Rope=slate, All Free=purple.

## Partner API Keys

Users can generate personal API keys from **Account → API Keys** to give third-party apps read access to their data. Keys are scoped (`climbs:read`, `training:read`, `goals:read`) and can be revoked at any time.

- `firebase-api-keys.js` wraps the three key management REST endpoints (`POST /v1/keys`, `GET /v1/keys`, `DELETE /v1/keys/:id`)
- The raw key is shown exactly once in a one-time display overlay after creation — it is never stored in Firestore in plaintext
- Full API reference: [`docs/api.md`](docs/api.md)

---

## Central Route Database

A shared, global Firestore collection (`routes/`) that lives outside the per-user path. Any logged-in user can search for and link to an existing route, or create a new one. This enables cross-user statistics (e.g. total sends on a route) without duplicating route metadata in every user's document.

### Linking a route

1. A **🔍 icon** appears next to the Route Name field in the log send and add project overlays. Clicking it opens a search overlay.
2. Typing queries `searchRoutes()`, which prefix-searches on name and crag using folded (lowercase, diacritic-stripped) search fields.
3. Selecting a result **pre-fills** the form's name, crag, area, grade, and route type fields.
4. A **"Create new route"** option is available at the bottom of results if the route doesn't exist yet. A duplicate-name warning is shown before creating.
5. On save, `centralRouteID` is written to the `climbNote` document and the matching route's counter is incremented atomically.

### Community database indicator

When viewing the detail modal for a climb that is linked to a central route, a **☁ In community database** chip appears below the area/crag line. If the signed-in user is the creator of that route, a **👤** icon is appended to the chip (resolved asynchronously on modal open).

### Community average rating

Every send linked to a central route can contribute a star rating (1–5) to a shared community average. The average is stored as `ratingSum` / `ratingCount` on the `routes/` document and computed client-side.

- **Climbs list:** a `(X.X)` suffix appears next to the personal stars for any climb linked to a rated route. Ratings are batch-fetched once per session using `fetchCommunityRatings()` and cached in memory — no extra reads on re-render.
- **Detail modal:** `(X.X)` appears next to the personal star rating, fetched asynchronously via `getRoute()` on modal open.
- **Route search overlay:** rated routes show `· ★ X.X` in their send/project count line.
- **Delta writes:** edits use a delta strategy (`ratingDeltas()`) so only the change is written — no read-modify-write cycle. Link clears retract the previous contribution.
- **`reportedRating` field:** stored on each `climbNote` document to track what was last reported, preventing double-counting across devices and sessions. Cross-platform compatible — iOS writes the same field via `FirestoreSyncManager`.
- **One-time bootstrap:** on first load, any existing linked sends with `rating > 0` and `reportedRating == 0` are retroactively reported and their `reportedRating` persisted. Gated by a `localStorage` flag so it never runs twice.

### Drift detection

If the user edits the name, crag, or area fields after linking a route:
- **Non-owners:** `shouldClearSoftLink()` detects the mismatch and clears `centralRouteID` before saving. The 🔍 button resets to unlinked.
- **Owners:** the link is **preserved** — the owner is editing their own route, so the changes are propagated back to the central route document on save (see below).

### Owner edit propagation

When the route creator edits a linked climb's identity fields (name, area, crag, grade, routeType) and saves, `updateCentralRoute()` is called fire-and-forget after `saveClimbNote()`. This keeps the central route document in sync with the creator's source of truth.

- All canonical fields are updated (including grade normalization to French, folded search fields)
- `updatedBy` and `updatedAt` are written
- A new entry is prepended to `recentEdits` (see schema below)
- Non-owners who attempt the same call receive a silent `PERMISSION_DENIED` from Firestore rules

### `routes/{id}` document schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display route name |
| `crag` | string | Crag / cliff name |
| `climbingArea` | string | Broader area (region) |
| `grade` | string | Canonical French grade |
| `createdGrade` | string | Grade as originally entered by creator |
| `createdGradeSystem` | string | Grade system of `createdGrade` (`French` / `YDS` / `UIAA`) |
| `routeType` | string | `Sport` / `Trad` / `Boulder` / etc. |
| `sendCount` | number | Atomic counter — incremented/decremented on save/delete |
| `projectCount` | number | Atomic counter — incremented/decremented when saved as Project |
| `attemptCount` | number | Atomic counter — incremented on attempt log |
| `ratingSum` | number | Running sum of all reported star ratings (1–5) across all contributors |
| `ratingCount` | number | Number of sends that have contributed a rating |
| `createdBy` | string | UID of the user who created the route |
| `createdAt` | timestamp | Server timestamp at creation |
| `updatedAt` | timestamp | Server timestamp of last write |
| `updatedBy` | string | UID of the user who last saved the route (owner or admin) |
| `nameSearch` | string | Lowercase, diacritic-stripped name (for prefix search) |
| `cragSearch` | string | Lowercase, diacritic-stripped crag (for prefix search) |
| `isOrphaned` | boolean | `true` if the creating user's account has been deleted |
| `orphanedAt` | timestamp | When the route was orphaned (null if not orphaned) |
| `recentEdits` | array (max 3) | Rolling log of the last 3 saves: `[{ editedAt, editedBy }]`, newest first |
| `lastOwnershipTransfer` | object / null | Last transfer record: `{ fromUID, toUID, transferredBy, transferredAt }` |

### `firebase-routes.js` public API

| Function | Description |
|----------|-------------|
| `searchRoutes(namePrefix, cragFilter, displaySystem, limit)` | Prefix-search by name; optional crag filter; returns grade converted to display system |
| `createCentralRoute(data)` | Creates a new route doc with grade normalization and search fields; sets `createdBy` to current user |
| `updateCentralRoute(routeID, fields)` | Fire-and-forget owner update — syncs identity fields + audit trail via transaction |
| `incrementSendCount(id)` | Atomic send counter increment |
| `decrementProjectCount(id)` / `incrementProjectCount(id)` | Atomic project counter updates |
| `completedProject(id)` | Atomic: decrement projectCount + increment sendCount in a single write |
| `shouldClearSoftLink(original, current)` | Returns `true` if form fields have drifted from the linked route |
| `checkAdminStatus()` | Async; returns `true` if current user is in the `admins` collection. Cached per session. |
| `adminSaveRoute(routeID, fields)` | Admin: update any route including `createdBy` and `isOrphaned`; writes audit trail via transaction |
| `adminDeleteRoute(routeID)` | Admin: hard-delete a route document |
| `getRoute(routeID)` | Fetch a single route document with all fields including `recentEdits`, `lastOwnershipTransfer`, and computed `communityRating` |
| `fetchCommunityRatings(routeIDs)` | Batch-fetch community ratings for a list of route IDs; returns `Map<id, number>`; chunks of 30 using `documentId()` — mirrors iOS `RouteRepository.fetchCommunityRatings()` |
| `ratingDeltas(newRating, previousRating)` | Pure helper — returns `{sumDelta, countDelta}` or `null` (no-op); mirrors iOS `ratingDeltas(newRating:previousRating:)` |
| `reportRating(routeID, newRating, previousRating)` | Fire-and-forget delta write to `ratingSum`/`ratingCount` using `increment()` |

Grade normalization: all grades are stored as canonical French in the `grade` field. YDS and UIAA input is detected and converted automatically. The `displayGrade` in search results is converted back to the user's preferred system at query time.

---

## Admin Panel

The **⚙ Admin** sidebar item is hidden for all users by default. After login, `checkAdminStatus()` reads the `admins/{uid}` document; if it exists, the item becomes visible. The panel is located at `app/js/admin.js`.

### Security model

Security is enforced **server-side by Firestore rules**, not by the UI. Even if a non-admin user calls `adminSaveRoute()` or `adminDeleteRoute()` directly from the browser console, Firestore returns `PERMISSION_DENIED`. The `isAdmin()` helper in `firestore.rules` checks for the presence of `admins/{uid}` on every admin write/delete operation.

The admin UI being hosted on GitHub Pages (a public static host) is therefore safe — the rules are the enforcement boundary, not the host.

### Seeding an admin

In the Firebase Console → Firestore, create the `admins` collection with a document whose **ID is the target user's UID** and any field (e.g. `role: "admin"`). No code or Cloud Function is required. To revoke admin access, delete the document.

### Admin capabilities

| Feature | Description |
|---------|-------------|
| **Route search** | Same prefix search as the main app; results show send/project counts and orphan badge |
| **Orphaned filter** | Checkbox to show only orphaned routes (e.g. after account deletion) |
| **Edit any route** | Name, area, crag, grade, route type — all fields editable regardless of ownership |
| **Transfer ownership** | Paste any user UID into the Owner UID field and save; `lastOwnershipTransfer` is recorded |
| **Transfer to me** | One-click button pre-fills the Owner UID field with the current admin's UID |
| **Orphan / unorphan** | Checkbox to manually set `isOrphaned` status |
| **Delete route** | Hard-delete with confirmation dialog; blocked for non-admins by Firestore rules |
| **Audit trail** | Edit form shows the rolling last-3-edits list (timestamp + UID) and the last ownership transfer record |

### Audit trail fields

All saves — whether by the route owner or an admin — write:
- `updatedBy`: UID of the person who saved
- An entry prepended to `recentEdits` (max 3, oldest dropped automatically)

Ownership transfers additionally write `lastOwnershipTransfer` with `fromUID`, `toUID`, `transferredBy` (the admin's UID), and `transferredAt`. This is a single object that is overwritten on each transfer — it records the most recent transfer only.

---

## Development

### Local server

Python 3.14's `http.server` has a known bug (empty responses). Use the included Node.js server instead:

```bash
cd WebSite/sendlogwebsite
node serve.js . 8080
```

Leave the terminal open while testing. `serve.js` is git-ignored.

### Mock Mode (no login required)

```
http://localhost:8080/app/?mock=true
```

`mock.js` exports mock implementations of all Firebase service functions. The init script dynamically imports it and calls `setMockServices()` to replace the real Firebase bindings before `loadData()` runs — no network calls are made.

| Mocked data | Detail |
|-------------|--------|
| Climbs | 22 sample sends and projects across various grades and areas |
| Training sessions | 14 sample sessions across all session types |
| API keys | 2 pre-seeded keys; generate/revoke fully functional in-memory |

### Production

Requires Firebase project with:
- Firestore database with rules deployed from `Firebase/firestore.rules`
- Firebase Auth with Sign In with Apple enabled
- `firebase-config.js` with your project credentials (not committed)
- *(Optional)* An `admins/{uid}` document for each admin user

## Known Limitations

- **Photos:** iOS app uploads/downloads photos via Firebase Storage. Web app reads and displays photo metadata but has no upload UI.
- **Scale:** per-note sub-collection fetches tested up to ~200 notes.
- **Ownership transfer by UID only:** the admin panel requires pasting a user UID. Email-to-UID lookup is not available client-side and would require a Cloud Function.
