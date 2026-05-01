// admin.js — Admin panel for central route database moderation
// Depends on: firebase-routes.js (checkAdminStatus, adminSaveRoute, adminDeleteRoute, getRoute, searchRoutes)
// Depends on: ui.js (escapeHtml, showConfirmDialog, getPreferredGradeSystem)

'use strict';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(date) {
  if (!date) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function uidShort(uid) {
  if (!uid) return '—';
  return uid.length > 12 ? uid.slice(0, 6) + '…' + uid.slice(-4) : uid;
}

// ── Admin view entry point ─────────────────────────────────────────────────

async function showAdminView() {
  document.getElementById('stats-bar').classList.add('hidden');
  document.querySelector('.table-container').classList.add('hidden');
  document.getElementById('training-view').classList.add('hidden');
  document.getElementById('account-view')?.classList.add('hidden');
  document.getElementById('stats-view')?.classList.add('hidden');
  document.getElementById('admin-view').classList.remove('hidden');

  ['view-all', 'view-projects', 'view-sent'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  document.getElementById('view-stats')?.classList.remove('active');
  document.querySelector('[data-view="training"]')?.classList.remove('active');
  document.querySelector('[data-view="admin"]')?.classList.add('active');
  document.getElementById('btn-log-send')?.classList.add('hidden');
  document.getElementById('btn-add-project')?.classList.add('hidden');

  renderAdminSearch();
}

// ── Search panel ───────────────────────────────────────────────────────────

function renderAdminSearch() {
  const view = document.getElementById('admin-view');
  view.innerHTML = `
    <div style="max-width:680px;margin:0 auto;padding:1.5rem 0">
      <h2 style="margin:0 0 1.25rem;font-size:1.25rem">Route Database Admin</h2>

      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input type="text" id="admin-search-name" placeholder="Route name…"
               class="form-input" style="flex:1" autocomplete="off" />
        <input type="text" id="admin-search-crag" placeholder="Crag (optional)"
               class="form-input" style="width:160px" autocomplete="off" />
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;color:#64748b;margin-bottom:1rem;cursor:pointer">
        <input type="checkbox" id="admin-search-orphaned" />
        Show orphaned routes only
      </label>

      <div id="admin-search-results">
        <p style="color:#94a3b8;font-size:0.875rem">Type at least 2 characters to search.</p>
      </div>
    </div>
  `;

  let timer = null;

  function doSearch() {
    const name      = document.getElementById('admin-search-name').value.trim();
    const crag      = document.getElementById('admin-search-crag').value.trim();
    const orphaned  = document.getElementById('admin-search-orphaned').checked;
    const resultsEl = document.getElementById('admin-search-results');

    if (name.length < 2 && !orphaned) {
      resultsEl.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem">Type at least 2 characters to search.</p>';
      return;
    }

    resultsEl.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem">Searching…</p>';

    searchRoutes(name.length >= 2 ? name : '', crag || null, getPreferredGradeSystem(), 40)
      .then(routes => {
        let filtered = orphaned ? routes.filter(r => r.isOrphaned) : routes;
        if (!filtered.length) {
          resultsEl.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem">No routes found.</p>';
          return;
        }
        resultsEl.innerHTML = filtered.map(r => `
          <div class="admin-route-row" data-id="${escapeHtml(r.id)}" style="
            display:flex;justify-content:space-between;align-items:center;
            padding:10px 12px;border:1px solid var(--border-color);
            border-radius:8px;margin-bottom:6px;cursor:pointer;
            background:${r.isOrphaned ? '#fff7ed' : 'var(--card-bg, #fff)'}">
            <div>
              <div style="font-weight:600;font-size:0.95rem">
                ${escapeHtml(r.name)}
                ${r.isOrphaned ? '<span style="font-size:0.7rem;color:#f97316;margin-left:6px;background:#ffedd5;padding:1px 6px;border-radius:4px">orphaned</span>' : ''}
              </div>
              <div style="font-size:0.8rem;color:#64748b">
                ${escapeHtml(r.crag)}${r.climbingArea ? ' · ' + escapeHtml(r.climbingArea) : ''} · ${escapeHtml(r.routeType)} · ${escapeHtml(r.displayGrade)}
              </div>
            </div>
            <div style="font-size:0.8rem;color:#94a3b8;text-align:right">
              ✓ ${r.sendCount} &nbsp; 📌 ${r.projectCount}
            </div>
          </div>
        `).join('');

        resultsEl.querySelectorAll('.admin-route-row').forEach(el => {
          const route = filtered.find(r => r.id === el.dataset.id);
          if (route) el.addEventListener('click', () => openAdminEditForm(route.id));
        });
      })
      .catch(err => {
        console.error('Admin search error:', err);
        resultsEl.innerHTML = '<p style="color:#ef4444;font-size:0.875rem">Search failed. Check your connection.</p>';
      });
  }

  ['admin-search-name', 'admin-search-crag'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(doSearch, 300);
    });
  });
  document.getElementById('admin-search-orphaned').addEventListener('change', doSearch);
}

