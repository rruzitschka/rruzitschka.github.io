# Send vs Project Overlays — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single "Add Climb" overlay into separate "Log Send" and "Add Project" overlays with type-appropriate fields, fix button alignment, and add a "Mark as Sent" conversion flow.

**Architecture:** All changes are in the `app/` SPA (vanilla HTML/CSS/JS, no build step). The existing `climb-overlay` and its `showAddClimbOverlay`/`showEditClimbOverlay`/`bindClimbOverlayHandlers` functions are replaced wholesale. Projects and sends both use `saveClimbNote` — the distinction is `sendType: 'Project'` vs send styles. No new backend functions needed.

**Tech Stack:** Vanilla JS (ES2020), CSS custom properties, CloudKit JS SDK v2 (mock mode via `?mock=true`), no build tooling.

---

## File Map

| File | What Changes |
|---|---|
| `app/css/app.css` | Append: `.table-header-row`, `.btn-action`, `.btn-project`, `.btn-success`, `.style-tabs`, `.style-tab` + active variants |
| `app/index.html` | Fix header row; rename/add action buttons; replace `climb-overlay` with `send-overlay` + `project-overlay` |
| `app/js/climbs.js` | Add `CD_lastAttemptDate` write in `saveClimbNote` |
| `app/js/mock.js` | Fix 3 project entries: align `projectStatus` values to `Working`/`Close`/`Abandoned` |
| `app/js/ui.js` | Remove `showAddClimbOverlay`/`showEditClimbOverlay`/`bindClimbOverlayHandlers`; add `showAddSendOverlay`, `showEditSendOverlay`, `bindSendOverlayHandlers`, `showAddProjectOverlay`, `showEditProjectOverlay`, `bindProjectOverlayHandlers`, `handleMarkAsSent`; update `setActiveView` for context-aware button; update `setStarRating`/`bindStarPicker` to use `#so-rating`; update row click → edit dispatch |

---

## Task 1: CSS — Header Row + Button Variants + Style Pill Buttons

**Files:**
- Modify: `app/css/app.css` (append at end)

- [ ] **Step 1: Append new CSS rules**

Append to the end of `app/css/app.css`:

```css
/* ---- Table header row (heading + action button) ---- */
.table-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .75rem;
  width: 100%;
}

/* Action button inside header — must not flex-grow */
.btn-action {
  flex: 0 0 auto;
  padding: .4rem .9rem;
  font-size: .82rem;
  font-weight: 600;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all var(--transition-base);
  background: var(--primary-color);
  color: var(--white);
  border: none;
}
.btn-action:hover { background: #2563eb; }

/* Purple variant for "Add Project" */
.btn-project {
  background: #7c3aed;
  border-color: #7c3aed;
}
.btn-project:hover { background: #6d28d9; }

/* Green variant for "Mark as Sent" */
.btn-success {
  flex: 0 0 auto;
  padding: .6rem 1rem;
  font-size: .9rem;
  font-weight: 600;
  border-radius: var(--border-radius);
  cursor: pointer;
  background: #22c55e;
  color: var(--white);
  border: none;
  transition: all var(--transition-base);
}
.btn-success:hover { background: #16a34a; }

/* ---- Style pill buttons (send overlay) ---- */
.style-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.style-tab {
  padding: .3rem .8rem;
  border-radius: 6px;
  border: 1.5px solid var(--border-color);
  font-size: .8rem;
  font-weight: 600;
  cursor: pointer;
  color: #64748b;
  background: var(--white);
  transition: all .15s;
  user-select: none;
}
.style-tab.active-rp { border-color: #22c55e; background: #f0fdf4; color: #16a34a; }
.style-tab.active-os { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; }
.style-tab.active-fl { border-color: #f59e0b; background: #fffbeb; color: #d97706; }
.style-tab.active-pk { border-color: #ec4899; background: #fdf2f8; color: #be185d; }

/* Badge label used in overlays for "Edit only" tags */
.badge-edit-only {
  font-size: .65rem;
  font-weight: 700;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 4px;
  padding: 1px 6px;
  margin-left: 6px;
  text-transform: uppercase;
}
```

