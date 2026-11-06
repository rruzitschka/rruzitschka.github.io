// climb-inspector-ui.js — DOM wiring for the Chalk & Sky / Classic UI switch,
// the iOS-style route-type filter chip bar, and the right-hand Route Detail
// Inspector. Split out of ui.js (like route-link-ui.js / overlay-country.js)
// so ui.js stays focused and pure helpers remain in ui-theme.js.

"use strict";

import {
	THEME_STORAGE_KEY,
	THEME_CHALK_SKY,
	resolveTheme,
	nextTheme,
	themeToggleMeta,
	escapeInspectorHtml,
	renderRouteTypeChipsHtml,
	renderRouteCellIndicatorsHtml,
	renderInspectorEmptyHtml,
	renderInspectorAscentsHtml,
	renderInspectorGpsHtml,
	renderInspectorPhotosHtml,
	renderInspectorHtml,
	formatCommunityRating,
	combineAscentsWithOriginalSend,
	buildCompactClimbRowCellsHtml,
	renderAreaCragCell,
} from "./ui-theme.js";
import { isoCountryName, countryFlagEmoji } from "./iso-countries.js";

let _selectedRecordName = null;
let _lastClimbTypes = [];

function readStoredTheme() {
	try {
		return resolveTheme(globalThis.localStorage?.getItem(THEME_STORAGE_KEY));
	} catch {
		return THEME_CHALK_SKY;
	}
}

function writeStoredTheme(theme) {
	try {
		globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// localStorage unavailable (private browsing / test harness)
	}
}

function refreshStatsChartsIfVisible() {
	const statsView = document.getElementById("stats-view");
	if (!statsView || statsView.classList.contains("hidden")) return;
	if (typeof globalThis.renderStatsPage !== "function") return;
	globalThis.renderStatsPage(
		globalThis.allClimbs ?? [],
		globalThis.allSessions ?? [],
	);
}

/**
 * Apply the given theme ("chalk-sky" | "classic") to <html> and refresh the
 * top-header toggle button label/tooltip.
 *
 * @param {string} theme
 */
export function applyThemeToDom(theme) {
	const resolved = resolveTheme(theme);
	document.documentElement.dataset.theme = resolved;
	const btn = document.getElementById("theme-toggle-btn");
	const lbl = document.getElementById("theme-toggle-label");
	const meta = themeToggleMeta(resolved);
	if (btn) btn.title = meta.title;
	if (lbl) lbl.textContent = meta.text;
	refreshStatsChartsIfVisible();
}

/**
 * Return true when the Chalk & Sky UI is currently active on <html>.
 *
 * @returns {boolean}
 */
export function isChalkSkyActive() {
	return resolveTheme(document.documentElement.dataset.theme) === THEME_CHALK_SKY;
}

/**
 * Initialize the UI theme from localStorage (defaults to "chalk-sky") and bind
 * the top-header toggle button once.
 */
export function initThemeSwitch() {
	applyThemeToDom(readStoredTheme());
	const btn = document.getElementById("theme-toggle-btn");
	if (!btn || btn.dataset.bound === "1") return;
	btn.dataset.bound = "1";
	btn.addEventListener("click", () => {
		const next = nextTheme(document.documentElement.dataset.theme);
		writeStoredTheme(next);
		applyThemeToDom(next);
	});
}

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
	};
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
		inspector.innerHTML = renderInspectorEmptyHtml();
		return;
	}

	_selectedRecordName = climb.recordName ?? null;
	highlightSelectedRow(_selectedRecordName);
	inspector.innerHTML = renderInspectorHtml(climb, buildInspectorMeta(climb, deps));
	bindInspectorButtons(climb, deps);

	loadInspectorRoute(climb, deps);
	loadInspectorAscents(climb, deps);
	loadInspectorPhotos(climb, deps.fetchPhotos);
}

function resolveRowCountryInfo(centralRouteID, routeCountries) {
	const code = lookupMapValue(routeCountries, centralRouteID);
	if (!code) return { countryCode: null, countryName: null, flagEmoji: null };
	return {
		countryCode: code,
		countryName: isoCountryName(code),
		flagEmoji: countryFlagEmoji(code),
	};
}

function renderCommunityRatingSuffix(centralRouteID, communityRatings) {
	const rating = lookupMapValue(communityRatings, centralRouteID);
	if (typeof rating !== "number") return "";
	return `<small style="color:#94a3b8;margin-left:3px;">(${rating.toFixed(1)})</small>`;
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
	if (isChalkSkyActive()) {
		return buildCompactClimbRowCellsHtml(climb, rowMeta, {
			gpsData: deps.gpsData,
			routeCountries: deps.routeCountries,
			countryName: isoCountryName,
			flagEmoji: countryFlagEmoji,
			longDateText: rowMeta.dateText,
		});
	}
	const routeID = climb.centralRouteID;
	const hasGps = Boolean(routeID && deps.gpsData?.has(routeID));
	const countryInfo = resolveRowCountryInfo(routeID, deps.routeCountries);
	const indicators = renderRouteCellIndicatorsHtml({
		centralRouteID: routeID,
		hasGps,
		...countryInfo,
	});
	const routeName = escapeInspectorHtml(climb.route || "—");
	const routeType = escapeInspectorHtml(climb.routeType || "—");
	const grade = escapeInspectorHtml(climb.difficulty || "—");
	const sendType = escapeInspectorHtml(climb.sendType || "—");
	const commSuffix = renderCommunityRatingSuffix(routeID, deps.communityRatings);

	return `
      <td><div class="cs-route-cell"><strong>${routeName}</strong>${indicators}</div></td>
      <td>${renderAreaCragCell(climb)}</td>
      <td><span class="type-badge">${routeType}</span></td>
      <td><span class="badge ${rowMeta.gradeClass}">${grade}</span></td>
      <td>${rowMeta.dateText}</td>
      <td><span class="badge ${rowMeta.sendClass}">${sendType}</span></td>
      <td>${rowMeta.starsHtml}${commSuffix}</td>
    `;
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