// ── Edit form — fetch full doc then render ─────────────────────────────────

async function openAdminEditForm(routeID) {
  const view = document.getElementById('admin-view');
  view.innerHTML = '<div style="max-width:560px;margin:0 auto;padding:1.5rem 0;color:#94a3b8;font-size:0.875rem">Loading…</div>';
  try {
    const route = await getRoute(routeID);
    if (!route) throw new Error('Route not found');
    renderAdminEditForm(route);
  } catch (err) {
    console.error('openAdminEditForm failed:', err);
    view.innerHTML = `<div style="max-width:560px;margin:0 auto;padding:1.5rem 0">
      <button id="admin-back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1rem">← Back</button>
      <p style="color:#ef4444">Failed to load route: ${escapeHtml(err.message ?? err)}</p>
    </div>`;
    document.getElementById('admin-back-btn')?.addEventListener('click', renderAdminSearch);
  }
}

// ── Edit form render ───────────────────────────────────────────────────────

function renderAdminEditForm(route) {
  const currentUID = auth.currentUser?.uid ?? '';

  // Convert stored French grade back to display system for editing
  const displayGrade = typeof convertFromFrench === 'function'
    ? convertFromFrench(route.grade, getPreferredGradeSystem())
    : route.createdGrade || route.grade;

  // ── Audit: recent edits ────────────────────────────────────────────────
  const recentEditsHtml = route.recentEdits.length ? `
    <div style="margin-bottom:1rem">
      <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem">
        Recent Edits (last ${route.recentEdits.length})
      </div>
      ${route.recentEdits.map(e => `
        <div style="font-size:0.8rem;color:#64748b;padding:3px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:8px">
          <span style="color:#94a3b8;min-width:140px">${fmtDateTime(e.editedAt)}</span>
          <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(e.editedBy)}">${uidShort(e.editedBy)}</span>
          ${e.editedBy === currentUID ? '<span style="color:#6366f1;font-size:0.7rem">(you)</span>' : ''}
        </div>
      `).join('')}
    </div>
  ` : '<p style="font-size:0.8rem;color:#94a3b8;margin-bottom:1rem">No edit history recorded yet.</p>';

  // ── Audit: last ownership transfer ────────────────────────────────────
  const lot = route.lastOwnershipTransfer;
  const ownershipHtml = lot ? `
    <div style="margin-bottom:1rem">
      <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem">
        Last Ownership Transfer
      </div>
      <div style="font-size:0.8rem;color:#64748b;background:#f8fafc;border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;line-height:1.8">
        <div><span style="color:#94a3b8;width:80px;display:inline-block">When</span> ${fmtDateTime(lot.transferredAt)}</div>
        <div><span style="color:#94a3b8;width:80px;display:inline-block">From</span> <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(lot.fromUID ?? '')}">${uidShort(lot.fromUID)}</span></div>
        <div><span style="color:#94a3b8;width:80px;display:inline-block">To</span> <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(lot.toUID ?? '')}">${uidShort(lot.toUID)}</span></div>
        <div><span style="color:#94a3b8;width:80px;display:inline-block">By admin</span> <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(lot.transferredBy ?? '')}">${uidShort(lot.transferredBy)}</span>${lot.transferredBy === currentUID ? ' <span style="color:#6366f1;font-size:0.7rem">(you)</span>' : ''}</div>
      </div>
    </div>
  ` : '<p style="font-size:0.8rem;color:#94a3b8;margin-bottom:1rem">No ownership transfer recorded.</p>';

  const view = document.getElementById('admin-view');
  view.innerHTML = `
    <div style="max-width:560px;margin:0 auto;padding:1.5rem 0">
      <button id="admin-back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1.25rem">
        ← Back to search
      </button>
      <h2 style="margin:0 0 1.25rem;font-size:1.25rem">Edit Route</h2>

      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" id="admin-f-name" class="form-input" value="${escapeHtml(route.name)}" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Climbing Area</label>
          <input type="text" id="admin-f-area" class="form-input" value="${escapeHtml(route.climbingArea)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Crag</label>
          <input type="text" id="admin-f-crag" class="form-input" value="${escapeHtml(route.crag)}" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Grade</label>
          <input type="text" id="admin-f-grade" class="form-input" value="${escapeHtml(displayGrade)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Route Type</label>
          <select id="admin-f-routetype" class="form-input">
            ${['Sport','Trad','Boulder','Ice','Mixed','Via Ferrata','Top Rope'].map(t =>
              `<option${route.routeType === t ? ' selected' : ''}>${escapeHtml(t)}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div style="border-top:1px solid var(--border-color);margin:1.25rem 0;padding-top:1.25rem">
        <div style="font-size:0.75rem;font-weight:600;color:#f97316;margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.05em">
          ⚙ Admin Fields
        </div>

        <div class="form-group">
          <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
            <span>Owner UID <span style="font-weight:400;color:#94a3b8">(paste new UID to transfer)</span></span>
            <button id="admin-transfer-to-me" class="btn btn-secondary btn-sm" style="font-size:0.75rem;padding:2px 8px">
              Transfer to me
            </button>
          </label>
          <input type="text" id="admin-f-createdby" class="form-input"
                 value="${escapeHtml(route.createdBy ?? '')}"
                 style="font-family:monospace;font-size:0.82rem" />
        </div>

        <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer;margin-top:0.5rem">
          <input type="checkbox" id="admin-f-orphaned" ${route.isOrphaned ? 'checked' : ''} />
          Mark as orphaned
        </label>
      </div>

      <div style="border-top:1px solid var(--border-color);margin:1.25rem 0;padding-top:1.25rem">
        <div style="font-size:0.75rem;font-weight:600;color:#64748b;margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.05em">
          Audit Trail
        </div>
        ${recentEditsHtml}
        ${ownershipHtml}
      </div>

      <div style="background:#f8fafc;border:1px solid var(--border-color);border-radius:8px;padding:0.75rem;margin-bottom:1.25rem;font-size:0.8rem;color:#64748b">
        <strong>Route ID:</strong> <span style="font-family:monospace;font-size:0.75rem">${escapeHtml(route.id)}</span><br>
        <strong>Last saved:</strong> ${fmtDateTime(route.updatedAt)}
        ${route.updatedBy ? ` &nbsp;·&nbsp; <span title="${escapeHtml(route.updatedBy)}">${uidShort(route.updatedBy)}</span>` : ''}
        &nbsp;·&nbsp; <strong>Sends:</strong> ${route.sendCount} &nbsp; <strong>Projects:</strong> ${route.projectCount}
      </div>

      <div style="display:flex;gap:8px;justify-content:space-between;align-items:center">
        <button id="admin-delete-btn" class="btn btn-danger btn-sm">Delete Route</button>
        <div style="display:flex;gap:8px">
          <button id="admin-cancel-btn" class="btn btn-secondary btn-sm">Cancel</button>
          <button id="admin-save-btn" class="btn btn-primary btn-sm">Save Changes</button>
        </div>
      </div>
      <div id="admin-form-status" style="margin-top:0.75rem;font-size:0.875rem;min-height:1.2em"></div>
    </div>
  `;

  document.getElementById('admin-back-btn').addEventListener('click', renderAdminSearch);
  document.getElementById('admin-cancel-btn').addEventListener('click', renderAdminSearch);

  document.getElementById('admin-transfer-to-me').addEventListener('click', () => {
    document.getElementById('admin-f-createdby').value = auth.currentUser?.uid ?? '';
  });

  document.getElementById('admin-save-btn').addEventListener('click', async () => {
    const btn    = document.getElementById('admin-save-btn');
    const status = document.getElementById('admin-form-status');
    btn.disabled = true; btn.textContent = 'Saving…';
    status.textContent = '';
    try {
      await adminSaveRoute(route.id, {
        name:         document.getElementById('admin-f-name').value.trim(),
        climbingArea: document.getElementById('admin-f-area').value.trim(),
        crag:         document.getElementById('admin-f-crag').value.trim(),
        grade:        document.getElementById('admin-f-grade').value.trim(),
        gradeSystem:  getPreferredGradeSystem(),
        routeType:    document.getElementById('admin-f-routetype').value,
        createdBy:    document.getElementById('admin-f-createdby').value.trim(),
        isOrphaned:   document.getElementById('admin-f-orphaned').checked,
      });
      status.style.color = 'var(--success-color, #16a34a)';
      status.textContent = '✓ Saved successfully';
      // Refresh the form to show updated audit trail
      setTimeout(() => openAdminEditForm(route.id), 800);
    } catch (err) {
      console.error('adminSaveRoute failed:', err);
      status.style.color = '#ef4444';
      status.textContent = '✗ Save failed: ' + (err.message ?? err);
    } finally {
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  });

  document.getElementById('admin-delete-btn').addEventListener('click', async () => {
    const name = document.getElementById('admin-f-name').value.trim() || route.name;
    const confirmed = await showConfirmDialog(
      'Delete Route?',
      `"${name}" will be permanently removed from the community database. This cannot be undone.`
    );
    if (!confirmed) return;
    const btn = document.getElementById('admin-delete-btn');
    btn.disabled = true; btn.textContent = 'Deleting…';
    try {
      await adminDeleteRoute(route.id);
      renderAdminSearch();
    } catch (err) {
      console.error('adminDeleteRoute failed:', err);
      const status = document.getElementById('admin-form-status');
      status.style.color = '#ef4444';
      status.textContent = '✗ Delete failed: ' + (err.message ?? err);
      btn.disabled = false; btn.textContent = 'Delete Route';
    }
  });
}
