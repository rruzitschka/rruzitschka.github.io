// ui.js — Dashboard UI rendering and interaction

// ---------- Module-level state ----------

let _allClimbs = [];
let _currentRefresh = null;
let _currentPage = 1;
let _filteredClimbs = [];
const ITEMS_PER_PAGE = 20;

// Central route soft link state (cleared when overlay closes without selection)
let _centralRouteID = null;
let _centralRouteName = '';
let _centralRouteCrag = '';
let _centralRouteArea = '';
let _centralRouteCreatedBy = null;
let _pendingNewCentralRoute = null;

const SEND_CLASSES = {
  'Redpoint':  'send-rp',
  'On Sight':  'send-os',
  'Top Rope':  'send-tr',
  'All Free':  'send-af',
  'Project':   'send-proj',
  'Pinkpoint': 'send-pp'
};

// "Hard" threshold: top ~25% of each grade system
// French ≥ 8b+, UIAA ≥ 11+, YDS ≥ 5.14a
function gradeBadgeClass(difficulty) {
  if (!difficulty) return 'grade-normal';
  const fr = GRADES?.French ?? [];
  const uiaa = GRADES?.UIAA ?? [];
  const yds = GRADES?.YDS ?? [];
  const frIdx  = fr.indexOf(difficulty);
  const uiaaIdx = uiaa.indexOf(difficulty);
  const ydsIdx  = yds.indexOf(difficulty);
  if (frIdx   !== -1) return frIdx   >= fr.indexOf('8b+')   ? 'grade-hard' : 'grade-normal';
  if (uiaaIdx !== -1) return uiaaIdx >= uiaa.indexOf('11+') ? 'grade-hard' : 'grade-normal';
  if (ydsIdx  !== -1) return ydsIdx  >= yds.indexOf('5.14a')? 'grade-hard' : 'grade-normal';
  return 'grade-normal';
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
  _filteredClimbs = climbs || [];
  const tbody   = document.getElementById('climbs-tbody');
  const table   = document.getElementById('climbs-table');
  const empty   = document.getElementById('empty-state');

  tbody.innerHTML = '';

  if (_filteredClimbs.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    renderPagination(0, 0);
    return;
  }

  table.style.display = '';
  empty.style.display = 'none';

  const totalPages = Math.ceil(_filteredClimbs.length / ITEMS_PER_PAGE);
  if (_currentPage > totalPages) _currentPage = totalPages;
  const start = (_currentPage - 1) * ITEMS_PER_PAGE;
  const pageClimbs = _filteredClimbs.slice(start, start + ITEMS_PER_PAGE);

  for (const climb of pageClimbs) {
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

  renderPagination(_filteredClimbs.length, totalPages);
}

function renderPagination(total, totalPages) {
  const bar = document.getElementById('pagination-bar');
  if (!bar) return;
  if (totalPages <= 1) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML = `
    <button class="page-btn" id="page-prev" ${_currentPage <= 1 ? 'disabled' : ''}>&#8249; Prev</button>
    <span class="page-info">Page ${_currentPage} of ${totalPages} <span class="page-count">(${total} climbs)</span></span>
    <button class="page-btn" id="page-next" ${_currentPage >= totalPages ? 'disabled' : ''}>Next &#8250;</button>
  `;
  document.getElementById('page-prev').addEventListener('click', () => {
    if (_currentPage > 1) { _currentPage--; renderClimbsTable(_filteredClimbs); }
  });
  document.getElementById('page-next').addEventListener('click', () => {
    if (_currentPage < totalPages) { _currentPage++; renderClimbsTable(_filteredClimbs); }
  });
}

// ---------- Detail Modal ----------

function showDetailModal(climb) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  const gradeClass = gradeBadgeClass(climb.difficulty);
  const sendClass  = SEND_CLASSES[climb.sendType] ?? 'send-proj';

  let html = `
    <div style="display:flex;align-items:baseline;gap:0.5rem;margin-bottom:0.3rem;flex-wrap:wrap">
      <h2 style="margin:0;line-height:1.3">
        ${escapeHtml(climb.route || '—')}
        <span style="font-weight:400;color:inherit">${escapeHtml(climb.difficulty || '—')}</span>
      </h2>
      ${climb.routeType ? `<span style="font-size:0.9rem;color:#64748b;font-weight:500">${escapeHtml(climb.routeType)}</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
      <span style="color:#64748b;font-size:0.95rem">
        ${escapeHtml(climb.climbingArea || '')}${climb.crag ? ` &rsaquo; ${escapeHtml(climb.crag)}` : ''}
      </span>
      <span class="badge ${sendClass}">${escapeHtml(climb.sendType || '—')}</span>
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

  const detailAscents = climb.ascents ?? [];
  if (detailAscents.length > 0) {
    html += `
      <div style="margin-bottom:1.25rem">
        <div style="font-weight:600;margin-bottom:0.5rem">Repeat Ascents</div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          ${detailAscents.map((a, i) => {
            const d = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
            const border = i < detailAscents.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : '';
            return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;font-size:0.9rem;${border}">
              <span style="color:#64748b;min-width:90px;font-size:0.82rem">${d}</span>
              <span style="flex:1">${escapeHtml(a.sendType ?? 'Redpoint')}</span>
              ${a.notes ? `<span style="color:#64748b;font-size:0.85rem;font-style:italic">${escapeHtml(a.notes)}</span>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Photos section: async-loaded from Firestore sub-collection
  html += `<div id="modal-photos-container" style="margin-bottom:1rem"></div>`;

  html += `<div style="display:flex;justify-content:flex-end;margin-top:.5rem">
    <button id="detail-edit-btn" class="btn btn-primary btn-sm">Edit Climb</button>
  </div>`;

  content.innerHTML = html;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Async photo load
  if (climb.recordName && typeof fetchPhotos === 'function') {
    fetchPhotos(climb.recordName).then(photos => {
      const container = document.getElementById('modal-photos-container');
      if (!container || photos.length === 0) return;
      container.innerHTML = `
        <div style="font-weight:600;margin-bottom:0.5rem">Photos</div>
        <div style="display:flex;gap:0.5rem;overflow-x:auto;padding-bottom:0.25rem">
          ${photos.map(p => `
            <a href="${escapeHtml(p.storageURL)}" target="_blank" rel="noopener" style="flex-shrink:0">
              <img src="${escapeHtml(p.storageURL)}" alt="Route photo"
                style="height:120px;width:auto;max-width:160px;object-fit:cover;border-radius:8px;display:block">
            </a>
          `).join('')}
        </div>
      `;
    });
  }

  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    hideDetailModal();
    if (climb.sendType === 'Project') {
      showEditProjectOverlay(climb);
    } else {
      showEditSendOverlay(climb);
    }
  });
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

