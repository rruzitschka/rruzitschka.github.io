// climb-inspector-ui.js — DOM wiring for the iOS-style route-type filter chip
// bar and the right-hand Route Detail Inspector. Split out of ui.js (like route-link-ui.js / overlay-country.js)
// so ui.js stays focused and pure helpers remain in ui-theme.js.

"use strict";

import {
	renderRouteTypeChipsHtml,
	renderInspectorEmptyHtml,
	renderInspectorAscentsHtml,
	renderInspectorGpsHtml,
	renderInspectorPhotosHtml,
	renderInspectorHtml,
	formatCommunityRating,
	combineAscentsWithOriginalSend,
	buildCompactClimbRowCellsHtml,
} from "./ui-theme.js";
import { isoCountryName, countryFlagEmoji } from "./iso-countries.js";
import { saveClimbNote as $saveClimbNote } from "./firebase-climbs.js";
import {
	incrementAttemptCount as $incrementAttemptCount,
} from "./firebase-routes.js";
import { refreshData } from "./overlay-common.js";
import {
	attemptProjectStateFromClimb,
	saveAttempt,
} from "./attempt-form-model.js";
import { normalizeSendType } from "./send-style.js";

// ── Mutable service references (can be overridden by mock mode) ──

let saveClimbNote = $saveClimbNote;
let incrementAttemptCount = $incrementAttemptCount;

/** Override the inspector services (mock mode — see ui.js setMockServices). */
export function setClimbInspectorMockServices(mocks) {
	if (mocks.saveClimbNote) saveClimbNote = mocks.saveClimbNote;
	if (mocks.incrementAttemptCount) {
		incrementAttemptCount = mocks.incrementAttemptCount;
	}
}

let _selectedRecordName = null;
let _selectedClimb = null;
let _lastClimbTypes = [];

/** The deps of the most recent selectClimbInInspector call — reused to
 * re-render the pane after an attempt save (the table refresh path cannot
 * reselect a climb that left the Projects filter). */
let _lastInspectorDeps = null;

// ── Route-type filter chip bar (replaces #filter-routetype in Chalk & Sky) ──

function setActiveChipButtons(bar, activeValue) {
	bar.querySelectorAll(".rt-chip").forEach((btn) => {
		btn.classList.toggle("active", (btn.dataset.routetype ?? "") === activeValue);
	});
}

function handleChipClick(bar, select, nextVal) {
	setActiveChipButtons(bar, nextVal);
	if (!select || select.value === nextVal) return;
	select.value = nextVal;
	select.dispatchEvent(new Event("change"));
}

function bindSelectToChipsOnce(select, bar) {
	if (!select || select.dataset.chipsBound === "1") return;
	select.dataset.chipsBound = "1";
	select.addEventListener("change", () => {
		setActiveChipButtons(bar, select.value ?? "");
	});
}

/**
 * Render the iOS-style route-type filter chips and keep them in two-way sync
 * with the underlying #filter-routetype <select>.
 *
 * @param {string[]} [types]
 */
export function syncRouteTypeChipBar(types) {
	if (Array.isArray(types)) _lastClimbTypes = types;
	const bar = document.getElementById("routetype-chips-bar");
	if (!bar) return;
	const select = document.getElementById("filter-routetype");
	const activeValue = select ? select.value : "";

	bar.innerHTML = renderRouteTypeChipsHtml(_lastClimbTypes, activeValue);
	bar.querySelectorAll(".rt-chip").forEach((btn) => {
		btn.addEventListener("click", () => {
			handleChipClick(bar, select, btn.dataset.routetype ?? "");
		});
	});
	bindSelectToChipsOnce(select, bar);
}

// ── Table card subtitle & row highlight ─────────────────────────────────────

function formatRangeSubtitle(totalFiltered, startIdx, pageCount) {
	if (totalFiltered === 0 || pageCount === 0) return "0 climbs";
	const from = startIdx + 1;
	const to = startIdx + pageCount;
	return `Showing ${from}–${to} of ${totalFiltered} · click a row to inspect`;
}

/**
 * Update the Chalk & Sky table card title and range subtitle.
 *
 * @param {number} totalFiltered
 * @param {number} startIdx 0-based start index
 * @param {number} pageCount number of rows on current page
 */
export function syncTableCardHeader(totalFiltered, startIdx, pageCount) {
	const viewEl = document.getElementById("view-label");
	const csTitle = document.getElementById("cs-view-label");
	const csSub = document.getElementById("cs-view-sub");
	if (csTitle && viewEl) csTitle.textContent = viewEl.textContent;
	if (csSub) csSub.textContent = formatRangeSubtitle(totalFiltered, startIdx, pageCount);
}

