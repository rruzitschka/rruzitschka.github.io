# Plan: Community Average Rating — Web App

> Mirrors `ClimbingNotes/docs/plan-community-rating.md` for the web app.
> All steps are self-contained commits that compile, do not break existing behaviour, and can be
> manually tested before moving on.

---

## Goal

When a web user logs or edits a send linked to a central route (`centralRouteID` is set) and
enters a star rating (1–5), that rating is reported to the central `routes/` Firestore document.
The central document maintains a running average across all contributors (iOS + web), displayed as:

- `(X.X)` next to the personal star rating in the **main climbs list** (batch-fetched once per session)
- `(X.X)` next to each route in the **route search overlay**
- `(X.X)` next to the personal star rating in the **send detail modal**

---

## Key Design Decisions

### Storage — unchanged from iOS plan
`ratingSum: Int` and `ratingCount: Int` on each `routes/` document.
`communityRating` is computed client-side: `ratingSum / ratingCount`.
All writes use `increment()` — fire-and-forget, no Cloud Functions.

### `reportedRating` lives in Firestore
iOS stores `reportedRating` in Core Data. On web, the only persistence layer is Firestore
(`users/{uid}/climbNotes/{id}`). So `reportedRating` is read back via `fetchClimbs` and
written by `saveClimbNote`, exactly like `rating` and `centralRouteID`.

### Cross-platform compatibility
iOS's `FirestoreSyncManager` already writes and reads `reportedRating` (iOS Step 3 done).
Web reads the same field from the same Firestore path — no schema changes needed.
When the iOS app sets `reportedRating = 4` on a send, the web reads `reportedRating: 4` on
next load and uses it as `previousReportedRating` in its own edit flow.

### Delta update logic — identical to iOS

| Scenario | `ratingSum` delta | `ratingCount` delta |
|---|---|---|
| New send, rating > 0 | + newRating | + 1 |
| Edit: rating A → B (both > 0) | + (B − A) | 0 |
| Edit: rating A → 0 (unset) | − A | − 1 |
| Edit: rating 0 → B | + B | + 1 |
| No rating (0 → 0) | no-op | no-op |

### Tracking the previous rating in the edit overlay
When opening the edit send overlay, we capture `_previousReportedRating` and
`_originalCentralRouteID` from the loaded `climb` object. These are locked in at open-time,
not at save-time.

### Link handling on edit — three simple cases (mirrors iOS)
1. **Link intact** (`centralID === _originalCentralRouteID`): delta update.
2. **Link cleared** (`centralID` is null, `_originalCentralRouteID` was set): retract previous rating.
3. **New link / no previous link** (`_originalCentralRouteID` is null, `centralID` set): report fresh (previousRating = 0).

The edge case of swapping to a completely different route (old → new) is handled as:
retract from old (case 2) then report fresh to new (previousRating = 0). No delta tracking
across routes — keeps the logic simple and predictable.

### Community ratings in the climbs list — batch fetch, session cache
Mirrors `SendLogsView` / `RouteRepository.fetchCommunityRatings()` on iOS exactly:
- After `fetchClimbs()`, collect unique `centralRouteID` values from all climbs.
- Batch-fetch `routes/` documents using `where(documentId(), 'in', batch)` (≤ 30 per query),
  matching iOS's `whereField(FieldPath.documentID(), in: batch)`.
- Store results in a module-level `Map<routeID, communityRating|null>` (`_communityRatings`).
- Guard with `if (_communityRatings.size > 0) return` — fetches once per session.
- Re-render the table after the async fetch completes (two-pass render: personal stars
  appear immediately; community ratings fill in within milliseconds).
- Only routes with `ratingCount > 0` are stored in the map (same as iOS — routes without
  ratings are simply absent from the map, rendering no suffix).

### Bootstrap — one-time retroactive reporting
Existing web sends may have `centralRouteID` set and `rating > 0` but `reportedRating == 0`.
At load time, a one-time scan reports unreported ratings and persists `reportedRating` to
Firestore. Gated by `localStorage["hasBootstrappedCommunityRatings"]` (mirrors iOS
`UserDefaults["hasBootstrappedCommunityRatings"]`).

### Projects never contribute ratings
Only sends (`sendType !== 'Project'`) contribute to `ratingSum` / `ratingCount`.
`reportedRating` is always `0` for project entries.

### Rating = 0 means "no rating"
Ratings of 0 are excluded from the community average. Only ratings 1–5 are counted.

---

## Implementation Steps

---

### Step 1 — `firebase-routes.js`: Add `ratingDeltas` helper + `reportRating` function

