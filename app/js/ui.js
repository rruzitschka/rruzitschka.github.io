// ui.js — Dashboard UI rendering and interaction

// ---------- Module-level state ----------

let _allClimbs = [];
let _currentRefresh = null;

const SEND_CLASSES = {
  'Redpoint':  'send-rp',
  'On Sight':  'send-os',
  'Flash':     'send-fl',
  'Project':   'send-proj',
  'Pinkpoint': 'send-pp'
};

const HARD_GRADES = [
  '8b+','8c','8c+','9a','9a+','9b','9b+','9c',
  '5.14a','5.14b','5.14c','5.14d',
  '5.15a','5.15b','5.15c','5.15d'
];

function gradeBadgeClass(difficulty) {
  return HARD_GRADES.includes(difficulty) ? 'grade-hard' : 'grade-normal';
}

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderStars(rating) {
  const n = Math.round(rating ?? 0);
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= n ? '★' : '☆';
  return `<span class="stars">${s}</span>`;
}

// ---------- Stats Bar ----------

function renderStatsBar(stats) {
  document.getElementById('stat-total').textContent     = stats.total ?? '—';
  document.getElementById('stat-this-year').textContent = stats.thisYear ?? '—';
  document.getElementById('stat-streak').textContent    = stats.streak ?? '0';
  document.getElementById('stat-hardest').textContent   = stats.hardestThisYear || '—';
}

// ---------- Climbs Table ----------