function highlightSelectedRow(recordName) {
	const tbody = document.getElementById("climbs-tbody");
	if (!tbody) return;
	tbody.querySelectorAll("tr").forEach((row) => {
		row.classList.toggle("cs-row-selected", row.dataset.recordName === recordName);
	});
}

// ── Route Detail Inspector population ───────────────────────────────────────

function applyInspectorCountryPill(route) {
	const pill = document.getElementById("inspector-country-pill");
	if (!pill || !route.country) return;
	pill.textContent = route.country;
	pill.classList.remove("hidden");
}

function applyInspectorCommunityRating(route) {
	const commEl = document.getElementById("inspector-comm-rating");
	if (!commEl || typeof route.communityRating !== "number") return;
	commEl.textContent = formatCommunityRating(
		route.communityRating,
		route.ratingCount ?? null,
	);
}

function applyCentralRouteToInspector(route, climb) {
	if (!route || _selectedRecordName !== climb.recordName) return;
	applyInspectorCountryPill(route);
	applyInspectorCommunityRating(route);
	const gpsEl = document.getElementById("inspector-gps-container");
	if (gpsEl) gpsEl.innerHTML = renderInspectorGpsHtml(route, climb.route);
}

function loadInspectorRoute(climb, deps) {
	if (!climb.centralRouteID || typeof deps.getRoute !== "function") return;
	deps
		.getRoute(climb.centralRouteID)
		.then((route) => applyCentralRouteToInspector(route, climb))
		.catch(() => {});
}

function loadInspectorAscents(climb, deps) {
	if (!climb.recordName || typeof deps.fetchAscents !== "function") {
		return;
	}
	const render = (ascents) => {
		if (_selectedRecordName !== climb.recordName) return;
		const all = combineAscentsWithOriginalSend(climb, ascents);
		const ascEl = document.getElementById("inspector-ascents-container");
		if (ascEl) {
			ascEl.innerHTML = renderInspectorAscentsHtml(
				all,
				deps.sendClasses ?? {},
			);
		}
		const countEl = document.getElementById("inspector-ascents-count");
		if (countEl) countEl.textContent = String(all.length);
	};
	deps.fetchAscents(climb.recordName)
		.then(render)
		.catch(() => render([])); // even on failure the original send is shown
}

function loadInspectorPhotos(climb, fetchPhotos) {
	if (!climb.recordName || typeof fetchPhotos !== "function") return;
	fetchPhotos(climb.recordName)
		.then((photos) => {
			if (_selectedRecordName !== climb.recordName) return;
			const phEl = document.getElementById("inspector-photos-container");
			if (phEl) phEl.innerHTML = renderInspectorPhotosHtml(photos);
		})
		.catch(() => {});
}

function lookupMapValue(map, key) {
	if (!key) return null;
	if (!map) return null;
	return map.get(key) ?? null;
}

function buildInspectorMeta(climb, deps) {
	return {
		country: lookupMapValue(deps.routeCountries, climb.centralRouteID),
		communityRating: lookupMapValue(deps.communityRatings, climb.centralRouteID),
		sendBadgeClass: deps.sendClasses[climb.sendType] ?? "send-proj",
		dateFormatted: deps.formatDate(climb.date),
		userRating: typeof climb.rating === "number" ? climb.rating : null,
	};
}

// ── Log Attempt in the pane (item #10; iOS AttemptLogView parity) ─────────

function attemptInputFromInspector() {
	return {
		attemptDate: document.getElementById("insp-attempt-date")?.value ?? "",
		durationMinutes:
			document.getElementById("insp-attempt-duration")?.value ?? "0",
		wasSuccessful:
			document.getElementById("insp-attempt-success")?.checked ?? false,
		highPoint: document.getElementById("insp-attempt-highpoint")?.value ?? "",
		notes: document.getElementById("insp-attempt-notes")?.value ?? "",
	};
}