- [ ] **Step 2: Verify no parse errors**

Open `http://127.0.0.1:8765/app/?mock=true` in browser. Open DevTools → Console. Confirm no CSS parse errors.

- [ ] **Step 3: Commit**

```bash
git add app/css/app.css
git commit -m "feat(css): add table-header-row, btn-action/project/success, style-tab pills"
```

---

## Task 2: HTML — Fix Header, Swap Buttons, Replace Overlays

**Files:**
- Modify: `app/index.html`

This task replaces the existing table header inline style with the new `.table-header-row` class, renames/adds the action buttons, and replaces the entire `#climb-overlay` with two new overlays: `#send-overlay` and `#project-overlay`.

### Step 1: Fix table header row

- [ ] **Replace the table header div** (around line 108–111):

Find:
```html
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
  <h3 class="table-title" id="view-label" style="margin:0">All Climbs</h3>
  <button class="btn btn-primary btn-sm" id="btn-add-climb">+ Add Climb</button>
</div>
```

Replace with:
```html
<div class="table-header-row">
  <h3 class="table-title" id="view-label">All Climbs</h3>
  <button class="btn-action" id="btn-log-send">+ Log Send</button>
  <button class="btn-action btn-project hidden" id="btn-add-project">+ Add Project</button>
</div>
```

### Step 2: Replace the climb overlay with the send overlay

- [ ] **Find the entire `<div id="climb-overlay" ...>` block** (approximately lines 187–290 in the current file) and replace it with:

