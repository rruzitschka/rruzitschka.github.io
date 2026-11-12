// ui.js — Dashboard data loading and filter/view wiring (modular SDK)

import {
	fetchClimbs as $fetchClimbs,
	saveClimbNote as $saveClimbNote,
	fetchAllClimbAscents as $fetchAllClimbAscents,
	computeStats as $computeStats,
	filterClimbs as $filterClimbs,
} from "./firebase-climbs.js";
import {
	setAccountUIMockServices,
} from "./account-ui.js";
import { bindViewSwitcher } from "./view-switcher.js";
import {
	checkAdminStatus as $checkAdminStatus,
	reportRating as $reportRating,
	fetchRouteData as $fetchRouteData,
} from "./firebase-routes.js";
import { showAdminView } from "./admin.js";
import {
	bindSendOverlayHandlers,
	setSendOverlayMockServices,
} from "./send-overlay-ui.js";
import {
	bindProjectOverlayHandlers,
	setProjectOverlayMockServices,
} from "./project-overlay-ui.js";
import {
	setOverlayCommonMockServices,
	setDataLoader,
} from "./overlay-common.js";
import {
	showTrainingView,
	bindTrainingOverlayHandlers,
	bindPeriodTabs,
	loadTrainingData,
	setTrainingMockServices,
} from "./training-ui.js";
import {
	renderStatsBar,
	renderClimbsTable,
	populateFilters,
	showLoading,
	showToast,
	hideDetailModal,
	resetTablePage,
	setRouteData,
	setClimbTableMockServices,
} from "./climb-table-ui.js";

// Grades API lives in grades.js (regular script); grade helpers moved to
// climb-table-ui.js.

// ── Mutable service references (can be overridden by setMockServices) ──
let fetchClimbs = $fetchClimbs;
let fetchAllClimbAscents = $fetchAllClimbAscents;
let saveClimbNote = $saveClimbNote;
let computeStats = $computeStats;
let filterClimbs = $filterClimbs;
let checkAdminStatus = $checkAdminStatus;
let reportRating = $reportRating;
let fetchRouteData = $fetchRouteData;

// Service name → setter for the mutable bindings above (keeps
// setMockServices constant-size when new services are added).
const SERVICE_MOCK_SETTERS = {
	fetchClimbs: (fn) => (fetchClimbs = fn),
	fetchAllClimbAscents: (fn) => (fetchAllClimbAscents = fn),
	saveClimbNote: (fn) => (saveClimbNote = fn),
	computeStats: (fn) => (computeStats = fn),
	filterClimbs: (fn) => (filterClimbs = fn),
	fetchRouteData: (fn) => (fetchRouteData = fn),
	checkAdminStatus: (fn) => (checkAdminStatus = fn),
	reportRating: (fn) => (reportRating = fn),
};

/**
 * Override service bindings for mock mode.
 * Call this before loadData() when mock=true.
 */
export function setMockServices(mocks) {
	for (const [key, set] of Object.entries(SERVICE_MOCK_SETTERS)) {
		if (mocks[key]) set(mocks[key]);
	}
	setOverlayCommonMockServices(mocks);
	setSendOverlayMockServices(mocks);
	setProjectOverlayMockServices(mocks);
	setAccountUIMockServices(mocks);
	setClimbTableMockServices(mocks);
	setTrainingMockServices(mocks);
}

// ---------- Module-level state ----------

let _allClimbs = [];
let _currentRefresh = null;

let _routeDataFetched = false; // set when fetchRouteData succeeded; retry on next load otherwise

// ---------- User chip ----------

export function renderUserChip(user) {
	const chip = document.getElementById("user-chip");
	if (!chip) return;
	const name =
		user?.displayName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Climber";
	chip.textContent = name;
}

// ---------- Count badges ----------

function updateCountBadges(filtered) {
	const badgeAll = document.getElementById("badge-all");
	const badgeProjects = document.getElementById("badge-projects");
	const badgeSent = document.getElementById("badge-sent");
	if (badgeAll) badgeAll.textContent = filtered.length;
	if (badgeProjects)
		badgeProjects.textContent = filtered.filter((c) => c.isProject).length;
	if (badgeSent)
		badgeSent.textContent = filtered.filter((c) => !c.isProject).length;
}

// ---------- Filter + search handler wiring ----------