async function saveAttemptFromInspector() {
	const btn = document.getElementById("insp-save-attempt");
	if (!btn) return;
	const project = _selectedClimb;
	const deps = _lastInspectorDeps;
	if (!project || !deps) return;
	btn.disabled = true;
	btn.textContent = "Saving…";
	try {
		const payload = await saveAttempt(
			attemptProjectStateFromClimb(project),
			attemptInputFromInspector(),
			{ saveClimbNote, incrementAttemptCount, refreshData },
		);
		if (payload.sendType === "redpoint") {
			// Successful send: the climb left the Projects filter (sendType no
			// longer "Project"), so the standard refresh path cannot reselect it
			// and the pane would silently jump to another project. Re-render the
			// completed detail explicitly (iOS shows the completed project too).
			// The payload carries the lowercase Firestore form; the display wants
			// Title Case (fetchClimbs applies the same normalization on read).
			const updated = {
				...project,
				...payload,
				sendType: normalizeSendType(payload.sendType),
			};
			selectClimbInInspector(updated, deps);
		}
		// Failed attempt: refreshData re-rendered the table + inspector with
		// the updated climb (attempt count/notes), so no local reset.
	} catch (err) {
		console.error("Save attempt failed:", err);
		alert("Save failed: " + (err.message ?? err));
	} finally {
		btn.disabled = false;
		btn.textContent = "Save Attempt";
	}
}

/** Two-click flow: "Log Attempt" expands the compact form; the toggle turns
 * into Cancel. Fields keep their values while collapsing. */
function bindInspectorAttemptSection() {
	const toggle = document.getElementById("insp-attempt-toggle");
	const form = document.getElementById("insp-attempt-form");
	if (!toggle || !form) return;
	toggle.addEventListener("click", () => {
		const hidden = form.classList.toggle("hidden");
		toggle.textContent = hidden ? "Log Attempt" : "Cancel";
	});
	const saveBtn = document.getElementById("insp-save-attempt");
	if (saveBtn) {
		saveBtn.addEventListener("click", () => saveAttemptFromInspector());
	}
}

function bindInspectorButtons(climb, deps) {
	const editBtn = document.getElementById("inspector-edit-btn");
	if (editBtn) {
		editBtn.addEventListener("click", () => {
			if (climb.sendType === "Project") {
				deps.showEditProjectOverlay(climb);
			} else {
				deps.showEditSendOverlay(climb);
			}
		});
	}
}

/**
 * Select a climb into the right-hand Route Detail Inspector and wire its
 * action buttons.
 *
 * @param {object|null} climb
 * @param {object} deps callbacks and maps from ui.js
 */
export function selectClimbInInspector(climb, deps) {
	const inspector = document.getElementById("climb-inspector");
	if (!inspector) return;

	if (!climb) {
		_selectedRecordName = null;
		_selectedClimb = null;
		inspector.innerHTML = renderInspectorEmptyHtml();
		return;
	}

	_selectedRecordName = climb.recordName ?? null;
	_selectedClimb = climb;
	_lastInspectorDeps = deps;
	highlightSelectedRow(_selectedRecordName);
	inspector.innerHTML = renderInspectorHtml(climb, buildInspectorMeta(climb, deps));
	bindInspectorButtons(climb, deps);
	bindInspectorAttemptSection();

	loadInspectorRoute(climb, deps);
	loadInspectorAscents(climb, deps);
	loadInspectorPhotos(climb, deps.fetchPhotos);
}


/**
 * Build the innerHTML of a climb <tr> row. Compact layout (no Rating column,
 * shorthand style, numeric date) in Chalk & Sky; full columns in Classic.
 *
 * @param {object} climb
 * @param {object} rowMeta { gradeClass, sendClass, starsHtml, dateText }
 * @param {object} deps
 * @returns {string}
 */
export function buildClimbRowCellsHtml(climb, rowMeta, deps) {
	return buildCompactClimbRowCellsHtml(climb, rowMeta, {
		gpsData: deps.gpsData,
		routeCountries: deps.routeCountries,
		countryName: isoCountryName,
		flagEmoji: countryFlagEmoji,
		longDateText: rowMeta.dateText,
	});
}

/**
 * Bind row click: selects into the Inspector when Chalk & Sky is active, or
 * opens the detail modal in Classic mode.
 *
 * @param {HTMLTableRowElement} tr
 * @param {object} climb
 * @param {object} deps
 */
export function bindClimbRowClick(tr, climb, deps) {
	tr.dataset.recordName = climb.recordName ?? "";
	tr.addEventListener("click", () => {
		selectClimbInInspector(climb, deps);
	});
}

/**
 * Ensure the Inspector shows a valid selection for the current table page.
 *
 * @param {object[]} pageClimbs
 * @param {object} deps
 */
export function syncInspectorForPage(pageClimbs, deps) {
	if (!pageClimbs || pageClimbs.length === 0) {
		selectClimbInInspector(null, deps);
		return;
	}
	const existing = pageClimbs.find((c) => c.recordName === _selectedRecordName);
	selectClimbInInspector(existing ?? pageClimbs[0], deps);
}
