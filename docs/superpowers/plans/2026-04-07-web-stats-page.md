# Web Stats Page Implementation Plan

> **Status: ✅ Implemented and merged to `main` — 2026-04-07**

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Stats page to the SendLog web app that mirrors the iOS stats view, computed client-side from already-loaded climb and training data.

**Architecture:** A new `#stats-view` panel added to the existing SPA alongside `#training-view`. All calculations live in a new `app/js/stats.js` file operating on `allClimbs` / `allSessions` arrays already in memory. Chart.js (CDN) renders bar charts; the activity heatmap is a custom CSS Grid with no dependencies.

**Tech Stack:** Vanilla JS, Chart.js 4.x (CDN), CSS Grid, existing Firebase data model

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/js/stats.js` | **Create** | All stat calculations + render functions |
| `app/index.html` | **Modify** | Stats nav item, `#stats-view` HTML panel, Chart.js CDN tag |
| `app/css/app.css` | **Modify** | Stats layout, section cards, heatmap grid, chart containers |
| `app/js/ui.js` | **Modify** | Wire Stats nav item, show/hide `#stats-view`, trigger render |

---

## Task 1: Add Stats nav item and `#stats-view` panel skeleton to index.html

**Files:**
- Modify: `app/index.html`

### What to add

**Sidebar nav** — after the Training section (line ~58), add:
```html
<div class="sidebar-section-label">Stats</div>
<a href="#" class="sidebar-nav-item" id="view-stats">
  Statistics
</a>
```

**Stats view panel** — after `#training-view` closing tag (line ~175), add:
```html
<div id="stats-view" class="hidden">
  <div class="stats-page-header">
    <h3>Statistics</h3>
  </div>
  <div class="period-tabs" id="stats-period-tabs">
    <button data-period="week">Week</button>
    <button data-period="month">Month</button>
    <button data-period="year">Year</button>
    <button data-period="allTime" class="active">All Time</button>
  </div>
  <!-- Summary cards -->
  <div class="stats-section">
    <div class="stats-cards-row" id="sp-summary-cards"></div>
  </div>
  <!-- Grades -->
  <div class="stats-section">
    <div class="stats-section-title">Grade Distribution</div>
    <div class="stats-chart-card">
      <div class="stats-top-grade" id="sp-top-grade"></div>
      <div class="stats-chart-container">
        <canvas id="sp-grade-chart"></canvas>
      </div>
    </div>
  </div>
  <!-- Route Types -->
  <div class="stats-section">
    <div class="stats-section-title">Route Types</div>
    <div class="stats-chart-card">
      <div class="stats-chart-container stats-chart-container--small">
        <canvas id="sp-type-chart"></canvas>
      </div>
    </div>
  </div>
  <!-- Heatmap -->
  <div class="stats-section">
    <div class="stats-section-title">Activity (Last 6 Months)</div>
    <div class="stats-chart-card">
      <div id="sp-heatmap"></div>
      <div class="heatmap-legend">
        <span>Less</span>
        <div class="heatmap-legend-cells">
          <div class="heatmap-cell level-0"></div>
          <div class="heatmap-cell level-1"></div>
          <div class="heatmap-cell level-2"></div>
          <div class="heatmap-cell level-3"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  </div>
  <!-- Streaks -->
  <div class="stats-section">
    <div class="stats-section-title">Streaks</div>
    <div class="stats-cards-row" id="sp-streak-cards"></div>
  </div>
  <!-- Training -->
  <div class="stats-section">
    <div class="stats-section-title">Training</div>
    <div class="stats-cards-row" id="sp-training-cards"></div>
    <div class="stats-chart-card" style="margin-top:0.75rem">
      <div class="stats-chart-container stats-chart-container--small">
        <canvas id="sp-training-chart"></canvas>
      </div>
    </div>
  </div>
</div>
```

**Chart.js CDN** — add before existing `<script src="js/grades.js">` tag:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
```

**Script tag** — add **after `ui.js`** (stats.js depends on `escapeHtml` defined in ui.js):
```html
<script src="js/stats.js?v=3.7.0"></script>
```

- [ ] Add Stats sidebar nav item after Training section
- [ ] Add `#stats-view` panel HTML with all section containers
- [ ] Add Chart.js CDN script tag
- [ ] Add `stats.js` script tag