**File:** `app/js/firebase-routes.js`

```javascript
// ── Community rating ───────────────────────────────────────────────────────

/**
 * Compute the increment deltas needed to update ratingSum / ratingCount.
 * Returns null when no write is needed (no-op case).
 * Mirrors RouteRepository.ratingDeltas(newRating:previousRating:) in iOS.
 */
export function ratingDeltas(newRating, previousRating) {
  const n = newRating      ?? 0;
  const p = previousRating ?? 0;
  if (n === p) return null;                              // unchanged — no-op

  if (p === 0 && n > 0) return { sumDelta: n,     countDelta:  1 };  // first rating
  if (n === 0 && p > 0) return { sumDelta: -p,    countDelta: -1 };  // rating removed
  return                        { sumDelta: n - p, countDelta:  0 };  // changed
}

/**
 * Report a rating change to the central route document.
 * Fire-and-forget — never throws or blocks the caller.
 * Mirrors RouteRepository.reportRating(routeID:newRating:previousRating:) in iOS.
 */
export function reportRating(routeID, newRating, previousRating) {
  const deltas = ratingDeltas(newRating, previousRating);
  if (!deltas) return;

  const fields = { updatedAt: serverTimestamp() };
  if (deltas.sumDelta   !== 0) fields.ratingSum   = increment(deltas.sumDelta);
  if (deltas.countDelta !== 0) fields.ratingCount = increment(deltas.countDelta);

  updateDoc(doc(db, 'routes', routeID), fields)
    .catch(err => console.warn('reportRating failed:', err));
}
```

**How to test (browser console):**
- `ratingDeltas(4, 0)`  → `{ sumDelta: 4,  countDelta: 1 }`  ✓
- `ratingDeltas(5, 4)`  → `{ sumDelta: 1,  countDelta: 0 }`  ✓
- `ratingDeltas(0, 3)`  → `{ sumDelta: -3, countDelta: -1 }` ✓
- `ratingDeltas(3, 3)`  → `null`                             ✓

---

### Step 2 — `firebase-routes.js`: Expose `ratingSum` / `ratingCount` / `communityRating`

**File:** `app/js/firebase-routes.js`

**2a. `createCentralRoute`** — add to the initial `setDoc` payload:
```javascript
ratingSum:   0,
ratingCount: 0,
```

**2b. `searchRoutes`** — add to each result object in `.map()`:
```javascript
ratingSum:      d.ratingSum   ?? 0,
ratingCount:    d.ratingCount ?? 0,
communityRating: (d.ratingCount ?? 0) > 0
  ? (d.ratingSum ?? 0) / (d.ratingCount ?? 0)
  : null,
```

**2c. `getRoute`** — add the same three fields to the returned object.

**Backwards compatible:** `?? 0` fallback means old routes without these fields return
`ratingSum: 0, ratingCount: 0, communityRating: null`.

**How to test:**
- `searchRoutes("test")` → result objects have `ratingSum`, `ratingCount`, `communityRating` ✓
- A route without ratings → `communityRating: null` ✓

---

### Step 3 — `firebase-climbs.js`: Read and write `reportedRating`

**File:** `app/js/firebase-climbs.js`

**3a. `fetchClimbs`** — add to the climb object in `.map()`:
```javascript
reportedRating: d.reportedRating ?? 0,
```

**3b. `saveClimbNote`** — add to `docData` (always written, defaults to 0):
```javascript
reportedRating: note.reportedRating ?? 0,
```

**How to test:**
- Reload; `window.allClimbs[0].reportedRating` exists (0 or a real value) ✓
- Save any send; Firestore document gains `reportedRating` field ✓

---

### Step 4 — `ui.js`: Track `_previousReportedRating` and `_originalCentralRouteID`

**File:** `app/js/ui.js`

Add to the module-level state variables (alongside the existing `_centralRouteID` block):
```javascript
let _previousReportedRating = 0;    // reportedRating when edit overlay was opened
let _originalCentralRouteID = null; // centralRouteID when edit overlay was opened
```

Reset both in every `closeOverlay()` (send and project overlays).

**`showAddSendOverlay`** (new send): set both to `0` / `null`.

**`showEditSendOverlay`** (edit send): set from the loaded climb:
```javascript
_previousReportedRating = climb.reportedRating ?? 0;
_originalCentralRouteID = climb.centralRouteID ?? null;
```

No visible UI change — internal state only.