function renderUserChip(user) {
  const chip = document.getElementById('user-chip');
  if (!chip) return;
  const name = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Climber';
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
  window.allClimbs = initialClimbs;
  let activeView = 'all'; // 'all' | 'projects' | 'sent'

  function refresh() {
    _currentPage = 1; // reset to first page on any filter/search change
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
    if (activeView === 'projects') filtered = filtered.filter(c => !!c.isProject);
    else if (activeView === 'sent') filtered = filtered.filter(c => !c.isProject);

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
    document.getElementById('stats-view')?.classList.add('hidden');
    ['view-all', 'view-projects', 'view-sent'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    // Deactivate training and stats sidebar items
    document.querySelector('[data-view="training"]')?.classList.remove('active');
    document.getElementById('view-stats')?.classList.remove('active');
    const viewMap  = { all: 'view-all', projects: 'view-projects', sent: 'view-sent' };
    const labelMap = { all: 'All Climbs', projects: 'Projects', sent: 'Sent Climbs' };
    document.getElementById(viewMap[view])?.classList.add('active');
    const lbl = document.getElementById('view-label');
    if (lbl) lbl.textContent = labelMap[view] ?? 'All Climbs';
    // Context-aware action button
    const logSendBtn = document.getElementById('btn-log-send');
    const addProjectBtn = document.getElementById('btn-add-project');
    if (logSendBtn && addProjectBtn) {
      logSendBtn.classList.toggle('hidden', view === 'projects' || view === 'training');
      addProjectBtn.classList.toggle('hidden', view !== 'projects');
    }
    refresh();
  }

  document.getElementById('view-all')?.addEventListener('click', e => { e.preventDefault(); setActiveView('all'); });
  document.getElementById('view-projects')?.addEventListener('click', e => { e.preventDefault(); setActiveView('projects'); });
  document.getElementById('view-sent')?.addEventListener('click', e => { e.preventDefault(); setActiveView('sent'); });

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

  document.getElementById('view-stats')?.addEventListener('click', e => {
    e.preventDefault();
    showStatsView();
  });

  document.getElementById('view-account')?.addEventListener('click', e => {
    e.preventDefault();
    showAccountView();
  });

  document.getElementById('account-export-btn')?.addEventListener('click', exportCSV);
  document.getElementById('delete-account-btn')?.addEventListener('click', handleDeleteAccount);

  bindSendOverlayHandlers();
  bindProjectOverlayHandlers();
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

// ---------- Export CSV ----------

function exportCSV() {
  const header = 'Date,Route,Area,Crag,Grade,Rating,Note,SendType,RouteType,ProjectStatus,AttemptCount,HighPoint,LastAttemptDate,ProjectNotes,AscentType,AscentID,AscentNotes,AscentDate\n';
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-CA') : ''; // YYYY-MM-DD
  let rows = '';
  for (const c of _allClimbs) {
    const base = [
      esc(fmtDate(c.date)), esc(c.route), esc(c.climbingArea), esc(c.crag),
      esc(c.difficulty), esc(c.rating ?? 0), esc(c.noteText), esc(c.sendType),
      esc(c.routeType), esc(c.projectStatus), esc(c.attemptCount ?? 0),
      esc(c.highPoint), esc(fmtDate(c.lastAttemptDate)), esc(c.projectNotes),
    ].join(',');
    rows += base + ',' + [esc('FirstSend'), esc(c.id ?? c.recordName), esc(''), esc(fmtDate(c.date))].join(',') + '\n';
    for (const a of c.ascents ?? []) {
      rows += base + ',' + [esc('Repeat'), esc(a.id ?? a.recordName), esc(a.notes), esc(fmtDate(a.date))].join(',') + '\n';
    }
  }
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sendlog-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Delete account ----------

async function handleDeleteAccount() {
  if (typeof deleteAccount !== 'function') {
    showToast('Account deletion is not available in this mode.', 'info');
    return;
  }
  const confirmed = await showConfirmDialog(
    'Delete Account',
    'Your cloud data (climbs, ascents, photos) will be permanently deleted from the server. Your local session will end. This cannot be undone.'
  );
  if (!confirmed) return;
  try {
    await deleteAccount();
    window.location.href = '../login.html';
  } catch (err) {
    console.error('Delete account failed:', err);
    showToast('Failed to delete account. Please try again.', 'error');
  }
}

// ---------- loadData ----------

async function loadData() {
  showLoading(true);
  try {
    const climbs = await fetchClimbs();
    showLoading(false);
    _allClimbs = climbs;
    window.allClimbs = climbs;
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
  document.getElementById('account-view')?.classList.add('hidden');
  document.getElementById('stats-view')?.classList.add('hidden');
  // Sidebar active state
  ['view-all', 'view-projects', 'view-sent', 'view-account'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  document.getElementById('view-stats')?.classList.remove('active');
  document.querySelector('[data-view="training"]')?.classList.add('active');
  document.getElementById('btn-log-send')?.classList.add('hidden');
  document.getElementById('btn-add-project')?.classList.add('hidden');
  loadTrainingData();
}

function showLogbookView() {
  document.getElementById('stats-bar').classList.remove('hidden');
  document.querySelector('.table-container').classList.remove('hidden');
  document.getElementById('training-view').classList.add('hidden');
  document.getElementById('account-view')?.classList.add('hidden');
  document.getElementById('stats-view')?.classList.add('hidden');
}

function showAccountView() {
  document.getElementById('stats-bar').classList.add('hidden');
  document.querySelector('.table-container').classList.add('hidden');
  document.getElementById('training-view').classList.add('hidden');
  document.getElementById('stats-view')?.classList.add('hidden');
  document.getElementById('account-view').classList.remove('hidden');
  // Clear sidebar active state (account is in header, not sidebar)
  ['view-all', 'view-projects', 'view-sent'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  document.querySelector('[data-view="training"]')?.classList.remove('active');
  document.getElementById('view-stats')?.classList.remove('active');
  document.getElementById('btn-log-send')?.classList.add('hidden');
  document.getElementById('btn-add-project')?.classList.add('hidden');

  // Populate user info
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const nameEl  = document.getElementById('account-name');
  const emailEl = document.getElementById('account-email');
  if (nameEl)  nameEl.textContent  = user?.displayName ?? 'Climber';
  if (emailEl) emailEl.textContent = user?.email ?? '';

  // Populate grade system preference (one-time binding on first open)
  const gradeSystemEl = document.getElementById('account-grade-system');
  if (gradeSystemEl && !gradeSystemEl.dataset.bound) {
    gradeSystemEl.value = getPreferredGradeSystem();
    gradeSystemEl.addEventListener('change', () => {
      setPreferredGradeSystem(gradeSystemEl.value);
    });
    gradeSystemEl.dataset.bound = '1';
  } else if (gradeSystemEl) {
    gradeSystemEl.value = getPreferredGradeSystem();
  }
}

async function showStatsView() {
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
  // Fetch sessions directly if not yet loaded (avoids calling renderTrainingPage as a side-effect)
  if (!trainingLoaded) {
    try {
      allSessions = await fetchTrainingSessions();
      window.allSessions = allSessions;
      trainingLoaded = true;
      document.getElementById('badge-sessions').textContent = allSessions.length;
    } catch(e) {
      console.warn('Stats: could not load training sessions', e);
    }
  }
  renderStatsPage(window.allClimbs ?? [], allSessions);
  bindStatsPeriodTabs();
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
  document.querySelectorAll('#so-rating span').forEach((span, i) => {
    span.classList.toggle('filled', i < value);
  });
}

function bindStarPicker() {
  document.querySelectorAll('#so-rating span').forEach(span => {
    span.addEventListener('click', () => setStarRating(Number(span.dataset.value)));
    span.addEventListener('mouseenter', () => {
      const v = Number(span.dataset.value);
      document.querySelectorAll('#so-rating span').forEach((s, i) => {
        s.classList.toggle('filled', i < v);
      });
    });
    span.addEventListener('mouseleave', () => setStarRating(currentStarRating));
  });
}

function setStylePill(value) {
  const styleMap = {
    'Redpoint':  'active-rp',
    'On Sight':  'active-os',
    'Top Rope':  'active-tr',
    'All Free':  'active-af',
    'Pinkpoint': 'active-pk',
  };
  document.querySelectorAll('#so-style-tabs .style-tab').forEach(tab => {
    tab.className = 'style-tab';
    if (tab.dataset.style === value) tab.classList.add(styleMap[value] ?? '');
  });
  const hidden = document.getElementById('so-sendtype');
  if (hidden) hidden.value = value;
}

// ---------- Route search overlay ----------

/** Update a find-route button to linked state, with 👤 if the current user owns the route. */
function setFindRouteLinked(btnId, routeName, createdBy) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const isOwned = createdBy && createdBy === auth.currentUser?.uid;
  btn.textContent = isOwned ? '✓ 👤' : '✓';
  btn.title = isOwned ? `✓ ${routeName} (you created this route)` : `✓ ${routeName}`;
  btn.style.color = 'var(--success-color, green)';
}

/** Reset a find-route button to unlinked state. */
function setFindRouteUnlinked(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.textContent = '🔍';
  btn.title = 'Find Route in Database';
  btn.style.color = '';
}

/**
 * Build and inject a route search overlay into the DOM.
 * @param {string} displaySystem - User's grade system ('French'|'YDS'|'UIAA')
 * @param {function} onSelect - called with (route, isNew) when user picks/creates a route
 */
function buildRouteSearchOverlay(displaySystem, onSelect) {
  document.getElementById('route-search-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'route-search-overlay';
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:500px;max-height:80vh;display:flex;flex-direction:column;padding:0;overflow:hidden;">
      <div class="modal-header" style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-color);flex-shrink:0;">
        <h3 class="modal-title">Find Route</h3>
        <button class="modal-close" id="route-search-close">&times;</button>
      </div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
        <input type="text" id="route-search-name" placeholder="Route name…"
               class="form-input" autocomplete="off" />
        <input type="text" id="route-search-crag" placeholder="Crag (optional filter)"
               class="form-input" autocomplete="off" />
      </div>
      <div id="route-search-results" style="overflow-y:auto;flex:1;padding:0 12px 12px;">
        <p class="text-muted" style="font-size:13px;">Type at least 2 characters to search.</p>
      </div>
      <div style="padding:12px;border-top:1px solid var(--border-color);flex-shrink:0;">
        <button id="route-search-create" class="btn btn-secondary" style="width:100%;display:none;">
          + Create new route
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let searchTimer = null;

  function doSearch() {
    const name = document.getElementById('route-search-name').value.trim();
    const crag = document.getElementById('route-search-crag').value.trim();
    const createBtn = document.getElementById('route-search-create');
    const resultsEl = document.getElementById('route-search-results');

    createBtn.style.display = name.length >= 2 ? 'block' : 'none';
    createBtn.textContent = `+ Create "${name}"`;

    if (name.length < 2) {
      resultsEl.innerHTML = '<p class="text-muted" style="font-size:13px;">Type at least 2 characters to search.</p>';
      return;
    }

    resultsEl.innerHTML = '<p class="text-muted" style="font-size:13px;">Searching…</p>';

    searchRoutes(name, crag || null, displaySystem, 20).then(routes => {
      if (!routes.length) {
        resultsEl.innerHTML = '<p class="text-muted" style="font-size:13px;">No routes found. Use the button below to create a new one.</p>';
        return;
      }
      const currentUID = auth.currentUser?.uid ?? null;
      resultsEl.innerHTML = routes.map(r => `
        <div class="route-search-result" data-id="${r.id}" style="
          padding:10px 8px;border-bottom:1px solid var(--border-color);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${escapeHtml(r.name)}${r.createdBy === currentUID ? ' <span title="You created this route" style="font-size:11px;">👤</span>' : ''}</strong>
            <span style="color:var(--accent-color);font-weight:600;">${escapeHtml(r.displayGrade)}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            ${escapeHtml(r.crag)}${r.climbingArea ? ' · ' + escapeHtml(r.climbingArea) : ''} · ${escapeHtml(r.routeType)}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            ✓ ${r.sendCount} sends · ${r.projectCount} projecting
          </div>
        </div>
      `).join('');

      resultsEl.querySelectorAll('.route-search-result').forEach(el => {
        el.addEventListener('click', () => {
          const route = routes.find(r => r.id === el.dataset.id);
          if (route) {
            onSelect(route, false);
            overlay.remove();
          }
        });
      });
    }).catch(err => {
      console.error('Route search error:', err);
      resultsEl.innerHTML = '<p style="color:red;font-size:13px;">Search failed. Check your connection.</p>';
    });
  }

  ['route-search-name', 'route-search-crag'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 300);
    });
  });

  document.getElementById('route-search-create').addEventListener('click', () => {
    const name = document.getElementById('route-search-name').value.trim();
    const crag = document.getElementById('route-search-crag').value.trim();

    const resultsEl = document.getElementById('route-search-results');
    const existingItems = resultsEl.querySelectorAll('.route-search-result');
    const hasDupes = [...existingItems].some(el => {
      const nameEl = el.querySelector('strong');
      return nameEl && nameEl.textContent.toLowerCase() === name.toLowerCase();
    });

    const proceed = () => {
      const newRoute = {
        id: null,
        name,
        climbingArea: '',
        crag,
        grade: '',
        displayGrade: '',
        routeType: 'Sport',
        isNew: true,
      };
      onSelect(newRoute, true);
      overlay.remove();
    };

    if (hasDupes) {
      if (confirm(`Similar routes exist at this crag. Create "${name}" as a new entry anyway?`)) {
        proceed();
      }
    } else {
      proceed();
    }
  });

  document.getElementById('route-search-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  setTimeout(() => document.getElementById('route-search-name')?.focus(), 50);
}

// ---------- Send overlay ----------

function showAddSendOverlay(prefill = {}) {
  const overlay = document.getElementById('send-overlay');
  document.getElementById('send-overlay-title').textContent = 'Log Send';
  document.getElementById('so-record-name').value = '';
  document.getElementById('so-route').value = prefill.route ?? '';
  document.getElementById('so-area').value = prefill.climbingArea ?? '';
  document.getElementById('so-crag').value = prefill.crag ?? '';
  initGradePicker(document.getElementById('so-difficulty'), prefill.difficulty ?? null);
  document.getElementById('so-routetype').value = prefill.routeType ?? 'Sport';
  document.getElementById('so-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('so-notes').value = '';
  setStarRating(0);
  setStylePill('Redpoint');
  document.getElementById('so-ascents-section').classList.add('hidden');
  document.getElementById('so-ascent-form').classList.add('hidden');
  document.getElementById('so-ascent-toggle').textContent = '+ Add';
  document.getElementById('send-overlay-delete').classList.add('hidden');
  document.getElementById('so-route-error').classList.add('hidden');
  document.getElementById('so-route').classList.remove('error');
  overlay.dataset.projectRecordName = prefill.projectRecordName ?? '';

  // Restore soft link if coming from a linked project (mark-as-sent flow)
  if (prefill.centralRouteID) {
    _centralRouteID        = prefill.centralRouteID;
    _centralRouteName      = prefill.route || '';
    _centralRouteCrag      = prefill.crag || '';
    _centralRouteArea      = prefill.climbingArea || '';
    _centralRouteCreatedBy = prefill.centralRouteCreatedBy ?? null;
    setFindRouteLinked('find-route-btn-send', prefill.route, _centralRouteCreatedBy);
  }

  overlay.classList.remove('hidden');
}

function showEditSendOverlay(climb) {
  showAddSendOverlay();
  document.getElementById('send-overlay-title').textContent = 'Edit Send';
  document.getElementById('so-record-name').value = climb.recordName ?? '';
  document.getElementById('so-route').value = climb.route ?? '';
  document.getElementById('so-area').value = climb.climbingArea ?? '';
  document.getElementById('so-crag').value = climb.crag ?? '';
  initGradePicker(document.getElementById('so-difficulty'), climb.difficulty ?? null);
  document.getElementById('so-routetype').value = climb.routeType ?? 'Sport';
  document.getElementById('so-date').value = climb.date ? climb.date.toISOString().slice(0, 10) : '';
  document.getElementById('so-notes').value = climb.noteText ?? '';
  setStarRating(climb.rating ?? 0);
  setStylePill(climb.sendType ?? 'Redpoint');
  document.getElementById('so-ascents-section').classList.remove('hidden');
  document.getElementById('send-overlay-delete').classList.remove('hidden');
  renderAscentsList(climb);

  if (climb.centralRouteID) {
    _centralRouteID        = climb.centralRouteID;
    _centralRouteName      = climb.route || '';
    _centralRouteCrag      = climb.crag || '';
    _centralRouteArea      = climb.climbingArea || '';
    _centralRouteCreatedBy = null;
    setFindRouteLinked('find-route-btn-send', climb.route, null);
    // Fetch createdBy asynchronously to update ownership icon
    db.collection('routes').doc(climb.centralRouteID).get()
      .then(doc => {
        if (doc.exists) {
          _centralRouteCreatedBy = doc.data().createdBy ?? null;
          setFindRouteLinked('find-route-btn-send', climb.route, _centralRouteCreatedBy);
        }
      }).catch(() => {});
  }
}

function showAddProjectOverlay() {
  const overlay = document.getElementById('project-overlay');
  document.getElementById('project-overlay-title').textContent = 'Add Project';
  document.getElementById('po-record-name').value = '';
  document.getElementById('po-route').value = '';
  document.getElementById('po-area').value = '';
  document.getElementById('po-crag').value = '';
  initGradePicker(document.getElementById('po-difficulty'), null);
  document.getElementById('po-routetype').value = 'Sport';
  document.getElementById('po-attempts').value = '0';
  document.getElementById('po-last-attempt-date').value = '';
  document.getElementById('po-highpoint').value = '';
  document.getElementById('po-status').value = 'Working';
  document.getElementById('po-notes').value = '';
  document.getElementById('po-mark-sent-section').classList.add('hidden');
  document.getElementById('project-overlay-delete').classList.add('hidden');
  document.getElementById('po-route-error').classList.add('hidden');
  document.getElementById('po-route').classList.remove('error');
  overlay.classList.remove('hidden');
}

function showEditProjectOverlay(climb) {
  showAddProjectOverlay();
  document.getElementById('project-overlay-title').textContent = 'Edit Project';
  document.getElementById('po-record-name').value = climb.recordName ?? '';
  document.getElementById('po-route').value = climb.route ?? '';
  document.getElementById('po-area').value = climb.climbingArea ?? '';
  document.getElementById('po-crag').value = climb.crag ?? '';
  initGradePicker(document.getElementById('po-difficulty'), climb.difficulty ?? null);
  document.getElementById('po-routetype').value = climb.routeType ?? 'Sport';
  document.getElementById('po-attempts').value = climb.attemptCount ?? 0;
  document.getElementById('po-last-attempt-date').value =
    climb.lastAttemptDate ? climb.lastAttemptDate.toISOString().slice(0, 10) : '';
  document.getElementById('po-highpoint').value = climb.highPoint ?? '';
  document.getElementById('po-status').value = climb.projectStatus ?? 'Working';
  document.getElementById('po-notes').value = climb.noteText ?? '';
  document.getElementById('po-mark-sent-section').classList.remove('hidden');
  document.getElementById('project-overlay-delete').classList.remove('hidden');

  if (climb.centralRouteID) {
    _centralRouteID        = climb.centralRouteID;
    _centralRouteName      = climb.route || '';
    _centralRouteCrag      = climb.crag || '';
    _centralRouteArea      = climb.climbingArea || '';
    _centralRouteCreatedBy = null;
    setFindRouteLinked('find-route-btn-project', climb.route, null);
    db.collection('routes').doc(climb.centralRouteID).get()
      .then(doc => {
        if (doc.exists) {
          _centralRouteCreatedBy = doc.data().createdBy ?? null;
          setFindRouteLinked('find-route-btn-project', climb.route, _centralRouteCreatedBy);
        }
      }).catch(() => {});
  }
}

function bindSendOverlayHandlers() {
  function closeOverlay() {
    document.getElementById('send-overlay').classList.add('hidden');
    _centralRouteID = null;
    _centralRouteName = '';
    _centralRouteCrag = '';
    _centralRouteArea = '';
    _centralRouteCreatedBy = null;
    _pendingNewCentralRoute = null;
    const btn = document.getElementById('find-route-btn-send');
    setFindRouteUnlinked(btn.id);
  }
  document.getElementById('send-overlay-close').addEventListener('click', closeOverlay);
  document.getElementById('send-overlay-cancel').addEventListener('click', closeOverlay);
  document.getElementById('send-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOverlay();
  });

  document.getElementById('find-route-btn-send').addEventListener('click', () => {
    buildRouteSearchOverlay(getPreferredGradeSystem(), (route, isNew) => {
      document.getElementById('so-route').value = route.name || '';
      document.getElementById('so-area').value  = route.climbingArea || '';
      document.getElementById('so-crag').value  = route.crag || '';
      if (route.displayGrade) initGradePicker(document.getElementById('so-difficulty'), route.displayGrade);
      if (route.routeType) document.getElementById('so-routetype').value = route.routeType;
      _centralRouteID        = route.id;
      _centralRouteName      = route.name || '';
      _centralRouteCrag      = route.crag || '';
      _centralRouteArea      = route.climbingArea || '';
      _centralRouteCreatedBy = route.createdBy ?? null;
      if (isNew) { _pendingNewCentralRoute = route; _centralRouteID = null; _centralRouteCreatedBy = null; }
      setFindRouteLinked('find-route-btn-send', route.name, _centralRouteCreatedBy);
    });
  });

  ['so-route', 'so-crag', 'so-area'].forEach(fieldId => {
    document.getElementById(fieldId)?.addEventListener('input', () => {
      if (_centralRouteID && shouldClearSoftLink(
        { name: _centralRouteName, crag: _centralRouteCrag, area: _centralRouteArea },
        { name: document.getElementById('so-route').value,
          crag: document.getElementById('so-crag').value,
          area: document.getElementById('so-area').value }
      )) {
        _centralRouteID = null;
        setFindRouteUnlinked('find-route-btn-send');
      }
    });
  });

  document.querySelectorAll('#so-style-tabs .style-tab').forEach(tab => {
    tab.addEventListener('click', () => setStylePill(tab.dataset.style));
  });

  document.getElementById('send-overlay-save').addEventListener('click', async function () {
    const routeVal = document.getElementById('so-route').value.trim();
    if (!routeVal) {
      document.getElementById('so-route').classList.add('error');
      document.getElementById('so-route-error').classList.remove('hidden');
      return;
    }
    document.getElementById('so-route').classList.remove('error');
    document.getElementById('so-route-error').classList.add('hidden');

    const btn = this;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const recordName = document.getElementById('so-record-name').value || undefined;
      const projectRecordName = document.getElementById('send-overlay').dataset.projectRecordName;

      // Create central route if this is a new entry from the search overlay
      let centralID = _centralRouteID;
      if (_pendingNewCentralRoute) {
        try {
          centralID = await createCentralRoute({
            name:         routeVal,
            climbingArea: document.getElementById('so-area').value.trim() || '',
            crag:         document.getElementById('so-crag').value.trim() || '',
            grade:        document.getElementById('so-difficulty').value || '',
            gradeSystem:  getPreferredGradeSystem(),
            routeType:    document.getElementById('so-routetype').value,
          });
          _centralRouteID = centralID;
        } catch (err) {
          console.warn('Failed to create central route:', err);
          // Don't block save if central route creation fails
        }
        _pendingNewCentralRoute = null;
      }

      await saveClimbNote({
        recordName,
        id:             recordName ? undefined : crypto.randomUUID().toUpperCase(),
        route:          routeVal,
        climbingArea:   document.getElementById('so-area').value.trim() || null,
        crag:           document.getElementById('so-crag').value.trim() || null,
        difficulty:     document.getElementById('so-difficulty').value || null,
        date:           document.getElementById('so-date').value ? new Date(document.getElementById('so-date').value) : null,
        sendType:       document.getElementById('so-sendtype').value,
        routeType:      document.getElementById('so-routetype').value,
        rating:         currentStarRating,
        noteText:       document.getElementById('so-notes').value.trim() || null,
        centralRouteID: centralID ?? null,
      });

      if (centralID) {
        if (projectRecordName) {
          // Coming from mark-as-sent: decrement projectCount + increment sendCount atomically
          completedProject(centralID);
        } else {
          incrementSendCount(centralID);
        }
      }

      if (projectRecordName) {
        try {
          await deleteClimbNote(projectRecordName);
        } catch (delErr) {
          console.error('Mark as Sent: project delete failed', delErr);
          alert('Send saved, but the original project could not be deleted — please delete it manually.');
        }
      }

      closeOverlay();
      await loadData();
    } catch (err) {
      console.error('Save send failed:', err);
      alert('Save failed: ' + (err.message ?? err));
    } finally {
      btn.disabled = false; btn.textContent = 'Save Send';
    }
  });

  document.getElementById('send-overlay-delete').addEventListener('click', async function () {
    const recordName = document.getElementById('so-record-name').value;
    const name = document.getElementById('so-route').value;
    const confirmed = await showConfirmDialog('Delete Send?', `"${name}" will be permanently deleted.`);
    if (!confirmed) return;
    try {
      await deleteClimbNote(recordName);
      closeOverlay();
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + (err.message ?? err));
    }
  });

  document.getElementById('so-ascent-toggle').addEventListener('click', function () {
    const form = document.getElementById('so-ascent-form');
    const isHidden = form.classList.toggle('hidden');
    this.textContent = isHidden ? '+ Add' : '✕';
  });

  document.getElementById('so-ascent-add').addEventListener('click', async function () {
    const climbRecordName = document.getElementById('so-record-name').value;
    if (!climbRecordName) return;
    const dateVal = document.getElementById('so-ascent-date').value;
    const typeVal = document.getElementById('so-ascent-type').value;
    const notesVal = document.getElementById('so-ascent-notes').value.trim();
    try {
      await saveAscent({
        id: crypto.randomUUID(),
        date: dateVal ? new Date(dateVal) : new Date(),
        sendType: typeVal,
        notes: notesVal || null,
        climbNoteRecordName: climbRecordName,
      });
      document.getElementById('so-ascent-date').value = '';
      document.getElementById('so-ascent-notes').value = '';
      document.getElementById('so-ascent-form').classList.add('hidden');
      document.getElementById('so-ascent-toggle').textContent = '+ Add';
      const climb = _allClimbs.find(c => c.recordName === climbRecordName);
      if (climb) renderAscentsList(climb);
      await loadData();
    } catch (err) {
      alert('Add ascent failed: ' + (err.message ?? err));
    }
  });

  document.getElementById('btn-log-send').addEventListener('click', showAddSendOverlay);
  bindStarPicker();
}