```html
<!-- Send overlay (Log Send / Edit Send) -->
<div id="send-overlay" class="edit-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="send-overlay-title">
  <div class="overlay-panel">
    <div class="overlay-header">
      <h2 id="send-overlay-title">Log Send</h2>
      <button class="btn-close" id="send-overlay-close" aria-label="Close">✕</button>
    </div>
    <div class="overlay-body">
      <input type="hidden" id="so-record-name">
      <div class="form-group">
        <label for="so-route">Route Name <span style="color:red">*</span></label>
        <input type="text" id="so-route" placeholder="e.g. Biographie">
        <div class="form-error hidden" id="so-route-error">Route name is required.</div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label for="so-area">Area</label>
          <input type="text" id="so-area" placeholder="e.g. Ceüse">
        </div>
        <div class="form-group">
          <label for="so-crag">Crag</label>
          <input type="text" id="so-crag" placeholder="e.g. La Face">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label for="so-difficulty">Grade</label>
          <input type="text" id="so-difficulty" placeholder="e.g. 9a">
        </div>
        <div class="form-group">
          <label for="so-routetype">Type</label>
          <select id="so-routetype">
            <option>Sport</option>
            <option>Boulder</option>
            <option>Multi-Pitch</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="so-date">Date <span style="color:red">*</span></label>
        <input type="date" id="so-date">
      </div>
      <div class="form-group">
        <label>Style <span style="color:red">*</span></label>
        <div class="style-tabs" id="so-style-tabs">
          <div class="style-tab active-rp" data-style="Redpoint">Redpoint</div>
          <div class="style-tab" data-style="On Sight">On Sight</div>
          <div class="style-tab" data-style="Flash">Flash</div>
          <div class="style-tab" data-style="Pinkpoint">Pinkpoint</div>
        </div>
        <input type="hidden" id="so-sendtype" value="Redpoint">
      </div>
      <div class="form-group">
        <label>Rating</label>
        <div class="star-picker" id="so-rating" role="group" aria-label="Rating 1 to 5">
          <span data-value="1">★</span>
          <span data-value="2">★</span>
          <span data-value="3">★</span>
          <span data-value="4">★</span>
          <span data-value="5">★</span>
        </div>
      </div>
      <div class="form-group">
        <label for="so-notes">Notes</label>
        <textarea id="so-notes" rows="2" placeholder="Any notes about this send…"></textarea>
      </div>
      <div class="form-section hidden" id="so-ascents-section">
        <div class="form-section-title">Repeat Ascents <span class="badge-edit-only">Edit only</span></div>
        <div id="so-ascents-list"></div>
        <div class="ascent-add-row">
          <input type="date" id="so-ascent-date">
          <select id="so-ascent-type">
            <option>Redpoint</option>
            <option>On Sight</option>
            <option>Flash</option>
            <option>Pinkpoint</option>
          </select>
          <input type="text" id="so-ascent-notes" placeholder="Notes">
          <button class="btn btn-sm btn-secondary" id="so-ascent-add">+ Add</button>
        </div>
      </div>
    </div>
    <div class="overlay-footer">
      <button class="btn btn-ghost hidden" id="send-overlay-delete" style="color:#ef4444;">Delete</button>
      <button class="btn btn-secondary" id="send-overlay-cancel">Cancel</button>
      <button class="btn btn-primary" id="send-overlay-save">Save Send</button>
    </div>
  </div>
</div>

<!-- Project overlay (Add Project / Edit Project) -->
<div id="project-overlay" class="edit-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="project-overlay-title">
  <div class="overlay-panel">
    <div class="overlay-header">
      <h2 id="project-overlay-title">Add Project</h2>
      <button class="btn-close" id="project-overlay-close" aria-label="Close">✕</button>
    </div>
    <div class="overlay-body">
      <input type="hidden" id="po-record-name">
      <div class="form-group">
        <label for="po-route">Route Name <span style="color:red">*</span></label>
        <input type="text" id="po-route" placeholder="e.g. La Dura Dura">
        <div class="form-error hidden" id="po-route-error">Route name is required.</div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label for="po-area">Area</label>
          <input type="text" id="po-area" placeholder="e.g. Oliana">
        </div>
        <div class="form-group">
          <label for="po-crag">Crag</label>
          <input type="text" id="po-crag" placeholder="e.g. Sector Pal">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label for="po-difficulty">Grade</label>
          <input type="text" id="po-difficulty" placeholder="e.g. 9a+">
        </div>
        <div class="form-group">
          <label for="po-routetype">Type</label>
          <select id="po-routetype">
            <option>Sport</option>
            <option>Boulder</option>
            <option>Multi-Pitch</option>
          </select>
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label for="po-attempts">Attempts</label>
          <input type="number" id="po-attempts" min="0" value="0">
        </div>
        <div class="form-group">
          <label for="po-last-attempt-date">Last Attempt Date</label>
          <input type="date" id="po-last-attempt-date">
        </div>
      </div>
      <div class="form-group">
        <label for="po-highpoint">High Point</label>
        <input type="text" id="po-highpoint" placeholder="e.g. 2nd bolt">
      </div>
      <div class="form-group">
        <label for="po-status">Status</label>
        <select id="po-status">
          <option>Working</option>
          <option>Close</option>
          <option>Abandoned</option>
        </select>
      </div>
      <div class="form-group">
        <label for="po-notes">Notes</label>
        <textarea id="po-notes" rows="2" placeholder="Beta, conditions, goals…"></textarea>
      </div>
      <div class="form-section hidden" id="po-mark-sent-section">
        <div class="form-section-title">Ready to Celebrate? <span class="badge-edit-only">Edit only</span></div>
        <button class="btn-success" id="po-mark-sent" style="width:100%">🎉 Mark as Sent</button>
      </div>
    </div>
    <div class="overlay-footer">
      <button class="btn btn-ghost hidden" id="project-overlay-delete" style="color:#ef4444;">Delete</button>
      <button class="btn btn-secondary" id="project-overlay-cancel">Cancel</button>
      <button class="btn btn-primary btn-project" id="project-overlay-save">Save Project</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify page loads without JS errors**

Open `http://127.0.0.1:8765/app/?mock=true`. Console should have no errors. The table should render, `btn-log-send` should be visible.

- [ ] **Step 4: Commit**

```bash
git add app/index.html
git commit -m "feat(html): replace climb-overlay with send-overlay + project-overlay; fix header row"
```

---

## Task 3: climbs.js — Add lastAttemptDate to saveClimbNote