**How to test:**
- Temporarily `console.log(_previousReportedRating, _originalCentralRouteID)` at overlay open.
- Edit a send with `reportedRating = 3` → logs `3, "route-uuid"` ✓
- Add a new send → logs `0, null` ✓

---

### Step 5 — `ui.js`: Report rating on new send save

**File:** `app/js/ui.js`

Import `reportRating` from `./firebase-routes.js`.

In the `send-overlay-save` handler, update the `saveClimbNote` call to include `reportedRating`,
then fire the community rating report after save:

```javascript
await saveClimbNote({
  // ... existing fields ...
  rating:         currentStarRating,
  reportedRating: (centralID && currentStarRating > 0) ? currentStarRating : 0,
  centralRouteID: centralID ?? null,
});

// Community rating — fire-and-forget, new sends always have previousRating = 0
if (centralID && currentStarRating > 0) {
  reportRating(centralID, currentStarRating, 0);
}
```

**Edge cases:**
- No central link → `reportedRating: 0`, no `reportRating` call.
- Rating = 0 → `reportedRating: 0`, no `reportRating` call.
- Mark-as-sent from project: treated as new send (`previousRating = 0`).

**How to test:**
- Log a new send linked to a central route with rating 4.
- Firestore `routes/{id}`: `ratingSum: 4, ratingCount: 1` ✓
- Firestore `users/{uid}/climbNotes/{id}`: `reportedRating: 4` ✓
- Send with no link, rating 3 → central route unchanged ✓
- Send with link, rating 0 → central route unchanged ✓

---

### Step 6 — `ui.js`: Report rating delta on edit send save

**File:** `app/js/ui.js`

In the `send-overlay-save` handler (edit path, where `recordName` exists), after
`saveClimbNote(...)`:

```javascript
const newRating  = currentStarRating;
const sameRoute  = centralID && centralID === _originalCentralRouteID;
const linkCleared = !centralID && !!_originalCentralRouteID;
const newLink     = !!centralID && !sameRoute; // no-previous or swapped-to-different

if (sameRoute) {
  // Link intact — delta update
  reportRating(centralID, newRating, _previousReportedRating);
} else if (linkCleared) {
  // Link cleared — retract previous rating from old route
  if (_previousReportedRating > 0) {
    reportRating(_originalCentralRouteID, 0, _previousReportedRating);
  }
} else if (newLink) {
  // New or swapped link: retract from old if needed, report fresh to new
  if (_originalCentralRouteID && _previousReportedRating > 0) {
    reportRating(_originalCentralRouteID, 0, _previousReportedRating);
  }
  reportRating(centralID, newRating, 0); // previousRating = 0 — no delta across routes
}
```

Update `saveClimbNote` in the edit path:
```javascript
reportedRating: centralID ? newRating : 0,
```

**Project overlay edit path:** projects never contribute ratings. In `project-overlay-save`,
always write `reportedRating: 0` and retract from `_originalCentralRouteID` if
`_previousReportedRating > 0`.

**How to test:**
- Edit linked send: rating 4 → 5 → `ratingSum += 1`, `ratingCount` unchanged ✓
- Edit linked send: rating 4 → 0 → `ratingSum -= 4`, `ratingCount -= 1` ✓
- Edit linked send: change route name → link clears → `ratingSum -= 4`, `ratingCount -= 1` ✓
- Edit linked send: clear + re-link different route → retracts from old, reports fresh to new ✓

---

### Step 7 — `firebase-routes.js` + `ui.js`: Community ratings in the main climbs list

Mirrors `SendLogsView.task` + `RouteRepository.fetchCommunityRatings()` in iOS exactly.

**7a. `firebase-routes.js` — add `fetchCommunityRatings(routeIDs)`**

Uses `where(documentId(), 'in', batch)` matching iOS's `whereField(FieldPath.documentID(), in: batch)`.
Import `documentId` from `'firebase/firestore'` at the top of the file.

```javascript
/**
 * Batch-fetch communityRating for a list of route IDs.
 * Returns a Map<routeID, number> — only routes with ratingCount > 0 are included,
 * matching iOS RouteRepository.fetchCommunityRatings() exactly.
 * Errors per-batch are swallowed; callers receive a partial or empty Map.
 */
export async function fetchCommunityRatings(routeIDs) {
  const map = new Map();
  const unique = [...new Set((routeIDs ?? []).filter(Boolean))];
  if (unique.length === 0) return map;

  const CHUNK = 30;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = unique.slice(i, i + CHUNK);
    try {
      const snap = await getDocs(
        query(collection(db, 'routes'), where(documentId(), 'in', batch))
      );
      snap.docs.forEach(d => {
        const data  = d.data();
        const sum   = data.ratingSum   ?? 0;
        const count = data.ratingCount ?? 0;
        if (count > 0) map.set(d.id, sum / count);
      });
    } catch (err) {
      console.warn('fetchCommunityRatings batch failed:', err);
    }
  }
  return map;
}
```

