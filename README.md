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
    └── mock.js             Mock mode — overrides all Firebase calls with local data
```

## Views

| View | Description |
|------|-------------|
| **Logbook** | Full send log with grade badges, ascent type chips, and route detail overlay |
| **Projects** | Routes marked as Project with progress notes |
| **Training** | Training session log with duration and type; summary stats (total sessions, hours, avg/week) |
| **Statistics** | Client-side analytics dashboard (see below) |
| **Account** | Sign-in status, sign out |

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

All documents include `updatedAt` (server timestamp) and soft-delete via `deletedAt`.

## Send Types

Aligned with iOS app: `Redpoint`, `Pinkpoint`, `On Sight`, `Top Rope`, `All Free`, `Project`.

Color coding: Redpoint=red, On Sight=green, Pinkpoint=pink, Top Rope=slate, All Free=purple.

## Development

### Mock Mode (no login required)

```bash
cd app/
python3 -m http.server 8765
# Open: http://localhost:8765/?mock=true
```

Mock mode loads `mock.js` instead of Firebase, which overrides all data calls with 15 sample climbs. No authentication required.

### Production

Requires Firebase project with:
- Firestore database
- Firebase Auth with Sign In with Apple enabled
- `firebase-config.js` with your project credentials (not committed)

## Known Limitations

- Photos: iOS app uploads/downloads photos via Firebase Storage. Web app reads photo metadata but has no upload UI yet.
- Scale: per-note sub-collection fetches; tested up to ~200 notes.