function renderClimbsTable(climbs) {
  const tbody   = document.getElementById('climbs-tbody');
  const table   = document.getElementById('climbs-table');
  const empty   = document.getElementById('empty-state');

  tbody.innerHTML = '';

  if (!climbs || climbs.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  table.style.display = '';
  empty.style.display = 'none';

  for (const climb of climbs) {
    const gradeClass = gradeBadgeClass(climb.difficulty);
    const sendClass  = SEND_CLASSES[climb.sendType] ?? 'send-proj';
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td><strong>${escapeHtml(climb.route || '—')}</strong></td>
      <td>${escapeHtml(climb.climbingArea || '—')}${climb.crag ? ` <small style="color:#64748b">/ ${escapeHtml(climb.crag)}</small>` : ''}</td>
      <td><span class="type-badge">${escapeHtml(climb.routeType || '—')}</span></td>
      <td><span class="badge ${gradeClass}">${escapeHtml(climb.difficulty || '—')}</span></td>
      <td>${formatDate(climb.date)}</td>
      <td><span class="badge ${sendClass}">${escapeHtml(climb.sendType || '—')}</span></td>
      <td>${renderStars(climb.rating)}</td>
    `;
    tr.addEventListener('click', () => showDetailModal(climb));
    tbody.appendChild(tr);
  }
}

// ---------- Detail Modal ----------

function showDetailModal(climb) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  const gradeClass = gradeBadgeClass(climb.difficulty);
  const sendClass  = SEND_CLASSES[climb.sendType] ?? 'send-proj';

  let html = `
    <h2 style="margin-bottom:0.5rem">${escapeHtml(climb.route || '—')}</h2>
    <div style="color:#64748b;margin-bottom:1.25rem;font-size:0.95rem">
      ${escapeHtml(climb.climbingArea || '')}${climb.crag ? ` &rsaquo; ${escapeHtml(climb.crag)}` : ''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.25rem;align-items:center">
      <span class="badge ${gradeClass}">${escapeHtml(climb.difficulty || '—')}</span>
      <span class="badge ${sendClass}">${escapeHtml(climb.sendType || '—')}</span>
      ${climb.routeType ? `<span style="font-size:0.85rem;color:#64748b">${escapeHtml(climb.routeType)}</span>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem;margin-bottom:1rem">
      <tr>
        <td style="padding:0.35rem 0;color:#64748b;width:40%">Date</td>
        <td style="padding:0.35rem 0">${formatDate(climb.date)}</td>
      </tr>
      <tr>
        <td style="padding:0.35rem 0;color:#64748b">Rating</td>
        <td style="padding:0.35rem 0">${renderStars(climb.rating)}</td>
      </tr>
    </table>
  `;

  if (climb.noteText) {
    html += `
      <div style="margin-bottom:1.25rem">
        <div style="font-weight:600;margin-bottom:0.35rem">Notes</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.75rem;white-space:pre-wrap;font-size:0.93rem">${escapeHtml(climb.noteText)}</div>
      </div>
    `;
  }

  if (climb.isProject || climb.projectStatus) {
    html += `
      <div style="background:#f1f5f9;border-radius:8px;padding:1rem;margin-bottom:1rem">
        <div style="font-weight:600;margin-bottom:0.5rem">Project Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.93rem">
          ${climb.projectStatus ? `<tr><td style="padding:0.3rem 0;color:#64748b;width:40%">Status</td><td>${escapeHtml(climb.projectStatus)}</td></tr>` : ''}
          ${climb.highPoint    ? `<tr><td style="padding:0.3rem 0;color:#64748b">High Point</td><td>${escapeHtml(String(climb.highPoint))}</td></tr>` : ''}
          ${climb.lastAttemptDate ? `<tr><td style="padding:0.3rem 0;color:#64748b">Last Attempt</td><td>${formatDate(climb.lastAttemptDate)}</td></tr>` : ''}
          ${climb.attemptCount  ? `<tr><td style="padding:0.3rem 0;color:#64748b">Attempts</td><td>${climb.attemptCount}</td></tr>` : ''}
        </table>
        ${climb.projectNotes ? `<div style="margin-top:0.5rem;font-size:0.9rem;color:#475569;white-space:pre-wrap">${escapeHtml(climb.projectNotes)}</div>` : ''}
      </div>
    `;
  }

  if (climb.photoCount && climb.photoCount > 0) {
    html += `<p style="font-size:0.88rem;color:#94a3b8">${climb.photoCount} photo${climb.photoCount > 1 ? 's' : ''} (view in app)</p>`;
  }

  content.innerHTML = html;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function hideDetailModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

// ---------- Toast ----------

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
}

// ---------- Loading skeleton ----------

function showLoading(visible) {
  const skeleton = document.getElementById('loading-skeleton');
  const table    = document.getElementById('climbs-table');
  if (visible) {
    skeleton.style.display = '';
    table.style.display    = 'none';
  } else {
    skeleton.style.display = 'none';
  }
}

// ---------- Populate filters ----------

function populateFilters(climbs) {
  const areaSelect     = document.getElementById('filter-area');
  const yearSelect     = document.getElementById('filter-year');
  const typeSelect     = document.getElementById('filter-routetype');

  const areas = [...new Set(climbs.map(c => c.climbingArea).filter(Boolean))].sort();
  const years = [...new Set(
    climbs.filter(c => c.date).map(c => c.date.getFullYear())
  )].sort((a, b) => b - a);
  const types = [...new Set(climbs.map(c => c.routeType).filter(Boolean))].sort();

  areaSelect.innerHTML = '<option value="">All Areas</option>';
  for (const area of areas) {
    const opt = document.createElement('option');
    opt.value = area;
    opt.textContent = area;
    areaSelect.appendChild(opt);
  }

  yearSelect.innerHTML = '<option value="">All Years</option>';
  for (const year of years) {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  }

  if (typeSelect) {
    typeSelect.innerHTML = '<option value="">All Types</option>';
    for (const type of types) {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      typeSelect.appendChild(opt);
    }
  }
}

// ---------- User chip ----------

function renderUserChip(userIdentity) {
  const chip = document.getElementById('user-chip');
  if (!chip) return;
  const name = userIdentity?.nameComponents?.givenName
    ?? userIdentity?.lookupInfo?.emailAddress
    ?? 'Climber';
  chip.textContent = name;
}

// ---------- Count badges ----------

function updateCountBadges(filtered, all) {
  const badgeAll      = document.getElementById('badge-all');
  const badgeProjects = document.getElementById('badge-projects');
  const badgeSent     = document.getElementById('badge-sent');
  if (badgeAll)      badgeAll.textContent      = filtered.length;
  if (badgeProjects) badgeProjects.textContent  = filtered.filter(c => c.isProject).length;
  if (badgeSent)     badgeSent.textContent      = filtered.filter(c => !c.isProject).length;
}

// ---------- Filter + search handler wiring ----------

function bindFilterHandlers(initialClimbs) {
  _allClimbs = initialClimbs;
  let activeView = 'all'; // 'all' | 'projects' | 'sent'

  function refresh() {
    const area      = document.getElementById('filter-area').value;
    const year      = document.getElementById('filter-year').value;
    const sendType  = document.getElementById('filter-sendtype').value;
    const routeType = document.getElementById('filter-routetype')?.value ?? '';
    const search    = document.getElementById('search-input').value;
    const sort      = document.getElementById('sort-select').value;

    let filtered = filterClimbs(_allClimbs, { area, year, sendType, routeType, search, sort });

    // Update badges from search/filter result BEFORE applying the view filter
    // so "All Climbs" count stays stable regardless of which view is active
    updateCountBadges(filtered, _allClimbs);

    // Apply sidebar view filter on top
    if (activeView === 'projects') filtered = filtered.filter(c => c.isProject === true);
    else if (activeView === 'sent') filtered = filtered.filter(c => c.isProject === false);

    renderClimbsTable(filtered);
  }

  _currentRefresh = refresh;

  ['filter-area', 'filter-year', 'filter-sendtype', 'filter-routetype', 'sort-select'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', refresh);
  });

  let searchTimer;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 300);
  });

  // Sidebar view links
  function setActiveView(view) {
    activeView = view;
    showLogbookView();
    ['view-all', 'view-projects', 'view-sent'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    const viewMap   = { all: 'view-all', projects: 'view-projects', sent: 'view-sent' };
    const labelMap  = { all: 'All Climbs', projects: 'Projects', sent: 'Sent Climbs' };
    const navMap    = { all: 'nav-logbook', projects: 'nav-projects' };
    document.getElementById(viewMap[view])?.classList.add('active');
    // Sync header nav active state
    ['nav-logbook', 'nav-projects'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    if (navMap[view]) document.getElementById(navMap[view])?.classList.add('active');
    const lbl = document.getElementById('view-label');
    if (lbl) lbl.textContent = labelMap[view] ?? 'All Climbs';
    refresh();
  }

  document.getElementById('view-all')?.addEventListener('click', e => { e.preventDefault(); setActiveView('all'); });
  document.getElementById('view-projects')?.addEventListener('click', e => { e.preventDefault(); setActiveView('projects'); });
  document.getElementById('view-sent')?.addEventListener('click', e => { e.preventDefault(); setActiveView('sent'); });

  // Header nav links — delegate to same view switching
  document.getElementById('nav-logbook')?.addEventListener('click', e => { e.preventDefault(); setActiveView('all'); });
  document.getElementById('nav-projects')?.addEventListener('click', e => { e.preventDefault(); setActiveView('projects'); });
  document.getElementById('nav-training')?.addEventListener('click', e => { e.preventDefault(); showTrainingView(); });

  // Initial badge update
  updateCountBadges(_allClimbs, _allClimbs);
}

// ---------- Modal close handlers ----------

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-close')?.addEventListener('click', hideDetailModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) hideDetailModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideDetailModal();
  });

  // Training view sidebar item
  document.querySelector('[data-view="training"]')?.addEventListener('click', e => {
    e.preventDefault();
    showTrainingView();
  });

  bindClimbOverlayHandlers();
  bindTrainingOverlayHandlers();
  bindPeriodTabs();
});