function bindFilterHandlers(initialClimbs) {
	_allClimbs = initialClimbs;
	window.allClimbs = initialClimbs;

	function refresh(view = viewSwitcher.getActiveView()) {
		resetTablePage(); // reset to first page on any filter/search change
		const area = document.getElementById("filter-area").value;
		const year = document.getElementById("filter-year").value;
		const sendType = document.getElementById("filter-sendtype").value;
		const routeType = document.getElementById("filter-routetype")?.value ?? "";
		const search = document.getElementById("search-input").value;
		const sort = document.getElementById("sort-select").value;

		let filtered = filterClimbs(_allClimbs, {
			area,
			year,
			sendType,
			routeType,
			search,
			sort,
		});

		// Update badges from search/filter result BEFORE applying the view filter
		// so "All Climbs" count stays stable regardless of which view is active
		updateCountBadges(filtered);

		// Apply sidebar view filter on top
		if (view === "projects")
			filtered = filtered.filter((c) => Boolean(c.isProject));
		else if (view === "sent")
			filtered = filtered.filter((c) => !c.isProject);

		renderClimbsTable(filtered);
	}

	_currentRefresh = refresh;

	const viewSwitcher = bindViewSwitcher({ refresh });

	[
		"filter-area",
		"filter-year",
		"filter-sendtype",
		"filter-routetype",
		"sort-select",
	].forEach((id) => {
		document.getElementById(id)?.addEventListener("change", refresh);
	});

	let searchTimer;
	document.getElementById("search-input").addEventListener("input", () => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(refresh, 300);
	});

	// Initial badge update
	updateCountBadges(_allClimbs);
}

// ---------- Modal close handlers ----------

// Modules run after DOM is parsed; execute init immediately (no DOMContentLoaded needed)
{
	document
		.getElementById("modal-close")
		?.addEventListener("click", hideDetailModal);
	document.getElementById("modal-overlay")?.addEventListener("click", (e) => {
		if (e.target === e.currentTarget) hideDetailModal();
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") hideDetailModal();
	});

	document
		.querySelector('[data-view="training"]')
		?.addEventListener("click", (e) => {
			e.preventDefault();
			showTrainingView();
		});

	document.getElementById("view-admin")?.addEventListener("click", (e) => {
		e.preventDefault();
		showAdminView();
	});

	document
		.getElementById("account-export-btn")
		?.addEventListener("click", exportCSV);

	bindSendOverlayHandlers();
	bindProjectOverlayHandlers();
	bindTrainingOverlayHandlers();
	bindPeriodTabs();

	// Inject the full-refresh callback so the overlay modules can trigger
	// loadData without a circular module import.
	setDataLoader(loadData);

	// Expose helpers for non-module consumers (stats.js, admin.js,
	// account-ui.js — via globalThis shims)
	globalThis.escapeHtml = escapeHtml;
	globalThis.showToast = showToast;
	globalThis.hideDetailModal = hideDetailModal;
}

// ---------- Utility ----------

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// ---------- Export CSV ----------