```bash
# Verify the HTML is valid (no unclosed tags)
grep -c "stats-view\|stats-section\|sp-" app/index.html
```

- [ ] Commit
```bash
git add app/index.html
git commit -m "feat(stats): add stats view panel skeleton and nav item"
```

---

## Task 2: Create `app/js/stats.js` — calculation functions

**Files:**
- Create: `app/js/stats.js`

### Utility: filterByPeriod

```js
function spFilterByPeriod(climbs, period) {
  const now = new Date();
  let since;
  if (period === 'week') {
    // ISO week start = Monday
    const day = now.getDay() || 7;
    since = new Date(now);
    since.setDate(now.getDate() - day + 1);
    since.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'year') {
    since = new Date(now.getFullYear(), 0, 1);
  } else {
    return climbs; // allTime
  }
  return climbs.filter(c => c.date && new Date(c.date) >= since);
}

function spFilterSessionsByPeriod(sessions, period) {
  const now = new Date();
  let since;
  if (period === 'week') {
    const day = now.getDay() || 7;
    since = new Date(now);
    since.setDate(now.getDate() - day + 1);
    since.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'year') {
    since = new Date(now.getFullYear(), 0, 1);
  } else {
    return sessions;
  }
  return sessions.filter(s => s.date && new Date(s.date) >= since);
}
```

### Summary stats

```js
function spCalcSummary(filteredClimbs) {
  const sends = filteredClimbs.filter(c => !c.isProject);
  // Unique climbing days: union of first-send dates + all ascent dates
  const daySet = new Set();
  sends.forEach(c => {
    if (c.date) daySet.add(new Date(c.date).toDateString());
    (c.ascents ?? []).forEach(a => {
      if (a.date) daySet.add(new Date(a.date).toDateString());
    });
  });
  const totalClimbs = sends.reduce((n, c) => n + 1 + (c.ascents?.length ?? 0), 0);
  const uniqueRoutes = sends.length;
  const avgRating = sends.length
    ? (sends.reduce((s, c) => s + (c.rating ?? 0), 0) / sends.length).toFixed(1)
    : '—';
  // Top area by frequency
  const areaCounts = {};
  sends.forEach(c => { if (c.climbingArea) areaCounts[c.climbingArea] = (areaCounts[c.climbingArea] ?? 0) + 1; });
  const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  // Top grade by GRADES index
  let topGrade = null, topGradeRoute = null, topIdx = -1;
  sends.forEach(c => {
    if (!c.difficulty) return;
    const sys = detectGradeSystem(c.difficulty);
    const idx = GRADES[sys]?.indexOf(c.difficulty) ?? -1;
    if (idx > topIdx) { topIdx = idx; topGrade = c.difficulty; topGradeRoute = c.route; }
  });
  return { totalClimbs, uniqueRoutes, climbingDays: daySet.size, avgRating, topArea, topGrade, topGradeRoute };
}
```

### Grade distribution

```js
function spCalcGradeDistribution(filteredClimbs) {
  const sends = filteredClimbs.filter(c => !c.isProject && c.difficulty);
  const counts = {};
  sends.forEach(c => { counts[c.difficulty] = (counts[c.difficulty] ?? 0) + 1; });
  // Sort by grade index across all systems
  return Object.entries(counts)
    .map(([grade, count]) => {
      const sys = detectGradeSystem(grade);
      const idx = GRADES[sys]?.indexOf(grade) ?? 0;
      return { grade, count, idx, sys };
    })
    .sort((a, b) => a.idx - b.idx);
}
```

### Route types

```js
function spCalcRouteTypes(filteredClimbs) {
  const sends = filteredClimbs.filter(c => !c.isProject);
  const counts = {};
  sends.forEach(c => {
    const t = c.routeType || 'Sport';
    counts[t] = (counts[t] ?? 0) + 1;
  });
  return Object.entries(counts).map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
```

### Heatmap data

```js
function spCalcHeatmap(allClimbs) {
  // All activity dates: first sends + ascents, last 6 months
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const dayMap = {};
  allClimbs.filter(c => !c.isProject).forEach(c => {
    const dates = [c.date, ...(c.ascents ?? []).map(a => a.date)].filter(Boolean);
    dates.forEach(d => {
      const dt = new Date(d);
      if (dt >= sixMonthsAgo) {
        const key = dt.toDateString();
        dayMap[key] = (dayMap[key] ?? 0) + 1;
      }
    });
  });
  return dayMap; // { "Mon Apr 07 2026": 3, ... }
}
```

