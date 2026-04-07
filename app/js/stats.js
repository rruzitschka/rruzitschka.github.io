// stats.js — Stats page calculations and rendering
// Depends on: GRADES, detectGradeSystem (grades.js), escapeHtml (ui.js)

// ==================== Utility: Period filters ====================

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

// ==================== Summary stats ====================

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

// ==================== Grade distribution ====================

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

// ==================== Route types ====================

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

// ==================== Heatmap data ====================

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

// ==================== Streaks ====================

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

// ==================== Training summary ====================

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

// ==================== Render: Summary + period tabs ====================

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
    ? `<div class="sp-top-grade-inline"><span class="sp-top-grade-label">Hardest Send:</span> <span class="sp-top-grade-route">${escapeHtml(summary.topGradeRoute ?? '')}</span><span class="sp-top-grade-sep">,</span> <span class="sp-top-grade-value">${summary.topGrade}</span></div>`
    : `<div class="sp-top-grade-empty">No sends in this period</div>`;

  renderGradeChart(filtered);
  renderTypeChart(filtered);
  renderHeatmap(climbs);   // always all-time for heatmap
  renderStreakCards(climbs, sessions);
  renderTrainingSection(filteredSessions);
}

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

// ==================== Render: Grade and route type charts ====================

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
        backgroundColor: 'rgba(15,23,42,0.75)',
        borderColor: 'rgba(15,23,42,0.75)',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

const TYPE_COLORS = {
  'Boulder':     'rgba(15,23,42,0.75)',
  'Sport':       'rgba(15,23,42,0.75)',
  'Multi-Pitch': 'rgba(15,23,42,0.75)',
};
const TYPE_BORDER_COLORS = {
  'Boulder':     'rgba(15,23,42,0.75)',
  'Sport':       'rgba(15,23,42,0.75)',
  'Multi-Pitch': 'rgba(15,23,42,0.75)',
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
        backgroundColor: data.map(d => TYPE_COLORS[d.type] ?? 'rgba(15,23,42,0.75)'),
        borderColor: data.map(d => TYPE_BORDER_COLORS[d.type] ?? 'rgba(15,23,42,0.75)'),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
        x: { ticks: { font: { size: 12 } }, grid: { display: false } }
      }
    }
  });
}

// ==================== Render: Calendar heatmap ====================

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

// ==================== Render: Streaks and training ====================

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
        backgroundColor: 'rgba(15,23,42,0.75)',
        borderColor: 'rgba(15,23,42,0.75)',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}