**Files:**
- Modify: `app/js/climbs.js` (line ~130, inside `saveClimbNote` fields object)

The `fetchClimbs` mapping already reads `CD_lastAttemptDate`. The `saveClimbNote` fields object is missing it. Add one line.

- [ ] **Step 1: Add `CD_lastAttemptDate` to saveClimbNote**

In `saveClimbNote`, in the `fields` object after `CD_projectNotes`, add:

```js
CD_lastAttemptDate: { value: climbData.lastAttemptDate ? climbData.lastAttemptDate.getTime() : null },
```

- [ ] **Step 2: Commit**

```bash
git add app/js/climbs.js
git commit -m "fix(climbs): write CD_lastAttemptDate in saveClimbNote"
```

---

## Task 4: mock.js — Align projectStatus Values

**Files:**
- Modify: `app/js/mock.js`

The spec defines status values as `Working`, `Close`, `Abandoned`. The 3 existing project entries all have `projectStatus: 'In Progress'` which doesn't match the select options. Fix them.

- [ ] **Step 1: Update mock project statuses**

In `MOCK_CLIMBS`, change the 3 project entries:
- `mock-3` (La Dura Dura, 23 attempts): `projectStatus: 'Close'`
- `mock-4` (Action Directe, 8 attempts): `projectStatus: 'Working'`
- `mock-5` (Hubble, 3 attempts): `projectStatus: 'Working'`

- [ ] **Step 2: Commit**

```bash
git add app/js/mock.js
git commit -m "fix(mock): align project status values to Working/Close/Abandoned"
```

---

## Task 5: ui.js — Replace Climb Overlay Logic with Send + Project Overlays

**Files:**
- Modify: `app/js/ui.js`

This is the largest task. It replaces ~120 lines of climb overlay logic with two separate overlay systems. Work in sub-steps to keep changes reviewable.

### Sub-task 5a: Update setStarRating + bindStarPicker to use #so-rating

The star picker was hardcoded to `#co-rating`. Change to `#so-rating`.

- [ ] **Step 1: Update star rating functions**

Replace in `ui.js`:
```js
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
```

With:
```js
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
```

### Sub-task 5b: Add style pill helper

Add a new helper function after `bindStarPicker`:

- [ ] **Step 2: Add setStylePill helper**

```js
function setStylePill(value) {
  const styleMap = {
    'Redpoint':  'active-rp',
    'On Sight':  'active-os',
    'Flash':     'active-fl',
    'Pinkpoint': 'active-pk',
  };
  document.querySelectorAll('#so-style-tabs .style-tab').forEach(tab => {
    tab.className = 'style-tab';
    if (tab.dataset.style === value) tab.classList.add(styleMap[value] ?? '');
  });
  const hidden = document.getElementById('so-sendtype');
  if (hidden) hidden.value = value;
}
```

### Sub-task 5c: Replace showAddClimbOverlay + showEditClimbOverlay + bindClimbOverlayHandlers

- [ ] **Step 3: Remove old climb overlay functions**

Delete the three functions:
- `showAddClimbOverlay()` (~lines 443–465)
- `showEditClimbOverlay(climb)` (~lines 466–489)
- `bindClimbOverlayHandlers()` (~lines 490–562)

- [ ] **Step 4: Add showAddSendOverlay**

```js
function showAddSendOverlay(prefill = {}) {
  const overlay = document.getElementById('send-overlay');
  document.getElementById('send-overlay-title').textContent = 'Log Send';
  document.getElementById('so-record-name').value = '';
  document.getElementById('so-route').value = prefill.route ?? '';
  document.getElementById('so-area').value = prefill.climbingArea ?? '';
  document.getElementById('so-crag').value = prefill.crag ?? '';
  document.getElementById('so-difficulty').value = prefill.difficulty ?? '';
  document.getElementById('so-routetype').value = prefill.routeType ?? 'Sport';
  document.getElementById('so-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('so-notes').value = '';
  setStarRating(0);
  setStylePill('Redpoint');
  document.getElementById('so-ascents-section').classList.add('hidden');
  document.getElementById('send-overlay-delete').classList.add('hidden');
  document.getElementById('so-route-error').classList.add('hidden');
  document.getElementById('so-route').classList.remove('error');
  // Store project recordName for Mark as Sent flow (may be undefined)
  overlay.dataset.projectRecordName = prefill.projectRecordName ?? '';
  overlay.classList.remove('hidden');
}
```