// ---------- Utility ----------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- loadData ----------

async function loadData() {
  showLoading(true);
  try {
    const climbs = await fetchClimbs();
    showLoading(false);
    _allClimbs = climbs;
    const stats = computeStats(climbs);
    renderStatsBar(stats);
    populateFilters(climbs);
    if (_currentRefresh) {
      _currentRefresh();
    } else {
      renderClimbsTable(climbs);
      bindFilterHandlers(climbs);
    }
  } catch (err) {
    showLoading(false);
    showToast('Failed to load climbs. Please try again.', 'error');
    console.error('Load error:', err);
  }
}

// ---------- Training view toggle ----------

function showTrainingView() {
  document.getElementById('stats-bar').classList.add('hidden');
  document.querySelector('.table-container').classList.add('hidden');
  document.getElementById('training-view').classList.remove('hidden');
  document.getElementById('nav-training')?.classList.add('active');
  document.getElementById('nav-logbook')?.classList.remove('active');
  document.getElementById('nav-projects')?.classList.remove('active');
  loadTrainingData();
}

function showLogbookView() {
  document.getElementById('stats-bar').classList.remove('hidden');
  document.querySelector('.table-container').classList.remove('hidden');
  document.getElementById('training-view').classList.add('hidden');
}

// ---------- Confirm dialog ----------