**7b. `ui.js` — add `_communityRatings` session cache**

```javascript
let _communityRatings = new Map(); // routeID → communityRating (number)
```

**7c. `ui.js` — populate cache in `loadData()`, once per session**

Import `fetchCommunityRatings` from `./firebase-routes.js`.

After `fetchClimbs()` resolves and the table is first rendered, kick off the async fetch.
Guard with `_communityRatings.size > 0` so it only runs once per session (mirrors iOS
`.task { guard communityRatings.isEmpty else { return } }`):

```javascript
// Fire-and-forget: fills in community ratings and re-renders table
if (_communityRatings.size === 0) {
  const linkedIDs = [...new Set(climbs.map(c => c.centralRouteID).filter(Boolean))];
  if (linkedIDs.length > 0) {
    fetchCommunityRatings(linkedIDs)
      .then(map => {
        _communityRatings = map;
        if (_currentRefresh) _currentRefresh(); // second render pass with ratings
      })
      .catch(() => {});
  }
}
```

**7d. `ui.js` — show community rating in the Rating column of `renderClimbsTable`**

In the `for (const climb of pageClimbs)` loop, update the Rating cell:

```javascript
// Before:
<td>${renderStars(climb.rating)}</td>

// After:
<td>
  ${renderStars(climb.rating)}${
    climb.centralRouteID && _communityRatings.has(climb.centralRouteID)
      ? `<small style="color:#94a3b8;margin-left:3px;">(${_communityRatings.get(climb.centralRouteID).toFixed(1)})</small>`
      : ''}
</td>
```

**How to test:**
- Load the app; personal stars appear immediately ✓
- Within a moment, climbs linked to rated routes show e.g. `★★★★☆ (4.2)` ✓
- Climbs with no central link or no community ratings show only personal stars ✓
- Refresh page → community ratings fetched again (cache reset on page load) ✓
- Navigate away and back within session → `_currentRefresh()` uses cached map, no re-fetch ✓

---

### Step 8 — `ui.js`: Show community rating in route search overlay

**File:** `app/js/ui.js`

In `buildRouteSearchOverlay`, update the stats line in the result row template:

```javascript
// Before:
`✓ ${r.sendCount} sends · ${r.projectCount} projecting`

// After:
`✓ ${r.sendCount} sends · ${r.projectCount} projecting${
  r.communityRating != null ? ` · ★ ${r.communityRating.toFixed(1)}` : ''}`
```

**How to test:**
- Type a route name in the search overlay.
- Rated route: `✓ 12 sends · 2 projecting · ★ 4.2` ✓
- Unrated route: `✓ 5 sends · 0 projecting` ✓

---

### Step 9 — `ui.js`: Show community rating in send detail modal

**File:** `app/js/ui.js`

In `showDetailModal`, update the Rating row to include a placeholder span:

```javascript
<td style="padding:0.35rem 0">
  ${renderStars(climb.rating)}
  <span id="detail-community-rating" style="font-size:0.8rem;color:#94a3b8;margin-left:4px;"></span>
</td>
```

In the existing `if (climb.centralRouteID)` async block, replace the raw `getDoc` call
with `getRoute(climb.centralRouteID)` (already exported from `firebase-routes.js`, which
now includes `communityRating`), and populate both the chip and the rating span:

```javascript
if (climb.centralRouteID) {
  getRoute(climb.centralRouteID).then(route => {
    if (!route) return;

    // Ownership chip (existing logic, now via getRoute)
    const chip = document.getElementById('detail-central-route-chip');
    if (chip && route.createdBy === auth.currentUser?.uid) {
      chip.innerHTML = '☁ In community database <span title="You created this route">👤</span>';
    }

    // Community rating (new)
    const ratingSpan = document.getElementById('detail-community-rating');
    if (ratingSpan && route.communityRating != null) {
      ratingSpan.textContent = `(${route.communityRating.toFixed(1)})`;
    }
  }).catch(() => {});
}
```

Import `getRoute` in the `ui.js` import block (already exported; just add to the import list).
Remove the raw `getDoc(doc(db, 'routes', ...))` call that currently handles the chip — it is
fully replaced by the `getRoute` call above.