### Streaks

```js
function spCalcWeeklyStreak(allClimbs, allSessions) {
  // Collect all ISO week keys with activity
  const weekSet = new Set();
  const toWeekKey = d => {
    const dt = new Date(d);
    const jan4 = new Date(dt.getFullYear(), 0, 4);
    const week = Math.ceil(((dt - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    return `${dt.getFullYear()}-W${String(week).padStart(2, '0')}`;
  };
  allClimbs.filter(c => !c.isProject).forEach(c => {
    if (c.date) weekSet.add(toWeekKey(c.date));
    (c.ascents ?? []).forEach(a => { if (a.date) weekSet.add(toWeekKey(a.date)); });
  });
  allSessions.forEach(s => { if (s.date) weekSet.add(toWeekKey(s.date)); });

  // Count consecutive weeks back from current
  const now = new Date();
  let streak = 0;
  for (let i = 0; i < 104; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    if (weekSet.has(toWeekKey(d))) streak++;
    else if (i > 0) break; // gap found (allow current incomplete week)
  }
  return streak;
}

function spCalcLongestStreak(allClimbs) {
  const daySet = new Set();
  allClimbs.filter(c => !c.isProject).forEach(c => {
    if (c.date) daySet.add(new Date(c.date).toDateString());
    (c.ascents ?? []).forEach(a => { if (a.date) daySet.add(new Date(a.date).toDateString()); });
  });
  const days = [...daySet].map(d => new Date(d)).sort((a, b) => a - b);
  let longest = 0, current = 0;
  days.forEach((d, i) => {
    if (i === 0) { current = 1; return; }
    const prev = days[i - 1];
    const diff = (d - prev) / 86400000;
    current = diff === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  });
  return Math.max(longest, current);
}
```

### Training summary

```js
function spCalcTraining(filteredSessions) {
  const totalMinutes = filteredSessions.reduce((s, t) => s + (t.duration ?? 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const totalTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const daySet = new Set(filteredSessions.map(s => s.date && new Date(s.date).toDateString()).filter(Boolean));
  const byType = {};
  filteredSessions.forEach(s => { const t = s.type || 'Other'; byType[t] = (byType[t] ?? 0) + 1; });
  return {
    total: filteredSessions.length,
    totalTime,
    days: daySet.size,
    avgPerWeek: (filteredSessions.length / 52).toFixed(1),
    byType
  };
}
```

- [ ] Create `app/js/stats.js` with all calculation functions above
- [ ] Verify functions don't clash with existing global names (prefix `sp` used throughout)
- [ ] Commit
```bash
git add app/js/stats.js
git commit -m "feat(stats): add stat calculation functions (summary, grades, types, heatmap, streaks, training)"
```

---

## Task 3: Render summary cards and period tabs

**Files:**
- Modify: `app/js/stats.js`

> **Note:** `renderStatsPage()` calls `renderGradeChart()`, `renderTypeChart()`, etc. which are defined in Tasks 4–6. All functions go into the same `stats.js` file, so the call order in Tasks 3–6 is just the authoring sequence — all functions will be present before the page is opened in a browser. Add them in the order described below.

Add render functions for summary and period tabs:

```js
let statsPeriod = 'allTime';

function renderStatsPage(climbs, sessions) {
  const filtered = spFilterByPeriod(climbs, statsPeriod);
  const filteredSessions = spFilterSessionsByPeriod(sessions, statsPeriod);
  const summary = spCalcSummary(filtered);

  // Summary cards
  const summaryEl = document.getElementById('sp-summary-cards');
  if (summaryEl) summaryEl.innerHTML = [
    { label: 'Total Climbs',   value: summary.totalClimbs },
    { label: 'Unique Routes',  value: summary.uniqueRoutes },
    { label: 'Climbing Days',  value: summary.climbingDays },
    { label: 'Avg Rating',     value: summary.avgRating + (summary.avgRating !== '—' ? ' ★' : '') },
    { label: 'Top Area',       value: summary.topArea },
  ].map(c => `
    <div class="stat-card">
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join('');

  // Top grade card
  const topGradeEl = document.getElementById('sp-top-grade');
  if (topGradeEl) topGradeEl.innerHTML = summary.topGrade
    ? `<div class="sp-top-grade-value">${summary.topGrade}</div>
       <div class="sp-top-grade-route">${escapeHtml(summary.topGradeRoute ?? '')}</div>`
    : `<div class="sp-top-grade-empty">No sends in this period</div>`;

  renderGradeChart(filtered);
  renderTypeChart(filtered);
  renderHeatmap(climbs);   // always all-time for heatmap
  renderStreakCards(climbs, sessions);
  renderTrainingSection(filteredSessions);
}
```

Add period tab binding **with a guard to prevent double-binding**:
```js
let _statsTabsBound = false;