function bindProjectOverlayHandlers() {
  function closeOverlay() {
    document.getElementById('project-overlay').classList.add('hidden');
    _centralRouteID = null;
    _centralRouteName = '';
    _centralRouteCrag = '';
    _centralRouteArea = '';
    _centralRouteCreatedBy = null;
    _pendingNewCentralRoute = null;
    const btn = document.getElementById('find-route-btn-project');
    setFindRouteUnlinked(btn.id);
  }
  document.getElementById('project-overlay-close').addEventListener('click', closeOverlay);
  document.getElementById('project-overlay-cancel').addEventListener('click', closeOverlay);
  document.getElementById('project-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOverlay();
  });

  document.getElementById('find-route-btn-project').addEventListener('click', () => {
    buildRouteSearchOverlay(getPreferredGradeSystem(), (route, isNew) => {
      document.getElementById('po-route').value = route.name || '';
      document.getElementById('po-area').value  = route.climbingArea || '';
      document.getElementById('po-crag').value  = route.crag || '';
      if (route.displayGrade) initGradePicker(document.getElementById('po-difficulty'), route.displayGrade);
      if (route.routeType) document.getElementById('po-routetype').value = route.routeType;
      _centralRouteID        = route.id;
      _centralRouteName      = route.name || '';
      _centralRouteCrag      = route.crag || '';
      _centralRouteArea      = route.climbingArea || '';
      _centralRouteCreatedBy = route.createdBy ?? null;
      if (isNew) { _pendingNewCentralRoute = route; _centralRouteID = null; _centralRouteCreatedBy = null; }
      setFindRouteLinked('find-route-btn-project', route.name, _centralRouteCreatedBy);
    });
  });

  ['po-route', 'po-crag', 'po-area'].forEach(fieldId => {
    document.getElementById(fieldId)?.addEventListener('input', () => {
      if (_centralRouteID && shouldClearSoftLink(
        { name: _centralRouteName, crag: _centralRouteCrag, area: _centralRouteArea },
        { name: document.getElementById('po-route').value,
          crag: document.getElementById('po-crag').value,
          area: document.getElementById('po-area').value }
      )) {
        _centralRouteID = null;
        setFindRouteUnlinked('find-route-btn-project');
      }
    });
  });

  document.getElementById('project-overlay-save').addEventListener('click', async function () {
    const routeVal = document.getElementById('po-route').value.trim();
    if (!routeVal) {
      document.getElementById('po-route').classList.add('error');
      document.getElementById('po-route-error').classList.remove('hidden');
      return;
    }
    document.getElementById('po-route').classList.remove('error');
    document.getElementById('po-route-error').classList.add('hidden');

    const btn = this;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const recordName = document.getElementById('po-record-name').value || undefined;
      const lastAttemptVal = document.getElementById('po-last-attempt-date').value;

      // Create central route if this is a new entry from the search overlay
      let centralID = _centralRouteID;
      if (_pendingNewCentralRoute) {
        try {
          centralID = await createCentralRoute({
            name:         routeVal,
            climbingArea: document.getElementById('po-area').value.trim() || '',
            crag:         document.getElementById('po-crag').value.trim() || '',
            grade:        document.getElementById('po-difficulty').value || '',
            gradeSystem:  getPreferredGradeSystem(),
            routeType:    document.getElementById('po-routetype').value,
          });
          _centralRouteID = centralID;
        } catch (err) {
          console.warn('Failed to create central route:', err);
        }
        _pendingNewCentralRoute = null;
      }

      await saveClimbNote({
        recordName,
        id:               recordName ? undefined : crypto.randomUUID().toUpperCase(),
        route:            routeVal,
        climbingArea:     document.getElementById('po-area').value.trim() || null,
        crag:             document.getElementById('po-crag').value.trim() || null,
        difficulty:       document.getElementById('po-difficulty').value || null,
        sendType:         'Project',
        routeType:        document.getElementById('po-routetype').value,
        attemptCount:     Number(document.getElementById('po-attempts').value) || 0,
        lastAttemptDate:  lastAttemptVal ? new Date(lastAttemptVal) : null,
        highPoint:        document.getElementById('po-highpoint').value.trim() || null,
        projectStatus:    document.getElementById('po-status').value,
        noteText:         document.getElementById('po-notes').value.trim() || null,
        centralRouteID:   centralID ?? null,
      });

      if (centralID) {
        const isNew = !recordName;
        const projectStatus = document.getElementById('po-status').value;
        if (isNew) {
          incrementProjectCount(centralID);
        } else if (projectStatus === 'Abandoned') {
          decrementProjectCount(centralID);
        }
      }

      closeOverlay();
      await loadData();
    } catch (err) {
      console.error('Save project failed:', err);
      alert('Save failed: ' + (err.message ?? err));
    } finally {
      btn.disabled = false; btn.textContent = 'Save Project';
    }
  });

  document.getElementById('project-overlay-delete').addEventListener('click', async function () {
    const recordName = document.getElementById('po-record-name').value;
    const name = document.getElementById('po-route').value;
    const confirmed = await showConfirmDialog('Delete Project?', `"${name}" will be permanently deleted.`);
    if (!confirmed) return;
    try {
      await deleteClimbNote(recordName);
      closeOverlay();
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + (err.message ?? err));
    }
  });

  document.getElementById('po-mark-sent').addEventListener('click', function () {
    const projectRecordName = document.getElementById('po-record-name').value;
    const savedCentralRouteID      = _centralRouteID;        // capture before closeOverlay() resets it
    const savedCentralRouteCreatedBy = _centralRouteCreatedBy;
    const prefill = {
      route:                   document.getElementById('po-route').value,
      climbingArea:            document.getElementById('po-area').value,
      crag:                    document.getElementById('po-crag').value,
      difficulty:              document.getElementById('po-difficulty').value,
      routeType:               document.getElementById('po-routetype').value,
      projectRecordName,
      centralRouteID:          savedCentralRouteID,
      centralRouteCreatedBy:   savedCentralRouteCreatedBy,
    };
    closeOverlay();
    showAddSendOverlay(prefill);
  });

  document.getElementById('btn-add-project').addEventListener('click', showAddProjectOverlay);
}