function showConfirmDialog(title, message) {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const dialog = document.getElementById('confirm-dialog');
    dialog.classList.remove('hidden');
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    function cleanup() {
      dialog.classList.add('hidden');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
    }
    function onOk()     { cleanup(); resolve(true);  }
    function onCancel() { cleanup(); resolve(false); }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}

// ---------- Star rating picker ----------

let currentStarRating = 0;

function setStarRating(value) {
  currentStarRating = value;
  document.querySelectorAll('#co-rating span').forEach((span, i) => {
    span.classList.toggle('filled', i < value);
  });
}

function bindStarPicker() {
  document.querySelectorAll('#co-rating span').forEach(span => {
    span.addEventListener('click', () => setStarRating(Number(span.dataset.value)));
    span.addEventListener('mouseenter', () => {
      const v = Number(span.dataset.value);
      document.querySelectorAll('#co-rating span').forEach((s, i) => {
        s.classList.toggle('filled', i < v);
      });
    });
    span.addEventListener('mouseleave', () => setStarRating(currentStarRating));
  });
}

// ---------- Climb overlay ----------

function showAddClimbOverlay() {
  const overlay = document.getElementById('climb-overlay');
  document.getElementById('climb-overlay-title').textContent = 'Add Climb';
  document.getElementById('co-record-name').value = '';
  document.getElementById('co-route').value = '';
  document.getElementById('co-area').value = '';
  document.getElementById('co-crag').value = '';
  document.getElementById('co-difficulty').value = '';
  document.getElementById('co-routetype').value = 'Sport';
  document.getElementById('co-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('co-sendtype').value = 'Redpoint';
  document.getElementById('co-notes').value = '';
  document.getElementById('co-attempts').value = '0';
  document.getElementById('co-highpoint').value = '';
  document.getElementById('co-project-notes').value = '';
  setStarRating(0);
  document.getElementById('co-project-section').classList.add('hidden');
  document.getElementById('co-ascents-section').classList.add('hidden');
  document.getElementById('climb-overlay-delete').classList.add('hidden');
  document.getElementById('co-route-error').classList.add('hidden');
  overlay.classList.remove('hidden');
}

function showEditClimbOverlay(climb) {
  showAddClimbOverlay();
  document.getElementById('climb-overlay-title').textContent = 'Edit Climb';
  document.getElementById('co-record-name').value = climb.recordName ?? '';
  document.getElementById('co-route').value = climb.route ?? '';
  document.getElementById('co-area').value = climb.climbingArea ?? '';
  document.getElementById('co-crag').value = climb.crag ?? '';
  document.getElementById('co-difficulty').value = climb.difficulty ?? '';
  document.getElementById('co-routetype').value = climb.routeType ?? 'Sport';
  document.getElementById('co-date').value = climb.date ? climb.date.toISOString().slice(0, 10) : '';
  document.getElementById('co-sendtype').value = climb.sendType ?? 'Redpoint';
  document.getElementById('co-notes').value = climb.noteText ?? '';
  document.getElementById('co-attempts').value = climb.attemptCount ?? 0;
  document.getElementById('co-highpoint').value = climb.highPoint ?? '';
  document.getElementById('co-project-notes').value = climb.projectNotes ?? '';
  setStarRating(climb.rating ?? 0);
  if (climb.sendType === 'Project') {
    document.getElementById('co-project-section').classList.remove('hidden');
  }
  document.getElementById('co-ascents-section').classList.remove('hidden');
  document.getElementById('climb-overlay-delete').classList.remove('hidden');
  renderAscentsList(climb);
}

function bindClimbOverlayHandlers() {
  function closeOverlay() {
    document.getElementById('climb-overlay').classList.add('hidden');
  }
  document.getElementById('climb-overlay-close').addEventListener('click', closeOverlay);
  document.getElementById('climb-overlay-cancel').addEventListener('click', closeOverlay);
  document.getElementById('climb-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOverlay();
  });

  document.getElementById('co-sendtype').addEventListener('change', function () {
    const projectSection = document.getElementById('co-project-section');
    projectSection.classList.toggle('hidden', this.value !== 'Project');
  });

  document.getElementById('climb-overlay-save').addEventListener('click', async function () {
    const routeVal = document.getElementById('co-route').value.trim();
    if (!routeVal) {
      document.getElementById('co-route').classList.add('error');
      document.getElementById('co-route-error').classList.remove('hidden');
      return;
    }
    document.getElementById('co-route').classList.remove('error');
    document.getElementById('co-route-error').classList.add('hidden');

    const btn = this;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const recordName = document.getElementById('co-record-name').value || undefined;
      const dateVal = document.getElementById('co-date').value;
      await saveClimbNote({
        recordName,
        id:           recordName ? undefined : crypto.randomUUID(),
        route:        routeVal,
        climbingArea: document.getElementById('co-area').value.trim() || null,
        crag:         document.getElementById('co-crag').value.trim() || null,
        difficulty:   document.getElementById('co-difficulty').value.trim() || null,
        date:         dateVal ? new Date(dateVal) : null,
        sendType:     document.getElementById('co-sendtype').value,
        routeType:    document.getElementById('co-routetype').value,
        rating:       currentStarRating,
        noteText:     document.getElementById('co-notes').value.trim() || null,
        attemptCount: Number(document.getElementById('co-attempts').value) || 0,
        highPoint:    document.getElementById('co-highpoint').value.trim() || null,
        projectNotes: document.getElementById('co-project-notes').value.trim() || null,
      });
      closeOverlay();
      await loadData();
    } catch (err) {
      console.error('Save climb failed:', err);
      alert('Save failed: ' + (err.message ?? err));
    } finally {
      btn.disabled = false; btn.textContent = 'Save Climb';
    }
  });

  document.getElementById('climb-overlay-delete').addEventListener('click', async function () {
    const recordName = document.getElementById('co-record-name').value;
    const name = document.getElementById('co-route').value;
    const confirmed = await showConfirmDialog('Delete Climb?', `"${name}" will be permanently deleted.`);
    if (!confirmed) return;
    try {
      await deleteClimbNote(recordName);
      document.getElementById('climb-overlay').classList.add('hidden');
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + (err.message ?? err));
    }
  });

  document.getElementById('btn-add-climb').addEventListener('click', showAddClimbOverlay);
  bindStarPicker();
}