- [ ] **Step 5: Add showEditSendOverlay**

```js
function showEditSendOverlay(climb) {
  showAddSendOverlay();
  document.getElementById('send-overlay-title').textContent = 'Edit Send';
  document.getElementById('so-record-name').value = climb.recordName ?? '';
  document.getElementById('so-route').value = climb.route ?? '';
  document.getElementById('so-area').value = climb.climbingArea ?? '';
  document.getElementById('so-crag').value = climb.crag ?? '';
  document.getElementById('so-difficulty').value = climb.difficulty ?? '';
  document.getElementById('so-routetype').value = climb.routeType ?? 'Sport';
  document.getElementById('so-date').value = climb.date ? climb.date.toISOString().slice(0, 10) : '';
  document.getElementById('so-notes').value = climb.noteText ?? '';
  setStarRating(climb.rating ?? 0);
  setStylePill(climb.sendType ?? 'Redpoint');
  document.getElementById('so-ascents-section').classList.remove('hidden');
  document.getElementById('send-overlay-delete').classList.remove('hidden');
  renderAscentsList(climb);
}
```

Note: `renderAscentsList` already exists and uses `co-ascents-list`. Update its `id` reference from `co-ascents-list` to `so-ascents-list`, and ascent add-row IDs from `co-ascent-*` to `so-ascent-*` (see Sub-task 5f).

- [ ] **Step 6: Add showAddProjectOverlay**

```js
function showAddProjectOverlay() {
  const overlay = document.getElementById('project-overlay');
  document.getElementById('project-overlay-title').textContent = 'Add Project';
  document.getElementById('po-record-name').value = '';
  document.getElementById('po-route').value = '';
  document.getElementById('po-area').value = '';
  document.getElementById('po-crag').value = '';
  document.getElementById('po-difficulty').value = '';
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
```

- [ ] **Step 7: Add showEditProjectOverlay**

```js
function showEditProjectOverlay(climb) {
  showAddProjectOverlay();
  document.getElementById('project-overlay-title').textContent = 'Edit Project';
  document.getElementById('po-record-name').value = climb.recordName ?? '';
  document.getElementById('po-route').value = climb.route ?? '';
  document.getElementById('po-area').value = climb.climbingArea ?? '';
  document.getElementById('po-crag').value = climb.crag ?? '';
  document.getElementById('po-difficulty').value = climb.difficulty ?? '';
  document.getElementById('po-routetype').value = climb.routeType ?? 'Sport';
  document.getElementById('po-attempts').value = climb.attemptCount ?? 0;
  document.getElementById('po-last-attempt-date').value =
    climb.lastAttemptDate ? climb.lastAttemptDate.toISOString().slice(0, 10) : '';
  document.getElementById('po-highpoint').value = climb.highPoint ?? '';
  document.getElementById('po-status').value = climb.projectStatus ?? 'Working';
  document.getElementById('po-notes').value = climb.noteText ?? '';
  document.getElementById('po-mark-sent-section').classList.remove('hidden');
  document.getElementById('project-overlay-delete').classList.remove('hidden');
}
```

### Sub-task 5d: Add bindSendOverlayHandlers

- [ ] **Step 8: Add bindSendOverlayHandlers**

