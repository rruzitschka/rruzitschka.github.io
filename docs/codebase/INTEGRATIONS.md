# INTEGRATIONS — SendLog Web App

## Firebase (client SDK, import map → gstatic CDN)

- **Auth**: Apple sign-in (`firebase-auth.js`). Auth state gates all data
  access; `getCurrentUser()` is checked in every service call.
- **Firestore**: per-user collections `users/{uid}/climbNotes`,
  `users/{uid}/trainingSessions`, plus the shared `routes/` database.
  Remote-applied objects are filtered by `deletedAt`.
- **Storage**: route photos (`firebase-climbs.js` photo helpers).

## REST API v1 (Cloud Functions — code in the iOS repo `ClimbingNotes/functions`)

Base URL + auth: API key header, scoped (`climbs:read`, `training:read`,
`goals:read`). Endpoints:

| Endpoint | Notes |
| --- | --- |
| `GET /v1/climbs` | Paginated; includes `routeType`/`sendType` (gym values pass through), `sessionID` soft link (null when absent), optional `?include=gps` |
| `GET /v1/training` | Paginated; includes `gym` + `routes` (raw JSON string) for gym sessions |
| `GET /v1/goals` | Goals |
| `/v1/keys` | API key self-management |

Public API doc page: `pages/api.html` (part of the landing page — update it
together with API-changing releases, not before).

## Third-party

- **BigDataCloud** — reverse geocoding for the admin "Save GPS Pin" action
  (`reverse-geocode.js`), overwrites any existing country value.
- **Leaflet** (CDN) — map in the admin route browser.
- **Chart.js** (CDN) — stats charts.

## Cross-repo contracts

- `routes/` central DB is shared with the iOS app; folding contracts
  (`nameSearch`/`cragSearch`/`areaSearch`/`recentEdits`) and the composite
  index order must not change unilaterally.
- Firestore data written here must stay iOS-decodable (tolerant decoders
  exist, but field names/enums are fixed — see CONVENTIONS).
