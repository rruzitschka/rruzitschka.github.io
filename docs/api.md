# SendLog Partner API — Reference

**Base URL:** `https://api-hoxktcdqvq-uc.a.run.app`

The SendLog Partner API gives third-party apps and scripts read access to a user's climbing data. Access is granted via **API keys** that the user generates themselves from the SendLog Web App at [sendlog.at/app](https://sendlog.at/app). No OAuth flow is required for the data endpoints — just include the key in a header.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Pagination](#pagination)
4. [Errors](#errors)
5. [Data Endpoints](#data-endpoints)
   - [GET /v1/climbs — List climbs](#get-v1climbs)
   - [GET /v1/climbs/:id — Get climb](#get-v1climbsid)
   - [GET /v1/training — List training sessions](#get-v1training)
   - [GET /v1/goals — List goals](#get-v1goals)
6. [Incremental Sync](#incremental-sync)
7. [Examples](#examples)

---

## Authentication

All requests must include the user's API key in the `X-API-Key` header:

```
X-API-Key: cnl_your_key_here
```

Users generate keys in the SendLog Web App under **My Account → API Keys**.

---

## Rate Limiting

Each API key is limited to **1 000 requests per hour**. The window resets on a rolling basis.

When the limit is exceeded the API returns:

```
HTTP 429 Too Many Requests
{ "error": "Rate limit exceeded (1000 req/hour)" }
```

---

## Pagination

List endpoints that can return large result sets support cursor-based pagination.

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Results per page. Min 1, max 100, default 50. |
| `after` | string | Opaque cursor returned as `nextCursor` in the previous response. |

**Response envelope:**

```json
{
  "data": [ ... ],
  "nextCursor": "eyJpZCI6Ii4uLiJ9",
  "hasMore": true
}
```

When `hasMore` is `false`, `nextCursor` is `null` and you have reached the last page.

---

## Errors

All errors return a JSON body with an `error` field:

```json
{ "error": "Human-readable description" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — invalid query parameter (e.g. non-ISO8601 date) |
| `401` | Missing or invalid credentials |
| `403` | Valid key but missing required scope |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Data Endpoints

All data endpoints return data belonging to the user who generated the key.

---

### GET /v1/climbs

List climb notes (sends and projects). Returns results ordered by `date` ascending by default, or by `updatedAt` ascending when `since` is used.

**Required scope:** `climbs:read`

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Results per page (1–100, default 50) |
| `after` | string | Pagination cursor from `nextCursor` |
| `from` | ISO8601 date | Only climbs on or after this date |
| `to` | ISO8601 date | Only climbs on or before this date |
| `since` | ISO8601 datetime | Only records updated after this timestamp (for incremental sync). Mutually exclusive with `from`/`to`. |
| `include` | string | Comma-separated list of optional fields. Currently supported: `gps`. |

**Example request:**

```bash
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/climbs?from=2026-01-01&limit=20" \
  -H "X-API-Key: cnl_your_key_here"
```

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "abc123",
      "route": "Biographie",
      "climbingArea": "Céüse",
      "crag": "La Face",
      "difficulty": "9a",
      "sendType": "Redpoint",
      "routeType": "Sport",
      "noteText": "Dream route, finally!",
      "rating": 5,
      "attemptCount": 47,
      "date": "2026-08-15T00:00:00.000Z",
      "lastAttemptDate": null,
      "projectStatus": null,
      "projectNotes": null,
      "highPoint": null,
      "centralRouteID": "rTeho8rot8CTj9kEvZE4",
      "updatedAt": "2026-08-15T18:30:00.000Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

**Climb object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Firestore document ID |
| `route` | string | Route name |
| `climbingArea` | string | Broader area / region |
| `crag` | string \| null | Specific crag or wall |
| `difficulty` | string | Grade in the user's preferred system |
| `sendType` | string | `Redpoint` · `Pinkpoint` · `On Sight` · `Flash` · `Top Rope` · `All Free` · `Project` |
| `routeType` | string | `Sport` · `Boulder` · `Multi-Pitch` |
| `noteText` | string \| null | Free-text notes |
| `rating` | integer | 0–5 stars (user's personal rating) |
| `attemptCount` | integer | Number of attempts |
| `date` | ISO8601 \| null | Send date (null for active projects) |
| `lastAttemptDate` | ISO8601 \| null | Last attempt date (projects) |
| `projectStatus` | string \| null | `Working` · `Close` · `On Hold` (projects) |
| `projectNotes` | string \| null | Project-specific notes |
| `highPoint` | string \| null | Highest point reached (projects) |
| `centralRouteID` | string \| null | ID of the linked entry in the SendLog central route database, or `null` if the route has not been linked |
| `updatedAt` | ISO8601 \| null | Last modification timestamp |

#### Optional: GPS coordinates (`?include=gps`)

Add `?include=gps` to include GPS coordinates sourced from the SendLog central route database. When requested, each climb object gains a `gps` field:

- **`gps`** is a coordinates object if the linked central route has GPS stored.
- **`gps`** is `null` if the climb has no `centralRouteID`, or if the central route does not yet have GPS coordinates.
- Without `?include=gps` the `gps` key is **absent entirely** — existing integrations are unaffected.

GPS coordinates are sourced from the central route, not from the user's own record, so they reflect community-contributed data.

```bash
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/climbs?include=gps" \
  -H "X-API-Key: cnl_your_key_here"
```

```json
{
  "data": [
    {
      "id": "abc123",
      "route": "Biographie",
      "centralRouteID": "rTeho8rot8CTj9kEvZE4",
      "gps": {
        "latitude": 44.1823,
        "longitude": 5.9714,
        "country": "FR"
      },
      ...
    },
    {
      "id": "def456",
      "route": "My Local Project",
      "centralRouteID": null,
      "gps": null,
      ...
    }
  ]
}
```

**GPS object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `latitude` | number | WGS84 latitude |
| `longitude` | number | WGS84 longitude |
| `country` | string \| null | ISO 3166-1 alpha-2 country code (e.g. `"AT"`, `"FR"`) |

---

### GET /v1/climbs/:id

Get a single climb note with its full ascent history. Supports the same `?include=gps` option as the list endpoint.

**Required scope:** `climbs:read`

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string | Optional fields. `gps` fetches GPS coordinates from the central route database. |

**Example request:**

```bash
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/climbs/abc123?include=gps" \
  -H "X-API-Key: cnl_your_key_here"
```

**Response `200 OK`:**

Same fields as the list item, plus an `ascents` array (and `gps` if requested):

```json
{
  "id": "abc123",
  "route": "Biographie",
  "centralRouteID": "rTeho8rot8CTj9kEvZE4",
  "gps": {
    "latitude": 44.1823,
    "longitude": 5.9714,
    "country": "FR"
  },
  "ascents": [
    {
      "id": "asc-uuid-1",
      "sendType": "Redpoint",
      "date": "2026-09-10T00:00:00.000Z",
      "notes": "Even better second time"
    }
  ]
}
```

**Ascent object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Ascent UUID |
| `sendType` | string | Send type for this repeat ascent |
| `date` | ISO8601 \| null | Date of the repeat ascent |
| `notes` | string \| null | Notes specific to this ascent |

Returns `404` if the climb does not exist or has been deleted.

---

### GET /v1/training

List training sessions, ordered by `date` ascending (or `updatedAt` when `since` is used).

**Required scope:** `training:read`

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Results per page (1–100, default 50) |
| `after` | string | Pagination cursor |
| `from` | ISO8601 date | Sessions on or after this date |
| `to` | ISO8601 date | Sessions on or before this date |
| `since` | ISO8601 datetime | Incremental sync — records updated after this timestamp |

**Example request:**

```bash
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/training?from=2026-01-01" \
  -H "X-API-Key: cnl_your_key_here"
```

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "ts-uuid-1",
      "type": "Hangboard",
      "duration": 45,
      "intensity": 4,
      "notes": "Max hangs protocol, 20mm edge.",
      "date": "2026-03-20T00:00:00.000Z",
      "updatedAt": "2026-03-20T19:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

**Training session fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Session UUID |
| `type` | string | `Hangboard` · `Campus Board` · `Gym Session` · `Running` · `Yoga` · or custom |
| `duration` | integer | Duration in minutes |
| `intensity` | integer | 1–5 intensity rating |
| `notes` | string \| null | Free-text notes |
| `date` | ISO8601 \| null | Session date |
| `updatedAt` | ISO8601 \| null | Last modification timestamp |

---

### GET /v1/goals

List goals. Does not support pagination (goal counts are typically small). Supports `since` for incremental sync.

**Required scope:** `goals:read`

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `since` | ISO8601 datetime | Only goals updated after this timestamp |

> **Note:** Goals that have never been modified after their initial creation may have `updatedAt: null`. Because `since` filters on this field, those goals will not appear in `since` responses — they are only returned by the unfiltered endpoint (`GET /v1/goals` with no parameters). This affects goals created on older app versions before update timestamps were introduced.

**Example request:**

```bash
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/goals" \
  -H "X-API-Key: cnl_your_key_here"
```

**Response `200 OK`:**

```json
{
  "data": [
    {
      "id": "goal-uuid-1",
      "type": "targetGradeByDate",
      "target": 0,
      "periodIsWeekly": false,
      "gradeTarget": "8a",
      "deadline": "2026-12-31T00:00:00.000Z",
      "achievedAt": null,
      "isArchived": false,
      "completedPeriods": [],
      "updatedAt": "2026-04-01T10:00:00.000Z"
    },
    {
      "id": "goal-uuid-2",
      "type": "climbingDaysPerPeriod",
      "target": 3,
      "periodIsWeekly": true,
      "gradeTarget": null,
      "deadline": null,
      "achievedAt": null,
      "isArchived": false,
      "completedPeriods": ["2026-W17", "2026-W18"],
      "updatedAt": "2026-05-01T08:00:00.000Z"
    }
  ]
}
```

**Goal fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Goal UUID |
| `type` | string | See goal types below |
| `target` | integer | Numeric target — number of days or sessions per period (ignored for `targetGradeByDate`) |
| `periodIsWeekly` | boolean | `true` = weekly period, `false` = monthly (applies to `climbingDaysPerPeriod`) |
| `gradeTarget` | string \| null | Target grade string (`targetGradeByDate` only) |
| `deadline` | ISO8601 \| null | Optional target date |
| `achievedAt` | ISO8601 \| null | When the goal was first achieved |
| `isArchived` | boolean | Whether the goal has been archived |
| `completedPeriods` | string[] | ISO week keys (e.g. `"2026-W17"`) or month keys for completed periods |
| `updatedAt` | ISO8601 \| null | Last modification timestamp |

**Goal types:**

| `type` value | Description |
|---|---|
| `climbingDaysPerPeriod` | Climbing at least `target` days per week or month |
| `trainingSessionsPerWeek` | Completing at least `target` training sessions per week |
| `targetGradeByDate` | Sending a route of grade `gradeTarget` by `deadline` |

---

## Incremental Sync

All list endpoints support a `since` parameter for efficient incremental sync. Pass the `updatedAt` value of the most recently seen record to fetch only records that changed after that point.

```bash
# Initial full fetch
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/climbs?limit=100" \
  -H "X-API-Key: cnl_your_key_here"

# Store the max updatedAt from the response, then on next run:
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/climbs?since=2026-04-30T12:00:00.000Z" \
  -H "X-API-Key: cnl_your_key_here"
```

When using `since`, results are ordered by `updatedAt` ascending. The `since` parameter is mutually exclusive with `from`/`to` on the climbs and training endpoints.

---

## Examples

### Fetch all sends from this year

```bash
API_KEY="cnl_your_key_here"
BASE="https://api-hoxktcdqvq-uc.a.run.app"

curl "$BASE/v1/climbs?from=2026-01-01&limit=100" \
  -H "X-API-Key: $API_KEY"
```

### Fetch climbs with GPS coordinates

```bash
curl "https://api-hoxktcdqvq-uc.a.run.app/v1/climbs?include=gps&limit=100" \
  -H "X-API-Key: cnl_your_key_here"
```

Only climbs linked to a central route that has GPS data will have a non-null `gps` object. You can filter these client-side:

```python
climbs_with_gps = [c for c in climbs if c.get("gps") is not None]
```

### Home dashboard in Python

```python
import requests

API_KEY = "cnl_your_key_here"
BASE    = "https://api-hoxktcdqvq-uc.a.run.app"
HEADERS = {"X-API-Key": API_KEY}

# Fetch all climbs (paginated)
climbs, cursor = [], None
while True:
    params = {"limit": 100}
    if cursor:
        params["after"] = cursor
    r = requests.get(f"{BASE}/v1/climbs", headers=HEADERS, params=params)
    r.raise_for_status()
    body = r.json()
    climbs.extend(body["data"])
    cursor = body.get("nextCursor")
    if not body.get("hasMore"):
        break

sends = [c for c in climbs if c["projectStatus"] is None]
print(f"Total sends: {len(sends)}")
print(f"Hardest grade: {max((c['difficulty'] for c in sends), default='—')}")
```