```js
function bindSendOverlayHandlers() {
  function closeOverlay() {
    document.getElementById('send-overlay').classList.add('hidden');
  }
  document.getElementById('send-overlay-close').addEventListener('click', closeOverlay);
  document.getElementById('send-overlay-cancel').addEventListener('click', closeOverlay);
  document.getElementById('send-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOverlay();
  });

  // Style pill binding
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
      await saveClimbNote({
        recordName,
        id:           recordName ? undefined : crypto.randomUUID(),
        route:        routeVal,
        climbingArea: document.getElementById('so-area').value.trim() || null,
        crag:         document.getElementById('so-crag').value.trim() || null,
        difficulty:   document.getElementById('so-difficulty').value.trim() || null,
        date:         document.getElementById('so-date').value ? new Date(document.getElementById('so-date').value) : null,
        sendType:     document.getElementById('so-sendtype').value,
        routeType:    document.getElementById('so-routetype').value,
        rating:       currentStarRating,
        noteText:     document.getElementById('so-notes').value.trim() || null,
      });

      // Mark as Sent: delete original project record after successful save
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

  // Ascent add row handler
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
      // Re-render: find the climb object and refresh ascents list
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
```

### Sub-task 5e: Add bindProjectOverlayHandlers

- [ ] **Step 9: Add bindProjectOverlayHandlers**

```js
function bindProjectOverlayHandlers() {
  function closeOverlay() {
    document.getElementById('project-overlay').classList.add('hidden');
  }
  document.getElementById('project-overlay-close').addEventListener('click', closeOverlay);
  document.getElementById('project-overlay-cancel').addEventListener('click', closeOverlay);
  document.getElementById('project-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOverlay();
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
      await saveClimbNote({
        recordName,
        id:               recordName ? undefined : crypto.randomUUID(),
        route:            routeVal,
        climbingArea:     document.getElementById('po-area').value.trim() || null,
        crag:             document.getElementById('po-crag').value.trim() || null,
        difficulty:       document.getElementById('po-difficulty').value.trim() || null,
        sendType:         'Project',
        routeType:        document.getElementById('po-routetype').value,
        attemptCount:     Number(document.getElementById('po-attempts').value) || 0,
        lastAttemptDate:  lastAttemptVal ? new Date(lastAttemptVal) : null,
        highPoint:        document.getElementById('po-highpoint').value.trim() || null,
        projectStatus:    document.getElementById('po-status').value,
        noteText:         document.getElementById('po-notes').value.trim() || null,
      });
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
    const prefill = {
      route:            document.getElementById('po-route').value,
      climbingArea:     document.getElementById('po-area').value,
      crag:             document.getElementById('po-crag').value,
      difficulty:       document.getElementById('po-difficulty').value,
      routeType:        document.getElementById('po-routetype').value,
      projectRecordName,
    };
    closeOverlay();
    showAddSendOverlay(prefill);
  });

  document.getElementById('btn-add-project').addEventListener('click', showAddProjectOverlay);
}
```

### Sub-task 5f: Update renderAscentsList to use so-* IDs

`renderAscentsList` currently renders delete buttons that call `deleteAscent` and then call `renderAscentsList` again. It uses `co-ascents-list` as its container. Change it to `so-ascents-list`.

- [ ] **Step 10: Update renderAscentsList container ID**

Find in `renderAscentsList`:
```js
const list = document.getElementById('co-ascents-list');
```
Replace with:
```js
const list = document.getElementById('so-ascents-list');
```

### Sub-task 5g: Update row click → edit dispatch

The detail modal "Edit Climb" button (currently calls `showEditClimbOverlay(climb)`) needs to dispatch based on `sendType`.

- [ ] **Step 11: Update edit dispatch in detail modal**

Find the line (approximately line 153):
```js
showEditClimbOverlay(climb);
```
Replace with:
```js
if (climb.sendType === 'Project') {
  showEditProjectOverlay(climb);
} else {
  showEditSendOverlay(climb);
}
```

### Sub-task 5h: Update setActiveView for context-aware buttons

- [ ] **Step 12: Update setActiveView**

In `setActiveView`, after the `view-label` text is set, add button visibility toggling:

```js
// Context-aware action button
const logSendBtn = document.getElementById('btn-log-send');
const addProjectBtn = document.getElementById('btn-add-project');
if (logSendBtn && addProjectBtn) {
  logSendBtn.classList.toggle('hidden', view === 'projects' || view === 'training');
  addProjectBtn.classList.toggle('hidden', view !== 'projects');
}
```