function bindStatsPeriodTabs() {
  if (_statsTabsBound) return;
  _statsTabsBound = true;
  document.getElementById('stats-period-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    statsPeriod = btn.dataset.period;
    document.querySelectorAll('#stats-period-tabs button').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    renderStatsPage(window.allClimbs ?? [], window.allSessions ?? []);
  });
}
```

- [ ] Add `renderStatsPage()` and `bindStatsPeriodTabs()` to `stats.js`
- [ ] Commit
```bash
git add app/js/stats.js
git commit -m "feat(stats): render summary cards and period tab binding"
```

---

## Task 4: Render grade distribution and route type charts (Chart.js)

**Files:**
- Modify: `app/js/stats.js`

```js
let gradeChartInstance = null;
let typeChartInstance  = null;

function renderGradeChart(filteredClimbs) {
  const canvas = document.getElementById('sp-grade-chart');
  if (!canvas) return;
  const data = spCalcGradeDistribution(filteredClimbs);
  const ctx = canvas.getContext('2d');
  if (gradeChartInstance) gradeChartInstance.destroy();
  gradeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.grade),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: 'rgba(37,99,235,0.75)',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

const TYPE_COLORS = {
  'Boulder':     'rgba(234,88,12,0.75)',
  'Sport':       'rgba(37,99,235,0.75)',
  'Multi-Pitch': 'rgba(124,58,237,0.75)',
};

function renderTypeChart(filteredClimbs) {
  const canvas = document.getElementById('sp-type-chart');
  if (!canvas) return;
  const data = spCalcRouteTypes(filteredClimbs);
  const ctx = canvas.getContext('2d');
  if (typeChartInstance) typeChartInstance.destroy();
  typeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.type),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: data.map(d => TYPE_COLORS[d.type] ?? 'rgba(100,116,139,0.75)'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { font: { size: 12 } } }
      }
    }
  });
}
```

- [ ] Add `renderGradeChart()` and `renderTypeChart()` to `stats.js`
- [ ] Commit
```bash
git add app/js/stats.js
git commit -m "feat(stats): add grade distribution and route type Chart.js bar charts"
```

---

## Task 5: Build calendar heatmap (CSS Grid)

**Files:**
- Modify: `app/js/stats.js`

```js
function renderHeatmap(allClimbs) {
  const dayMap = spCalcHeatmap(allClimbs);
  const container = document.getElementById('sp-heatmap');
  const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
  const now = new Date();
  let html = '<div class="heatmap-months">';

  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    html += `<div class="heatmap-month">
      <div class="heatmap-month-label">${monthName}</div>
      <div class="heatmap-weekday-labels">
        ${WEEKDAYS.map(d => `<div class="heatmap-weekday">${d}</div>`).join('')}
      </div>
      <div class="heatmap-grid">`;

    // Leading empty cells for first day of month (Mon=0)
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let i = 0; i < firstDow; i++) html += '<div class="heatmap-cell level-0 empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      const key = dt.toDateString();
      const count = dayMap[key] ?? 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
      const title = count > 0 ? `${d} ${monthName}: ${count} climb${count > 1 ? 's' : ''}` : `${d} ${monthName}`;
      html += `<div class="heatmap-cell level-${level}" title="${title}"></div>`;
    }

    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}