// ---------- Training overlay ----------

function setIntensity(value) {
  document.querySelectorAll('.intensity-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.value) <= value);
  });
}

function showTrainingDetailModal(session) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  const dateStr = session.date
    ? session.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const durationStr = session.duration ? `${session.duration} min` : '—';
  const intensityDots = [1, 2, 3, 4, 5].map(i =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i <= (session.intensity ?? 3) ? '#0f172a' : '#e2e8f0'};margin-right:3px"></span>`
  ).join('');

  let html = `
    <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <h2 style="margin:0;line-height:1.3">${escapeHtml(session.type ?? 'Training')}</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem;margin-bottom:1rem">
      <tr>
        <td style="padding:0.35rem 0;color:#64748b;width:40%">Date</td>
        <td style="padding:0.35rem 0">${dateStr}</td>
      </tr>
      <tr>
        <td style="padding:0.35rem 0;color:#64748b">Duration</td>
        <td style="padding:0.35rem 0">${durationStr}</td>
      </tr>
      <tr>
        <td style="padding:0.35rem 0;color:#64748b">Intensity</td>
        <td style="padding:0.35rem 0">${intensityDots}</td>
      </tr>
    </table>
  `;

  if (session.notes) {
    html += `
      <div style="margin-bottom:1.25rem">
        <div style="font-weight:600;margin-bottom:0.35rem">Notes</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.75rem;white-space:pre-wrap;font-size:0.93rem">${escapeHtml(session.notes)}</div>
      </div>
    `;
  }

  html += `<div style="display:flex;justify-content:flex-end;margin-top:.5rem">
    <button id="training-detail-edit-btn" class="btn btn-primary btn-sm">Edit Session</button>
  </div>`;

  content.innerHTML = html;
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  document.getElementById('training-detail-edit-btn').addEventListener('click', () => {
    hideDetailModal();
    showEditTrainingOverlay(session);
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
    if (session) showTrainingDetailModal(session);
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
  window.allSessions = allSessions;
  document.getElementById('badge-sessions').textContent = allSessions.length;
  renderTrainingPage(allSessions, trainingPeriod);
}

function renderTrainingPage(sessions, period) {
  const stats = computeTrainingStats(sessions, period);

  document.getElementById('ts-total').textContent = stats.totalSessions;
  document.getElementById('ts-time').textContent = stats.formattedTotalTime(stats.totalMinutes);
  document.getElementById('ts-days').textContent = stats.trainingDays;
  document.getElementById('ts-avg').textContent = stats.avgPerWeek.toFixed(1);

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
    return `<div class="session-row" data-record="${escapeHtml(s.recordName)}">
      <div class="type-icon">${emoji}</div>
      <div class="session-info">
        <div class="session-type">${escapeHtml(s.type)}</div>
        <div class="session-meta">${dateStr}${s.notes ? ' · ' + escapeHtml(s.notes.slice(0, 40)) + (s.notes.length > 40 ? '…' : '') : ''}</div>
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
  const container = document.getElementById('so-ascents-list');
  const ascents = climb.ascents ?? [];
  container.innerHTML = ascents.map(a => {
    const d = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    return `<div class="ascent-row">
      <span class="ascent-date">${d}</span>
      <span class="ascent-type">${escapeHtml(a.sendType ?? 'Redpoint')}</span>
      ${a.notes ? `<span class="ascent-notes">${escapeHtml(a.notes)}</span>` : '<span class="ascent-notes"></span>'}
      <button class="ascent-delete" data-record="${escapeHtml(a.recordName)}" title="Delete ascent">✕</button>
    </div>`;
  }).join('');

  container.querySelectorAll('.ascent-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog('Delete Ascent?', 'This ascent record will be removed.');
      if (!confirmed) return;
      await deleteAscent(btn.dataset.record);
      climb.ascents = (climb.ascents ?? []).filter(a => a.recordName !== btn.dataset.record);
      renderAscentsList(climb);
    });
  });
}