Also hide both buttons when the training view is shown — add to `showTrainingView()` (or just rely on the `setActiveView` call already in that context).

### Sub-task 5i: Wire new handlers in DOMContentLoaded

- [ ] **Step 13: Replace bindClimbOverlayHandlers with new binds**

In the `DOMContentLoaded` listener, find:
```js
bindClimbOverlayHandlers();
```
Replace with:
```js
bindSendOverlayHandlers();
bindProjectOverlayHandlers();
```

- [ ] **Step 14: Commit**

```bash
git add app/js/ui.js
git commit -m "feat(ui): add send + project overlay handlers; context-aware buttons; mark-as-sent flow"
```

---

## Task 6: Browser Verification at ?mock=true

Open `http://127.0.0.1:8765/app/?mock=true` and verify each check:

- [ ] **Check 1** — Page loads, no console errors, `+ Log Send` button visible (right-aligned), `+ Add Project` hidden
- [ ] **Check 2** — Click sidebar "Projects" → view label = "Projects", `+ Log Send` hidden, `+ Add Project` (purple) appears
- [ ] **Check 3** — Click "All Climbs" → `+ Log Send` reappears, `+ Add Project` hidden
- [ ] **Check 4** — Click `+ Log Send` → overlay opens titled "Log Send", style pills visible (Redpoint selected green), no project fields
- [ ] **Check 5** — Click style pills; each highlights with correct colour (OS=blue, Flash=amber, Pinkpoint=pink). Only one active at a time.
- [ ] **Check 6** — Save a send (Route: "Test Route", Date: today, Style: Flash) → overlay closes, entry appears in table
- [ ] **Check 7** — Click a send row → detail modal opens; click "Edit" → "Edit Send" overlay opens pre-filled; Ascents section visible; click Cancel → overlay closes
- [ ] **Check 8** — From "Edit Send" overlay, click Delete → confirm dialog appears; cancel → overlay stays open; confirm → send deleted
- [ ] **Check 9** — Navigate to Projects view; click `+ Add Project` → overlay opens titled "Add Project", purple save button, no Date/Style/Rating fields
- [ ] **Check 10** — Save a project (Route: "Test Project", Grade: "8c", Attempts: 5) → overlay closes, appears in Projects table
- [ ] **Check 11** — Click a project row → detail modal; click "Edit" → "Edit Project" overlay opens pre-filled; "Mark as Sent" button visible; fill Attempts/High Point/Status; Save → updated
- [ ] **Check 12** — In "Edit Project", click "Mark as Sent" → project overlay closes; send overlay opens pre-filled with route/grade/area; date = today; Redpoint pill active; Save → send saved, project deleted
- [ ] **Check 13** — Navigate to Training → no `+ Log Send` or `+ Add Project` button visible

- [ ] **Step: Commit if all checks pass**

```bash
git add -A
git commit -m "feat: send vs project overlays complete — all E2E checks pass"
```

---

## Notes for Implementer

- **`_allClimbs`** is the module-level array populated by `loadData()`. Access it in `renderAscentsList` via the climb lookup by `recordName`.
- **`loadData()`** vs **`loadTrainingData()`** are separate — only call `loadData()` after climb/project mutations.
- **`currentStarRating`** is a module-level variable. The `setStarRating` function updates it and the UI. Always call `setStarRating(0)` to reset.
- **`showConfirmDialog`** returns a Promise<boolean>. Use `await` before checking the result.
- **Mock mode**: All `saveClimbNote` / `deleteClimbNote` calls are overridden by `mock.js` via `window.*`. The mock mutates `MOCK_CLIMBS` in place and returns a fake record.
- **`projectStatus: 'In Progress'`** in mock data doesn't match spec select options — Task 4 fixes this.
- The **`badge-edit-only`** span class used in the new HTML may need CSS — add a rule if it looks unstyled:  
  `.badge-edit-only { font-size:.65rem; font-weight:700; background:#e0f2fe; color:#0369a1; border-radius:4px; padding:1px 6px; margin-left:6px; text-transform:uppercase; }`
