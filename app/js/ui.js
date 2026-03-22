// ui.js — Dashboard UI rendering and interaction

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

function bindFilterHandlers(allClimbs) {
  let activeView = 'all'; // 'all' | 'projects' | 'sent'

  function refresh() {
    const area      = document.getElementById('filter-area').value;
    const year      = document.getElementById('filter-year').value;
    const sendType  = document.getElementById('filter-sendtype').value;
    const routeType = document.getElementById('filter-routetype')?.value ?? '';
    const search    = document.getElementById('search-input').value;
    const sort      = document.getElementById('sort-select').value;

    let filtered = filterClimbs(allClimbs, { area, year, sendType, routeType, search, sort });

    // Update badges from search/filter result BEFORE applying the view filter
    // so "All Climbs" count stays stable regardless of which view is active
    updateCountBadges(filtered, allClimbs);

    // Apply sidebar view filter on top
    if (activeView === 'projects') filtered = filtered.filter(c => c.isProject === true);
    else if (activeView === 'sent') filtered = filtered.filter(c => c.isProject === false);

    renderClimbsTable(filtered);
  }

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
  document.getElementById('nav-training')?.addEventListener('click', e => { e.preventDefault(); showToast('Training coming in Phase 3 🏋️', 'info'); });

  // Initial badge update
  updateCountBadges(allClimbs, allClimbs);
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