// ---------- Training overlay ----------

function setIntensity(value) {
  document.querySelectorAll('.intensity-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.value) === value);
  });
}

function showAddTrainingOverlay() {
  const overlay = document.getElementById('training-overlay');
  document.getElementById('training-overlay-title').textContent = 'Log Session';
  document.getElementById('to-record-name').value = '';
  document.getElementById('to-type').value = 'Hangboard';
  document.getElementById('to-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('to-duration').value = '60';
  document.getElementById('to-notes').value = '';
  setIntensity(3);
  document.getElementById('training-overlay-delete').classList.add('hidden');
  overlay.classList.remove('hidden');
}

function showEditTrainingOverlay(session) {
  showAddTrainingOverlay();
  document.getElementById('training-overlay-title').textContent = 'Edit Session';
  document.getElementById('to-record-name').value = session.recordName ?? '';
  document.getElementById('to-type').value = session.type ?? 'Gym Session';
  document.getElementById('to-date').value = session.date ? session.date.toISOString().slice(0, 10) : '';
  document.getElementById('to-duration').value = session.duration ?? 60;
  document.getElementById('to-notes').value = session.notes ?? '';
  setIntensity(session.intensity ?? 3);
  document.getElementById('training-overlay-delete').classList.remove('hidden');
}

function bindTrainingOverlayHandlers() {
  function closeOverlay() {
    document.getElementById('training-overlay').classList.add('hidden');
  }
  document.getElementById('training-overlay-close').addEventListener('click', closeOverlay);
  document.getElementById('training-overlay-cancel').addEventListener('click', closeOverlay);
  document.getElementById('training-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOverlay();
  });

  document.querySelectorAll('.intensity-btn').forEach(btn => {
    btn.addEventListener('click', () => setIntensity(Number(btn.dataset.value)));
  });

  document.getElementById('training-overlay-save').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const recordName = document.getElementById('to-record-name').value || undefined;
      const dateVal = document.getElementById('to-date').value;
      const activeIntensityBtn = document.querySelector('.intensity-btn.active');
      await saveTrainingSession({
        recordName,
        id:        recordName ? undefined : crypto.randomUUID(),
        type:      document.getElementById('to-type').value,
        date:      dateVal ? new Date(dateVal) : new Date(),
        duration:  Number(document.getElementById('to-duration').value),
        intensity: activeIntensityBtn ? Number(activeIntensityBtn.dataset.value) : 3,
        notes:     document.getElementById('to-notes').value.trim() || null,
      });
      closeOverlay();
      trainingLoaded = false;
      await loadTrainingData();
    } catch (err) {
      alert('Save failed: ' + (err.message ?? err));
    } finally {
      btn.disabled = false; btn.textContent = 'Save Session';
    }
  });

  document.getElementById('training-overlay-delete').addEventListener('click', async function () {
    const recordName = document.getElementById('to-record-name').value;
    const type = document.getElementById('to-type').value;
    const confirmed = await showConfirmDialog('Delete Session?', `This ${type} session will be permanently deleted.`);
    if (!confirmed) return;
    try {
      await deleteTrainingSession(recordName);
      document.getElementById('training-overlay').classList.add('hidden');
      trainingLoaded = false;
      await loadTrainingData();
    } catch (err) {
      alert('Delete failed: ' + (err.message ?? err));
    }
  });

  document.getElementById('btn-log-session').addEventListener('click', showAddTrainingOverlay);

  document.getElementById('training-list').addEventListener('click', e => {
    const row = e.target.closest('.session-row');
    if (!row) return;
    const session = allSessions.find(s => s.recordName === row.dataset.record);
    if (session) showEditTrainingOverlay(session);
  });
}