```

- [ ] Add `renderHeatmap()` to `stats.js`
- [ ] Commit
```bash
git add app/js/stats.js
git commit -m "feat(stats): add CSS Grid calendar heatmap (last 6 months)"
```

---

## Task 6: Render streak cards and training section

**Files:**
- Modify: `app/js/stats.js`

```js
function renderStreakCards(allClimbs, allSessions) {
  const weekly  = spCalcWeeklyStreak(allClimbs, allSessions);
  const longest = spCalcLongestStreak(allClimbs);
  document.getElementById('sp-streak-cards').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">🔥 ${weekly}</div>
      <div class="stat-label">Weekly Streak</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">🏆 ${longest}</div>
      <div class="stat-label">Longest Streak (days)</div>
    </div>
  `;
}

let trainingChartInstance = null;

function renderTrainingSection(filteredSessions) {
  const t = spCalcTraining(filteredSessions);
  document.getElementById('sp-training-cards').innerHTML = `
    <div class="stat-card"><div class="stat-value">${t.total}</div><div class="stat-label">Sessions</div></div>
    <div class="stat-card"><div class="stat-value">${t.totalTime}</div><div class="stat-label">Total Time</div></div>
    <div class="stat-card"><div class="stat-value">${t.days}</div><div class="stat-label">Training Days</div></div>
  `;
  const types = Object.entries(t.byType).sort((a, b) => b[1] - a[1]);
  const ctx = document.getElementById('sp-training-chart')?.getContext('2d');
  if (trainingChartInstance) trainingChartInstance.destroy();
  if (!ctx || types.length === 0) return;
  trainingChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: types.map(([type]) => type),
      datasets: [{
        data: types.map(([, count]) => count),
        backgroundColor: 'rgba(16,185,129,0.75)',
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { font: { size: 11 } } }
      }
    }
  });
}
```

- [ ] Add `renderStreakCards()` and `renderTrainingSection()` to `stats.js`
- [ ] Commit
```bash
git add app/js/stats.js
git commit -m "feat(stats): add streak cards and training summary section"
```

---

## Task 7: Add CSS styles for stats page

**Files:**
- Modify: `app/css/app.css`

Add at the end of `app.css`:

```css
/* ==============================
   Stats Page
   ============================== */

.stats-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.stats-page-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.stats-section {
  margin-bottom: 1.5rem;
}

.stats-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.stats-cards-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stats-cards-row .stat-card {
  flex: 1 1 120px;
  min-width: 90px;
}

.stats-chart-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
}

.stats-chart-container {
  position: relative;
  height: 200px;
}

.stats-chart-container--small {
  height: 140px;
}

/* Top grade */
.sp-top-grade-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1e40af;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.sp-top-grade-route {
  font-size: 0.875rem;
  color: #64748b;
}

.sp-top-grade-empty {
  color: #94a3b8;
  font-size: 0.875rem;
}

/* Heatmap */
.heatmap-months {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.heatmap-month {
  flex-shrink: 0;
}

.heatmap-month-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.heatmap-weekday-labels {
  display: grid;
  grid-template-columns: repeat(7, 12px);
  gap: 2px;
  margin-bottom: 2px;
}

.heatmap-weekday {
  font-size: 0.55rem;
  color: #94a3b8;
  text-align: center;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 12px);
  gap: 2px;
}

.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.heatmap-cell.level-0 { background: #f1f5f9; }
.heatmap-cell.level-1 { background: rgba(37,99,235,0.3); }
.heatmap-cell.level-2 { background: rgba(37,99,235,0.6); }
.heatmap-cell.level-3 { background: rgba(37,99,235,0.9); }
.heatmap-cell.empty   { background: transparent; }

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: #94a3b8;
}

.heatmap-legend-cells {
  display: flex;
  gap: 2px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .stats-chart-card { background: #1e293b; border-color: #334155; }
  .heatmap-cell.level-0 { background: #1e293b; }
}

/* Mobile */
@media (max-width: 600px) {
  .stats-chart-container { height: 160px; }
  .stats-chart-container--small { height: 110px; }
}
```

- [ ] Add stats CSS to `app/css/app.css`
- [ ] Commit
```bash
git add app/css/app.css
git commit -m "feat(stats): add stats page CSS (sections, charts, heatmap grid)"
```

---

## Task 8: Wire Stats nav in `ui.js`

**Files:**
- Modify: `app/js/ui.js`

### 8a: Add `showStatsView()` function

Following the same pattern as the training view (lines ~519–531):

```js
function showStatsView() {
  document.getElementById('stats-bar').classList.add('hidden');
  document.querySelector('.table-container').classList.add('hidden');
  document.getElementById('training-view').classList.add('hidden');
  document.getElementById('account-view')?.classList.add('hidden');
  document.getElementById('stats-view').classList.remove('hidden');
  // Sidebar active state
  ['view-all', 'view-projects', 'view-sent', 'view-account'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  document.querySelector('[data-view="training"]')?.classList.remove('active');
  document.getElementById('view-stats')?.classList.add('active');
  document.getElementById('btn-log-send')?.classList.add('hidden');
  document.getElementById('btn-add-project')?.classList.add('hidden');
  // Render stats (lazy: uses already-loaded allClimbs / allSessions)
  renderStatsPage(window.allClimbs ?? [], window.allSessions ?? []);
  bindStatsPeriodTabs();
}
```

### 8b: Hide stats-view in `setActiveView()` and `showTrainingView()`

In `setActiveView()` (the function that shows the climb table, around line 372), add:
```js
document.getElementById('stats-view')?.classList.add('hidden');
```

In `showTrainingView()` (around line 521), add:
```js
document.getElementById('stats-view')?.classList.add('hidden');
```

In `showAccountView()` (around line 543), add:
```js
document.getElementById('stats-view')?.classList.add('hidden');
```

### 8c: Bind click handler

After the training nav click handler (around line 414), add:
```js
document.getElementById('view-stats')?.addEventListener('click', e => {
  e.preventDefault();
  showStatsView();
});
```

### 8d: Expose allClimbs and allSessions globally

`window.allClimbs` and `window.allSessions` must be set so `stats.js` can access them.

In `ui.js` at **line 501** (where `_allClimbs = climbs;` is set after fetch), add immediately after:
```js
window.allClimbs = climbs;
```

In `ui.js` at **line 1020** (where `allSessions = await fetchTrainingSessions();` is called), add immediately after:
```js
window.allSessions = allSessions;
```

Also update `_allClimbs` at **line 333** (initial load):
```js
window.allClimbs = initialClimbs;
```

- [ ] Add `showStatsView()` function to `ui.js`
- [ ] Hide `#stats-view` in `setActiveView()`, `showTrainingView()`, `showAccountView()`
- [ ] Bind `#view-stats` click handler
- [ ] Expose `window.allClimbs` and `window.allSessions`
- [ ] Commit
```bash
git add app/js/ui.js
git commit -m "feat(stats): wire stats nav item and show/hide view in ui.js"
```

---

## Task 9: Verify with mock data

**Files:** None (testing only)

- [ ] Open `app/index.html?mock=1` in browser (or `http://localhost:PORT/app/index.html?mock=1`)
- [ ] Click **Statistics** in sidebar — stats view should appear
- [ ] Verify Summary cards show correct values (mock has 15 climbs, multiple areas)
- [ ] Change period to **Year** — check cards update (mock has 2026 climbs)
- [ ] Change period to **Week** — most cards should show 0 (mock dates are spread)
- [ ] Grade Distribution chart renders with grades sorted low→high
- [ ] Route Types chart renders with correct colors (Orange=Boulder, Blue=Sport, Purple=Multi-Pitch)
- [ ] Heatmap shows activity in 2026 months (Aug, May, Jan, Feb)
- [ ] Streak cards show non-zero values (mock has 2026 activity)
- [ ] Training section shows sessions by type

Expected mock summary (All Time):
- Total Climbs: 15 (14 sends + projects excluded from count)
- Top Grade: 9a+ (Bibliographie)

- [ ] Fix any visual or calculation issues
- [ ] Final commit
```bash
git add -A
git commit -m "feat(stats): web stats page complete"
git push origin main
```

---

## Appendix: Global variable contract

`stats.js` depends on these globals being available:
- `GRADES` — from `grades.js` (already loaded before stats.js)
- `detectGradeSystem` — from `grades.js`
- `escapeHtml` — from `ui.js` (already loaded before stats.js)
- `window.allClimbs` — set by `ui.js` after `fetchClimbs()` resolves
- `window.allSessions` — set by `ui.js` after `fetchTrainingSessions()` resolves

`bindStatsPeriodTabs()` should only be called once — guard with a flag or use event delegation.
