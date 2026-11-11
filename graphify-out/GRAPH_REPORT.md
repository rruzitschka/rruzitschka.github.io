# Graph Report - sendlogwebsite  (2026-11-11)

## Corpus Check
- 66 files · ~500,607 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1085 nodes · 1868 edges · 69 communities (66 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `863491cb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]

## God Nodes (most connected - your core abstractions)
1. `escapeInspectorHtml()` - 17 edges
2. `renderInspectorHtml()` - 17 edges
3. `loadData()` - 17 edges
4. `renderClimbsTable()` - 16 edges
5. `showAddSendOverlay()` - 14 edges
6. `Firebase Modular SDK Migration Plan` - 14 edges
7. `renderRouteDetailCardHtml()` - 14 edges
8. `showEditSendOverlay()` - 13 edges
9. `Task 5: `index.html` — HTML Structure` - 13 edges
10. `syncSendOverlayForRouteType()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Dev HTTP Server` --serves--> `Web App Dashboard (app/index.html)`  [INFERRED]
  serve.js → app/index.html
- `Dev HTTP Server` --serves--> `Landing Page (index.html)`  [EXTRACTED]
  serve.js → index.html
- `Cloud Sync (Firebase)` --implemented_by--> `Firebase Auth (Sign in with Apple)`  [EXTRACTED]
  index.html → app/js/firebase-auth.js
- `Cloud Sync (Firebase)` --implemented_by--> `Firebase Climbs Service`  [EXTRACTED]
  index.html → app/js/firebase-climbs.js
- `Partner API Keys` --implemented_by--> `Firebase API Keys Service`  [EXTRACTED]
  index.html → app/js/firebase-api-keys.js

## Communities (69 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (44): fetchRouteData(), reportRating(), overlayCountryChange(), _allClimbs, allSessions, _ascentCache, bindApiKeyHandlers(), bindFilterHandlers() (+36 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (30): Account View, Partner API Keys, Central Route Database, Climb Logging Flow, Cloud Sync (Firebase), Community Ratings, Climbing Goals, Mock Development Mode (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (91): ADMIN_ROUTE_TYPES, ADMIN_SORT_OPTIONS, adminBrowserFiltersActive(), adminBrowserState, adminStatCard(), countryFlagEmoji(), escapeHtml(), fmtDateTime() (+83 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (13): banner, fetchClimbs(), fetchSessionSends(), foldedForSearch(), FRENCH_MOCK, MOCK_API_KEYS, MOCK_CLIMBS, MOCK_ROUTES (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.2
Nodes (7): anyFilters, FILTERS, mockGetDocs, page1, page2, progress, startAfterArg

### Community 5 - "Community 5"
Cohesion: 0.21
Nodes (25): bindStatsPeriodTabs(), chartPalette(), defaultBarChartOptions(), isChalkSkyStatsTheme(), rebuildBarChart(), renderGradeChart(), renderHeatmap(), renderStatsPage() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (16): attemptCount, batch, crag, detectSystem(), FRENCH, frenchGrade, gradeSystem, groups (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (88): applyCentralRouteToInspector(), applyInspectorCommunityRating(), applyInspectorCountryPill(), applyInspectorOwnership(), applyThemeToDom(), bindInspectorButtons(), bindSelectToChipsOnce(), buildClimbRowCellsHtml() (+80 more)

### Community 8 - "Community 8"
Cohesion: 0.2
Nodes (8): batch1, batch2, ids, mockCollection, mockDocumentId, mockGetDocs, mockQuery, mockWhere

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (7): ext, filePath, fs, http, MIME, path, PORT

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (36): Authentication, code:block1 (X-API-Key: cnl_your_key_here), code:json ({), code:bash (curl "https://api-hoxktcdqvq-uc.a.run.app/v1/training?from=2), code:json ({), code:bash (curl "https://api-hoxktcdqvq-uc.a.run.app/v1/goals" \), code:json ({), code:bash (# Initial full fetch) (+28 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (6): data, lowerRef, now, toFix, uppercaseId, upperRef

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (4): mockCollection, mockGetDocs, mockOrderBy, mockQuery

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (4): Mock B - Editorial Design, Mock C - Night Design, Mock A - Stone Design, CSS Mock Proposals Index

### Community 16 - "Community 16"
Cohesion: 0.04
Nodes (46): Bootstrap — one-time retroactive reporting, code:javascript (// ── Community rating ─────────────────────────────────────), code:javascript (reportedRating: centralID ? newRating : 0,), code:javascript (/**), code:javascript (let _communityRatings = new Map(); // routeID → communityRat), code:javascript (// Fire-and-forget: fills in community ratings and re-render), code:javascript (// Before:), code:javascript (// Before:) (+38 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (11): Appendix: Global variable contract, code:js (let gradeChartInstance = null;), code:bash (git add app/js/stats.js), code:js (function renderStreakCards(allClimbs, allSessions) {), code:bash (git add app/js/stats.js), code:bash (git add -A), File Map, Task 4: Render grade distribution and route type charts (Chart.js) (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (13): code:html (<script src="js/climbs.js"></script>), code:html (<script src="js/training.js"></script>), code:html (<a href="#" data-view="training">Training</a>), code:html (<h3 id="view-title">All Climbs</h3>), code:html (<div style="display:flex;align-items:center;justify-content:), code:html (<div class="sidebar-section-label">Training</div>), code:html (<div id="training-view" class="hidden">), code:html (<div id="climb-overlay" class="edit-overlay hidden" role="di) (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (30): Admin capabilities, Admin Panel, Architecture, Audit trail fields, Central Route Database, code:block1 (app/), code:bash (cd WebSite/sendlogwebsite), code:block3 (http://localhost:8080/app/?mock=true) (+22 more)

### Community 21 - "Community 21"
Cohesion: 0.04
Nodes (47): code:css (/* ---- Table header row (heading + action button) ---- */), code:js (function setStarRating(value) {), code:js (function setStarRating(value) {), code:js (function setStylePill(value) {), code:js (function showAddSendOverlay(prefill = {}) {), code:js (function showEditSendOverlay(climb) {), code:js (function showAddProjectOverlay() {), code:js (function showEditProjectOverlay(climb) {) (+39 more)

### Community 22 - "Community 22"
Cohesion: 0.08
Nodes (25): Auth, Bundler requirement, code:html (<script src="https://www.gstatic.com/firebasejs/12.12.1/fire), code:js (// Before), code:js (// Before (compat)), code:js (// Before), code:js (// Before), code:js (// Before (property)) (+17 more)

### Community 24 - "Community 24"
Cohesion: 0.1
Nodes (20): 1. Button Alignment Fix, 2. Context-Aware Action Button, 3. Log Send Overlay (Add + Edit), 4. Add / Edit Project Overlay, 5. Data Model, 6. "Mark as Sent" Flow, 7. CSS Additions, 8. Files Changed (+12 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (13): 6a: `showConfirmDialog`, 6b: `setActiveView` extension, 6c: Climb Overlay, 6d: Training Overlay, 6e: Training Rendering, code:js (function showConfirmDialog(title, message) {), code:js (function showAddClimbOverlay() {), code:js (let currentStarRating = 0;) (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (15): Approach: CDN ES Modules, no bundler, code:js (import { initializeApp }           from 'firebase/app';), Firebase Modular SDK Migration Plan, Key API mapping, Risks and notes, Scope, Task 1 — Update `index.html` CDN and script tags, Task 2 — Rewrite `firebase-config.js` (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (16): code:js (function spCalcRouteTypes(filteredClimbs) {), code:js (function spCalcHeatmap(allClimbs) {), code:js (function spCalcWeeklyStreak(allClimbs, allSessions) {), code:js (function spCalcTraining(filteredSessions) {), code:bash (git add app/js/stats.js), code:js (function spFilterByPeriod(climbs, period) {), code:js (function spCalcSummary(filteredClimbs) {), code:js (function spCalcGradeDistribution(filteredClimbs) {) (+8 more)

### Community 28 - "Community 28"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 30 - "Community 30"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (10): 0. One-time backfill, 1. Browse-all (no filters), 2. Filters (each alone, then combos), 3. Search, 4. List → edit → back, 5. Row content, 6. Error states, 7. Batch country assignment (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.11
Nodes (13): batches, consistent, constraints, filters, mockGetCountFromServer, mockGetDocs, mockWriteBatch, ops (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.2
Nodes (8): Background, Investigation result, Notes, Residual maintenance note, Scope, Tasks, Ticket: Firebase Functions — write `areaSearch` on routes API, Verification

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (5): Background, Deployment / verification, Out of scope, Tasks, Ticket: iOS — write `areaSearch` on CentralRoute

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (6): Background, code:js ({), Current web contract, iOS implementation plan, Out of scope, Ticket: iOS — record `recentEdits` audit entries on central route writes

### Community 36 - "Community 36"
Cohesion: 0.25
Nodes (5): baseDoc, mockGetDoc, mockRunTransaction, prev, { updatePayloads }

### Community 37 - "Community 37"
Cohesion: 0.16
Nodes (13): ISO_COUNTRIES, isoCountryName(), isoCountryOptionsHTML(), isOwnerState(), populateSelects(), refreshSelects(), SELECT_IDS, selectTooltip() (+5 more)

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (6): Behaviour, CodeScene, Conventions, Internal Documentation, Project, SendLog Web App — Agent Instructions

### Community 39 - "Community 39"
Cohesion: 0.2
Nodes (10): 8a: Add `showStatsView()` function, 8c: Bind click handler, 8d: Expose allClimbs and allSessions globally, code:js (function showStatsView() {), code:js (document.getElementById('view-stats')?.addEventListener('cli), code:js (window.allClimbs = climbs;), code:js (window.allSessions = allSessions;), code:js (window.allClimbs = initialClimbs;) (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (8): code:html (<div class="sidebar-section-label">Stats</div>), code:html (<div id="stats-view" class="hidden">), code:html (<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dis), code:html (<script src="js/stats.js?v=3.7.0"></script>), code:bash (# Verify the HTML is valid (no unclosed tags)), code:bash (git add app/index.html), Task 1: Add Stats nav item and `#stats-view` panel skeleton to index.html, What to add

### Community 41 - "Community 41"
Cohesion: 0.5
Nodes (4): 8b: Hide stats-view in `setActiveView()` and `showTrainingView()`, code:js (document.getElementById('stats-view')?.classList.add('hidden), code:js (document.getElementById('stats-view')?.classList.add('hidden), code:js (document.getElementById('stats-view')?.classList.add('hidden)

### Community 42 - "Community 42"
Cohesion: 0.5
Nodes (4): code:js (let statsPeriod = 'allTime';), code:js (let _statsTabsBound = false;), code:bash (git add app/js/stats.js), Task 3: Render summary cards and period tabs

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (3): code:js (function renderHeatmap(allClimbs) {), code:bash (git add app/js/stats.js), Task 5: Build calendar heatmap (CSS Grid)

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): code:css (/* ==============================), code:bash (git add app/css/app.css), Task 7: Add CSS styles for stats page

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (13): DATE, mockCollection, mockDoc, mockGetDocs, mockQuery, mockServerTimestamp, mockSetDoc, mockTimestamp (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (10): code:css (/* =========================================================), code:bash (cd /Users/robertruzitschka/Desktop/ClimbingNotes/WebSite/sen), code:bash (git add index.html), code:bash (git add -A), File Map, Notes, Phase 3 — Full CRUD (Climbs + Training) Implementation Plan, Task 1: Overlay + Form + Training CSS (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.33
Nodes (6): 6f: Period tabs, ascent list, wiring, code:js (function bindPeriodTabs() {), code:js (function renderAscentsList(climb) {), code:js (document.getElementById('training-list').addEventListener('c), code:js (bindClimbOverlayHandlers();), code:bash (git add app/js/ui.js)

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (6): code:js (window.fetchTrainingSessions = async function() {), code:js (window.saveTrainingSession = async function(session) {), code:js (window.saveClimbNote = async function(climbData) {), code:bash (git add app/js/mock.js), code:js (const MOCK_SESSIONS = [), Task 4: `mock.js` — Training Data + Write Overrides

### Community 49 - "Community 49"
Cohesion: 0.5
Nodes (4): code:js (// training.js — Fetch + write TrainingSessions; compute tra), code:bash (node --input-type=module < /Users/robertruzitschka/Desktop/C), code:bash (git add app/js/training.js), Task 2: `training.js` — New Module

### Community 50 - "Community 50"
Cohesion: 0.5
Nodes (4): code:js (// ---- Write Operations ----), code:bash (node --check /Users/robertruzitschka/Desktop/ClimbingNotes/W), code:bash (git add app/js/climbs.js), Task 3: `climbs.js` — Write Operations

### Community 51 - "Community 51"
Cohesion: 0.27
Nodes (13): BOULDER_ROUTE_TYPES, BOULDER_SEND_TYPES, canonicalizeSendType(), coerceSendTypeForRouteType(), GYM_ROPE_SEND_TYPES, GYM_ROUTE_TYPES, isBoulderRouteType(), isGymRouteType() (+5 more)

### Community 52 - "Community 52"
Cohesion: 0.15
Nodes (24): bindClimbRowClick(), syncInspectorForPage(), fetchAscents(), fetchSessionSends(), buildSessionSendsHtml(), escapeHtml(), formatDate(), _getAscentsCached() (+16 more)

### Community 53 - "Community 53"
Cohesion: 0.11
Nodes (23): BOULDER_ROUTE_TYPES, BOULDER_SEND_TYPES, buildClimbNoteDoc(), canonicalizeProjectStatus(), canonicalizeSendType(), computeStats(), deleteAscent(), deleteClimbNote() (+15 more)

### Community 54 - "Community 54"
Cohesion: 0.14
Nodes (16): deleteAccount(), _deleteUserFirestoreData(), _ensureUserDocument(), getCurrentUser(), signInWithApple(), app, db, firebaseConfig (+8 more)

### Community 55 - "Community 55"
Cohesion: 0.31
Nodes (14): buildLinkedTitle(), setFindRouteLinked(), setFindRouteUnlinked(), fetchRouteOwnershipThenSync(), initGradePicker(), populateOverlayCountrySelects(), refreshOverlayCountrySelect(), setFindRouteLinked() (+6 more)

### Community 56 - "Community 56"
Cohesion: 0.19
Nodes (13): addRouteLine(), buildRoutesSectionHtml(), collectRouteLines(), gymSessionFieldsForSave(), setGymFields(), syncGymFieldVisibility(), clearRouteLines(), setGymFields() (+5 more)

### Community 57 - "Community 57"
Cohesion: 0.2
Nodes (8): app/js modules, code:block1 (app/               the web app (SPA-ish, tab-based)), DOM-only helper modules (no module state, split out of ui.js), firebase-* service modules (Firestore access, one per collection domain), Pure logic modules (Firestore-free, DOM-free, vitest-testable), Repository layout, STRUCTURE — SendLog Web App, View/controller modules

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (6): ARCHITECTURE — SendLog Web App, Central route DB gate (ADR 0005), code:block1 (landing/index.html, pages/          static marketing/docs (n), iOS parity contract, Layering, Service binding + mock mode

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (6): code:bash (npx vitest run          # all tests), Coverage policy, Known issue, Principles, Running, TESTING — SendLog Web App

### Community 60 - "Community 60"
Cohesion: 0.6
Nodes (4): detectGradeSystem(), getPreferredGradeSystem(), initGradePicker(), populateGradeSelect()

### Community 61 - "Community 61"
Cohesion: 0.33
Nodes (5): Cross-repo contracts, Firebase (client SDK, import map → gstatic CDN), INTEGRATIONS — SendLog Web App, REST API v1 (Cloud Functions — code in the iOS repo `ClimbingNotes/functions`), Third-party

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (6): computeTrainingStats(), bindTrainingOverlayHandlers(), collectRouteLines(), loadTrainingData(), renderTrainingPage(), showTrainingView()

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (5): CONVENTIONS — SendLog Web App, Data, New UI ("Chalk & Sky"), Process, UI

### Community 64 - "Community 64"
Cohesion: 0.4
Nodes (4): Dev tooling, Module system, Runtime, STACK — SendLog Web App

### Community 66 - "Community 66"
Cohesion: 0.7
Nodes (4): apiKeysCreate(), _apiKeysIdToken(), apiKeysList(), apiKeysRevoke()

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (5): Context for the next session, Done in this redesign (for reference), Plan — New-UI GUI follow-ups (Chalk & Sky), Remaining GUI issues (in suggested order), Remaining GUI issues (resolved 2026-11-11)

### Community 68 - "Community 68"
Cohesion: 0.18
Nodes (10): decodeRouteEntries(), isDecodableEntry(), isPlainObject(), ROUTE_OUTCOMES, ROUTE_STYLES, decoded, entries, ENTRY (+2 more)

## Knowledge Gaps
- **443 isolated node(s):** `http`, `fs`, `path`, `PORT`, `MIME` (+438 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `renderStatsPage()` connect `Community 5` to `Community 52`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `computeStats()` connect `Community 53` to `Community 0`, `Community 52`, `Community 60`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `detectGradeSystem()` connect `Community 60` to `Community 53`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `http`, `fs`, `path` to the rest of the system?**
  _443 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._