// ---------- Training data + rendering ----------

let allSessions = [];
let trainingPeriod = 'allTime';
let trainingLoaded = false;

async function loadTrainingData() {
  if (trainingLoaded) { renderTrainingPage(allSessions, trainingPeriod); return; }
  trainingLoaded = true;
  allSessions = await fetchTrainingSessions();
  document.getElementById('badge-sessions').textContent = allSessions.length;
  renderTrainingPage(allSessions, trainingPeriod);
}

function renderTrainingPage(sessions, period) {
  const stats = computeTrainingStats(sessions, period);

  document.getElementById('ts-total').textContent = stats.totalSessions;
  document.getElementById('ts-time').textContent = stats.formattedTotalTime(stats.totalMinutes);
  document.getElementById('ts-days').textContent = stats.trainingDays;
  document.getElementById('ts-avg').textContent = stats.avgPerWeek.toFixed(1);

  const barsEl = document.getElementById('training-bars');
  const maxCount = Math.max(1, ...Object.values(stats.sessionsByType));
  barsEl.innerHTML = Object.entries(stats.sessionsByType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const pct = Math.round((count / maxCount) * 100);
      const emoji = (typeof TYPE_EMOJI !== 'undefined' ? TYPE_EMOJI[type] : '') || '🏋️';
      return `<div class="training-bar-wrap">
        <div class="training-bar" style="height:${pct}%"></div>
        <div class="training-bar-label">${emoji} ${type.split(' ')[0]}</div>
      </div>`;
    }).join('');

  const listEl = document.getElementById('training-list');
  const filtered = sessions.filter(s => {
    if (period === 'allTime') return true;
    const now = new Date();
    if (!s.date) return false;
    if (period === 'week')  { const w = new Date(now); w.setDate(now.getDate() - 7); return s.date >= w; }
    if (period === 'month') return s.date.getFullYear() === now.getFullYear() && s.date.getMonth() === now.getMonth();
    if (period === 'year')  return s.date.getFullYear() === now.getFullYear();
    return true;
  });
  listEl.innerHTML = filtered.map(s => {
    const emoji = (typeof TYPE_EMOJI !== 'undefined' ? TYPE_EMOJI[s.type] : '') || '🏋️';
    const dateStr = s.date ? s.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const dots = [1, 2, 3, 4, 5].map(i =>
      `<div class="intensity-dot${i <= (s.intensity ?? 0) ? ' filled' : ''}"></div>`
    ).join('');
    return `<div class="session-row" data-record="${s.recordName}">
      <div class="type-icon">${emoji}</div>
      <div class="session-info">
        <div class="session-type">${s.type}</div>
        <div class="session-meta">${dateStr}${s.notes ? ' · ' + s.notes.slice(0, 40) + (s.notes.length > 40 ? '…' : '') : ''}</div>
      </div>
      <div class="session-right">
        <div class="intensity-dots">${dots}</div>
        <div class="session-duration">${s.duration} min</div>
      </div>
    </div>`;
  }).join('') || '<p style="color:#94a3b8;font-size:.875rem;padding:.5rem 0">No sessions in this period.</p>';
}