function exportCSV() {
	const header =
		"Date,Route,Area,Crag,Grade,Rating,Note,SendType,RouteType,ProjectStatus,AttemptCount,HighPoint,LastAttemptDate,ProjectNotes,AscentType,AscentID,AscentNotes,AscentDate,NumberOfPitches,ApproachNotes,DescentNotes,GearNotes,ClimbDuration,AscentDuration\n";
	const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
	const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-CA") : ""); // YYYY-MM-DD
	let rows = "";
	for (const c of _allClimbs) {
		const base = [
			esc(fmtDate(c.date)),
			esc(c.route),
			esc(c.climbingArea),
			esc(c.crag),
			esc(c.difficulty),
			esc(c.rating ?? 0),
			esc(c.noteText),
			esc(c.sendType),
			esc(c.routeType),
			esc(c.projectStatus),
			esc(c.attemptCount ?? 0),
			esc(c.highPoint),
			esc(fmtDate(c.lastAttemptDate)),
			esc(c.projectNotes),
		].join(",");
		// Multi-pitch plan fields (ClimbNote-level, repeated on every row for this route).
		const multiPitch = [
			esc(c.numberOfPitches ?? ""),
			esc(c.approachNotes),
			esc(c.descentNotes),
			esc(c.gearNotes),
			esc(c.climbDuration ?? ""),
		].join(",");
		// FirstSend row: AscentDuration is blank (first-ascent duration lives in ClimbDuration).
		rows +=
			base +
			"," +
			[
				esc("FirstSend"),
				esc(c.id ?? c.recordName),
				esc(""),
				esc(fmtDate(c.date)),
			].join(",") +
			"," +
			multiPitch +
			"," +
			esc("") +
			"\n";
		for (const a of c.ascents ?? []) {
			rows +=
				base +
				"," +
				[
					esc("Repeat"),
					esc(a.id ?? a.recordName),
					esc(a.notes),
					esc(fmtDate(a.date)),
				].join(",") +
				"," +
				multiPitch +
				"," +
				esc(a.duration ?? "") +
				"\n";
		}
	}
	const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `sendlog-export-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

// ---------- Community rating bootstrap ----------

async function bootstrapCommunityRatings(climbs) {
	if (localStorage.getItem("hasBootstrappedCommunityRatings") === "true")
		return;

	const toReport = climbs.filter(
		(c) =>
			c.centralRouteID &&
			!c.isProject &&
			(c.rating ?? 0) > 0 &&
			(c.reportedRating ?? 0) === 0,
	);

	if (toReport.length === 0) {
		localStorage.setItem("hasBootstrappedCommunityRatings", "true");
		return;
	}

	for (const c of toReport) {
		reportRating(c.centralRouteID, c.rating, 0); // fire-and-forget
		await saveClimbNote({
			// persist reportedRating
			recordName: c.recordName,
			id: c.id ?? c.recordName,
			route: c.route,
			climbingArea: c.climbingArea,
			crag: c.crag,
			difficulty: c.difficulty,
			sendType: c.sendType,
			routeType: c.routeType,
			rating: c.rating,
			reportedRating: c.rating,
			noteText: c.noteText,
			date: c.date,
			centralRouteID: c.centralRouteID,
		}).catch((err) => console.warn("bootstrap saveClimbNote failed:", err));
	}

	localStorage.setItem("hasBootstrappedCommunityRatings", "true");
	console.warn(`[Community Rating] Bootstrapped ${toReport.length} send(s).`);
}

// ---------- loadData ----------

export async function loadData() {
	showLoading(true);
	let climbs;
	try {
		climbs = await fetchClimbs();
		await fetchAllClimbAscents(climbs);
	} catch (err) {
		showLoading(false);
		showToast("Failed to load climbs. Please try again.", "error");
		console.error("Load error:", err);
		return;
	}
	showLoading(false);
	applyLoadedClimbs(climbs);
}

/** Render the freshly loaded climbs and schedule the fire-and-forget side loads. */
function applyLoadedClimbs(climbs) {
	_allClimbs = climbs;
	window.allClimbs = climbs;
	renderStatsBar(computeStats(climbs));
	populateFilters(climbs);
	if (_currentRefresh) {
		_currentRefresh();
	} else {
		renderClimbsTable(climbs);
		bindFilterHandlers(climbs);
	}
	scheduleSideLoads(climbs);
}

function scheduleSideLoads(climbs) {
	// Training badge must show the session count on first load, not only
	// after the Training view is opened (user-reported). Fire-and-forget:
	// the climbs view renders without waiting for this.
	loadTrainingData().catch((err) =>
		console.warn("Training sessions could not be loaded", err),
	);
	// Reveal admin sidebar item if current user is an admin
	revealAdminSidebarItem();
	// Fetch community ratings once per session and re-render table with them
	// Mirrors SendLogsView.task { guard communityRatings.isEmpty else { return } } in iOS
	fetchCommunityRouteData(climbs);
	// One-time bootstrap: report ratings for sends linked before this feature existed
	bootstrapCommunityRatings(climbs).catch((err) =>
		console.warn("bootstrapCommunityRatings failed:", err),
	);
}

function revealAdminSidebarItem() {
	checkAdminStatus().then((isAdmin) => {
		document
			.getElementById("view-admin")
			?.classList.toggle("hidden", !isAdmin);
	});
}

function fetchCommunityRouteData(climbs) {
	const linkedIDs = [
		...new Set(climbs.map((c) => c.centralRouteID).filter(Boolean)),
	];
	if (_routeDataFetched || linkedIDs.length === 0) return;
	fetchRouteData(linkedIDs)
		.then(({ ratings, gps, countries }) => {
			_routeDataFetched = true; // failed fetches retry on next list load
			setRouteData({ ratings, gps, countries });
			if (_currentRefresh) _currentRefresh();
		})
		.catch(() => {});
}

