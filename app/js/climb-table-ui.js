// climb-table-ui.js — Climbs table rendering and shared display plumbing:
// stats bar, table rows, pagination, filter options, grade/date helpers,
// toast, loading skeleton, and detail-modal close. Moved out of ui.js as
// part of the new-UI refactor (docs/plan-uijs-refactor.md, Chunk 5).
//
// Pure helpers (gradeBadgeClass, formatDate) are unit-tested in
// tests/climb-table-ui.test.js. ui.js keeps loadData, filter/view wiring,
// CSV export and the community-rating bootstrap.

"use strict";

import { auth } from "./firebase-config.js";
import {
	fetchAscents as $fetchAscents,
	fetchPhotos as $fetchPhotos,
} from "./firebase-climbs.js";
import { getRoute as $getRoute } from "./firebase-routes.js";
import { showEditSendOverlay } from "./send-overlay-ui.js";
import { showEditProjectOverlay } from "./project-overlay-ui.js";
import {
	syncRouteTypeChipBar,
	syncTableCardHeader,
	buildClimbRowCellsHtml,
	bindClimbRowClick,
	syncInspectorForPage,
} from "./climb-inspector-ui.js";
import { orderRouteTypeFilterValues, renderStarsHtml } from "./ui-theme.js";

// ── Mutable service references (can be overridden by setClimbTableMockServices) ──

let getRoute = $getRoute;
let fetchAscents = $fetchAscents;
let fetchPhotos = $fetchPhotos;

/** Override the table services (mock mode — see ui.js setMockServices). */
export function setClimbTableMockServices(mocks) {
	if (mocks.getRoute) getRoute = mocks.getRoute;
	if (mocks.fetchAscents) fetchAscents = mocks.fetchAscents;
	if (mocks.fetchPhotos) fetchPhotos = mocks.fetchPhotos;
}

// ── Table state ──

let _filteredClimbs = [];
let _currentPage = 1;
const ITEMS_PER_PAGE = 20;

let _communityRatings = new Map(); // routeID -> communityRating; fetched once per session
let _gpsData = new Map(); // routeID -> {latitude, longitude, country}
let _routeCountries = new Map(); // routeID -> ISO country code (only when set)

/** Replace the once-per-session route data maps (from fetchRouteData). */
export function setRouteData({ ratings, gps, countries }) {
	_communityRatings = ratings;
	_gpsData = gps;
	_routeCountries = countries;
}

/** Reset pagination to the first page (called when filters/search change). */
export function resetTablePage() {
	_currentPage = 1;
}

export const SEND_CLASSES = {
	Redpoint: "send-rp",
	"On Sight": "send-os",
	"Top Rope": "send-tr",
	"All Free": "send-af",
	Project: "send-proj",
	Pinkpoint: "send-pp",
};

// ── Pure helpers ──

// Grades API — provided by grades.js (regular script, always loaded before
// modules). Injectable for unit tests (no window in node).
function activeGrades() {
	return globalThis.window?.GRADES ?? {};
}

/** CSS class for the grade badge ("grade-hard" = top ~25% of each system:
 *  French ≥ 8b+, UIAA ≥ 11+, YDS ≥ 5.14a). */
export function gradeBadgeClass(difficulty, grades = activeGrades()) {
	if (!difficulty) return "grade-normal";
	const systems = [
		[grades.French ?? [], "8b+"],
		[grades.UIAA ?? [], "11+"],
		[grades.YDS ?? [], "5.14a"],
	];
	for (const [list, hardGrade] of systems) {
		const idx = list.indexOf(difficulty);
		if (idx !== -1)
			return idx >= list.indexOf(hardGrade) ? "grade-hard" : "grade-normal";
	}
	return "grade-normal";
}