// ---------- Period tabs ----------

function bindPeriodTabs() {
  document.getElementById('training-period-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;
    trainingPeriod = btn.dataset.period;
    document.querySelectorAll('#training-period-tabs button').forEach(b => b.classList.toggle('active', b === btn));
    renderTrainingPage(allSessions, trainingPeriod);
  });
}

// ---------- Ascent list ----------

function renderAscentsList(climb) {
  const container = document.getElementById('co-ascents-list');
  const ascents = climb.ascents ?? [];
  container.innerHTML = ascents.length
    ? ascents.map(a => {
        const d = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        return `<div class="ascent-row">
          <span class="ascent-date">${d}</span>
          <span class="ascent-type">${a.sendType ?? 'Redpoint'}</span>
          <button class="ascent-delete" data-record="${a.recordName}" title="Delete ascent">✕</button>
        </div>`;
      }).join('')
    : '<p style="color:#94a3b8;font-size:.8rem">No repeat ascents logged.</p>';

  container.querySelectorAll('.ascent-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog('Delete Ascent?', 'This ascent record will be removed.');
      if (!confirmed) return;
      await deleteAscent(btn.dataset.record);
      climb.ascents = (climb.ascents ?? []).filter(a => a.recordName !== btn.dataset.record);
      renderAscentsList(climb);
    });
  });

  document.getElementById('co-add-ascent').onclick = async () => {
    const dateVal = document.getElementById('asc-date').value;
    const sendType = document.getElementById('asc-sendtype').value;
    if (!dateVal) return;
    const climbNoteRecordName = document.getElementById('co-record-name').value;
    const notes = document.getElementById('asc-notes').value.trim() || null;
    const saved = await saveAscent({ date: new Date(dateVal), sendType, notes, climbNoteRecordName });
    document.getElementById('asc-notes').value = '';
    if (!climb.ascents) climb.ascents = [];
    climb.ascents.push({ recordName: saved.recordName, date: new Date(dateVal), sendType });
    renderAscentsList(climb);
    document.getElementById('asc-date').value = '';
  };
}