**How to test:**
- Click a send linked to a rated route → Rating row shows `★★★★☆ (4.2)` ✓
- Click a send linked to an unrated route → Rating row shows `★★★☆☆` (no suffix) ✓
- Click an unlinked send → Rating row shows only personal stars ✓

---

### Step 10 — `ui.js`: Bootstrap — retroactive rating reporting at load time

**File:** `app/js/ui.js`

```javascript
async function bootstrapCommunityRatings(climbs) {
  if (localStorage.getItem('hasBootstrappedCommunityRatings') === 'true') return;

  const toReport = climbs.filter(c =>
    c.centralRouteID &&
    !c.isProject &&
    (c.rating ?? 0) > 0 &&
    (c.reportedRating ?? 0) === 0
  );

  if (toReport.length === 0) {
    localStorage.setItem('hasBootstrappedCommunityRatings', 'true');
    return;
  }

  for (const c of toReport) {
    reportRating(c.centralRouteID, c.rating, 0);          // fire-and-forget
    await saveClimbNote({                                  // persist reportedRating
      recordName:     c.recordName,
      id:             c.id ?? c.recordName,
      route:          c.route,
      climbingArea:   c.climbingArea,
      crag:           c.crag,
      difficulty:     c.difficulty,
      sendType:       c.sendType,
      routeType:      c.routeType,
      rating:         c.rating,
      reportedRating: c.rating,
      noteText:       c.noteText,
      date:           c.date,
      centralRouteID: c.centralRouteID,
    }).catch(err => console.warn('bootstrap saveClimbNote failed:', err));
  }

  localStorage.setItem('hasBootstrappedCommunityRatings', 'true');
  console.log(`[Community Rating] Bootstrapped ${toReport.length} send(s).`);
}
```

Call in `loadData()` after climbs are fetched — fire-and-forget, not in the critical path:
```javascript
bootstrapCommunityRatings(climbs).catch(err =>
  console.warn('bootstrapCommunityRatings failed:', err)
);
```

**Safety guards:**
- `localStorage` flag: never runs more than once per browser profile.
- `reportedRating > 0` check: prevents double-reporting if flag is missing.

**How to test:**
- `localStorage.removeItem('hasBootstrappedCommunityRatings')` then reload.
- Console logs `Bootstrapped N send(s).` ✓
- Reload again — no log ✓
- Firestore `routes/{id}`: `ratingSum`/`ratingCount` updated for bootstrapped sends ✓

---

## File Change Summary

| File | Steps |
|---|---|
| `app/js/firebase-routes.js` | 1, 2, 7a |
| `app/js/firebase-climbs.js` | 3 |
| `app/js/ui.js` | 4, 5, 6, 7b–d, 8, 9, 10 |

---

## What is NOT needed (vs iOS)

| iOS concern | Web equivalent |
|---|---|
| Core Data migration (`ClimbNote 7`) | Not applicable — Firestore is schemaless |
| `applyRemoteClimbNotes` in `FirestoreSyncManager` | Not applicable — web reads Firestore directly |
| `rehydrateOwnershipCache` + bootstrap wiring in `ClimbingNotesApp` | Web: `loadData()` triggers bootstrap |
| `UserDefaults` flag | Web: `localStorage` flag |
| `autoLinkUnlinkedNotes` retroactive reporting | Not applicable — web has no auto-link flow |
| `fetch(routeID:)` in `RouteRepository` | Already exists: `getRoute()` in `firebase-routes.js` |

---

## Self-Review Checklist

- [ ] `ratingDeltas` is a pure function — fully testable in browser console
- [ ] All `reportRating` calls are fire-and-forget with `.catch()` — never block save
- [ ] `reportedRating` is always written to Firestore on every `saveClimbNote` call
- [ ] `_previousReportedRating` and `_originalCentralRouteID` reset on overlay close
- [ ] Edit delta uses three simple cases: intact / cleared / new — no complex diff
- [ ] `fetchCommunityRatings` uses `where(documentId(), 'in', batch)` — matches iOS exactly
- [ ] `_communityRatings` only fetched once per session (size > 0 guard)
- [ ] Bootstrap gated by `localStorage` flag + `reportedRating > 0` (double-safe)
- [ ] Projects never contribute ratings (`!c.isProject` + `sendType !== 'Project'` guards)
- [ ] Community rating hidden when `ratingCount == 0` (`communityRating: null` / absent from map)
- [ ] Rating = 0 treated as "no rating" everywhere
- [ ] Cross-platform: iOS writes `reportedRating` → web reads it on next `fetchClimbs` ✓