/** "—" for falsy input, otherwise en-US "Jan 5, 2026" style. */
export function formatDate(date) {
	if (!date) return "—";
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

// ---------- Stats Bar ----------

export function renderStatsBar(stats) {
	document.getElementById("stat-total").textContent = stats.total ?? "—";
	document.getElementById("stat-this-year").textContent = stats.thisYear ?? "—";
	document.getElementById("stat-streak").textContent = stats.streak ?? "0";
	document.getElementById("stat-hardest").textContent =
		stats.hardestThisYear || "—";
}

// ---------- Climbs Table ----------

function buildInspectorDeps() {
	return {
		gpsData: _gpsData,
		routeCountries: _routeCountries,
		communityRatings: _communityRatings,
		sendClasses: SEND_CLASSES,
		formatDate,
		currentUID: () => auth.currentUser?.uid ?? null,
		getRoute,
		fetchAscents,
		fetchPhotos,
		showEditSendOverlay,
		showEditProjectOverlay,
	};
}

function pageWindow() {
	const total = _filteredClimbs.length;
	const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
	if (_currentPage > totalPages) _currentPage = totalPages;
	const start = (_currentPage - 1) * ITEMS_PER_PAGE;
	return {
		totalPages,
		start,
		pageClimbs: _filteredClimbs.slice(start, start + ITEMS_PER_PAGE),
	};
}

function appendRow(tbody, climb, inspectorDeps) {
	const rowMeta = {
		gradeClass: gradeBadgeClass(climb.difficulty),
		sendClass: SEND_CLASSES[climb.sendType] ?? "send-proj",
		dateText: formatDate(climb.date),
		starsHtml: renderStarsHtml(climb.rating),
	};
	const tr = document.createElement("tr");
	tr.style.cursor = "pointer";
	tr.innerHTML = buildClimbRowCellsHtml(climb, rowMeta, inspectorDeps);
	bindClimbRowClick(tr, climb, inspectorDeps);
	tbody.appendChild(tr);
}

export function renderClimbsTable(climbs) {
	_filteredClimbs = climbs || [];
	const tbody = document.getElementById("climbs-tbody");
	const table = document.getElementById("climbs-table");
	const empty = document.getElementById("empty-state");
	const inspectorDeps = buildInspectorDeps();

	tbody.innerHTML = "";

	if (_filteredClimbs.length === 0) {
		table.style.display = "none";
		empty.style.display = "block";
		renderPagination(0, 0);
		syncTableCardHeader(0, 0, 0);
		syncInspectorForPage([], inspectorDeps);
		return;
	}

	table.style.display = "";
	empty.style.display = "none";

	const { totalPages, start, pageClimbs } = pageWindow();
	for (const climb of pageClimbs) {
		appendRow(tbody, climb, inspectorDeps);
	}

	renderPagination(_filteredClimbs.length, totalPages);
	syncTableCardHeader(_filteredClimbs.length, start, pageClimbs.length);
	syncInspectorForPage(pageClimbs, inspectorDeps);
}

function renderPagination(total, totalPages) {
	const bar = document.getElementById("pagination-bar");
	if (!bar) return;
	if (totalPages <= 1) {
		bar.classList.add("hidden");
		return;
	}
	bar.classList.remove("hidden");
	bar.innerHTML = `
    <button class="page-btn" id="page-prev" ${_currentPage <= 1 ? "disabled" : ""}>&#8249; Prev</button>
    <span class="page-info">Page ${_currentPage} of ${totalPages} <span class="page-count">(${total} climbs)</span></span>
    <button class="page-btn" id="page-next" ${_currentPage >= totalPages ? "disabled" : ""}>Next &#8250;</button>
  `;
	document.getElementById("page-prev").addEventListener("click", () => {
		if (_currentPage > 1) {
			_currentPage--;
			renderClimbsTable(_filteredClimbs);
		}
	});
	document.getElementById("page-next").addEventListener("click", () => {
		if (_currentPage < totalPages) {
			_currentPage++;
			renderClimbsTable(_filteredClimbs);
		}
	});
}

// ---------- Detail Modal ----------

export function hideDetailModal() {
	document.getElementById("modal-overlay").style.display = "none";
	document.body.style.overflow = "";
}

// ---------- Toast ----------

export function showToast(message, type = "info") {
	const toast = document.getElementById("toast");
	toast.textContent = message;
	toast.className = `toast toast-${type}`;
	setTimeout(() => {
		toast.className = "toast hidden";
	}, 3000);
}

// ---------- Loading skeleton ----------

export function showLoading(visible) {
	const skeleton = document.getElementById("loading-skeleton");
	const table = document.getElementById("climbs-table");
	if (visible) {
		skeleton.style.display = "";
		table.style.display = "none";
	} else {
		skeleton.style.display = "none";
	}
}

// ---------- Populate filters ----------

export function populateFilters(climbs) {
	const areaSelect = document.getElementById("filter-area");
	const yearSelect = document.getElementById("filter-year");
	const typeSelect = document.getElementById("filter-routetype");

	const areas = [
		...new Set(climbs.map((c) => c.climbingArea).filter(Boolean)),
	].sort((a, b) => a.localeCompare(b));
	const years = [
		...new Set(climbs.filter((c) => c.date).map((c) => c.date.getFullYear())),
	].sort((a, b) => b - a);
	const types = [
		...new Set(climbs.map((c) => c.routeType).filter(Boolean)),
	].sort((a, b) => a.localeCompare(b));

	areaSelect.innerHTML = '<option value="">All Areas</option>';
	for (const area of areas) {
		const opt = document.createElement("option");
		opt.value = area;
		opt.textContent = area;
		areaSelect.appendChild(opt);
	}

	yearSelect.innerHTML = '<option value="">All Years</option>';
	for (const year of years) {
		const opt = document.createElement("option");
		opt.value = year;
		opt.textContent = year;
		yearSelect.appendChild(opt);
	}

	if (typeSelect) {
		// Chip-value parity: the select must offer exactly the chip values, or
		// clicking a chip could target a missing option and silently clear the
		// filter (e.g. a logbook with only "Gym Boulder" climbs → merged "Gym"
		// chip, no raw "Gym" option). Same order/merge as the chip bar.
		typeSelect.innerHTML = '<option value="">All Types</option>';
		for (const value of orderRouteTypeFilterValues(types)) {
			const opt = document.createElement("option");
			opt.value = value;
			opt.textContent = value;
			typeSelect.appendChild(opt);
		}
	}
	syncRouteTypeChipBar(types);
}
