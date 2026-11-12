// ui.js — Dashboard UI rendering and interaction (modular SDK)

import { auth } from "./firebase-config.js";
import {
	fetchClimbs as $fetchClimbs,
	fetchAscents as $fetchAscents,
	fetchPhotos as $fetchPhotos,
	saveClimbNote as $saveClimbNote,
	fetchAllClimbAscents as $fetchAllClimbAscents,
	canonicalizeProjectStatus,
	computeStats as $computeStats,
	filterClimbs as $filterClimbs,
} from "./firebase-climbs.js";
import {
	getCurrentUser as $getCurrentUser,
	deleteAccount as $deleteAccount,
} from "./firebase-auth.js";
import {
	apiKeysList as $apiKeysList,
	apiKeysCreate as $apiKeysCreate,
	apiKeysRevoke as $apiKeysRevoke,
} from "./firebase-api-keys.js";
import {
	checkAdminStatus as $checkAdminStatus,
	getRoute as $getRoute,
	incrementProjectCount as $incrementProjectCount,
	decrementProjectCount as $decrementProjectCount,
	reportRating as $reportRating,
	fetchRouteData as $fetchRouteData,
} from "./firebase-routes.js";
import { showAdminView } from "./admin.js";
import {
	showAddSendOverlay,
	showEditSendOverlay,
	bindSendOverlayHandlers,
	setSendOverlayMockServices,
} from "./send-overlay-ui.js";
import {
	overlayState,
	resetOverlayState,
	syncOverlayCountrySelects,
	syncFindRouteBtn,
	bindOverlayCommon,
	bindOverlayDeleteHandler,
	fetchRouteOwnershipThenSync,
	maybeCreateCentralRoute,
	maybePropagateToRoute,
	setOverlayCommonMockServices,
	setDataLoader,
} from "./overlay-common.js";import {
	showTrainingView,
	bindTrainingOverlayHandlers,
	bindPeriodTabs,
	loadTrainingData,
	ensureTrainingSessionsLoaded,
	setTrainingMockServices,
} from "./training-ui.js";
import {
	setFindRouteLinked,
	setFindRouteUnlinked,
} from "./route-link-ui.js";
import {
	syncRouteTypeChipBar,
	syncTableCardHeader,
	buildClimbRowCellsHtml,
	bindClimbRowClick,
	syncInspectorForPage,
} from "./climb-inspector-ui.js";
import { renderStarsHtml } from "./ui-theme.js";

// Grades API — provided by grades.js (regular script, always loaded before modules)
const GRADES = window.GRADES;
const getPreferredGradeSystem = () => window.getPreferredGradeSystem();
const setPreferredGradeSystem = (s) => window.setPreferredGradeSystem(s);
const initGradePicker = (...a) => window.initGradePicker(...a);

// ── Mutable service references (can be overridden by setMockServices) ──
let fetchClimbs = $fetchClimbs;
let fetchAscents = $fetchAscents;
let fetchAllClimbAscents = $fetchAllClimbAscents;
let saveClimbNote = $saveClimbNote;
let fetchPhotos = $fetchPhotos;
let computeStats = $computeStats;
let filterClimbs = $filterClimbs;
let getCurrentUser = $getCurrentUser;
let deleteAccount = $deleteAccount;
let apiKeysList = $apiKeysList;
let apiKeysCreate = $apiKeysCreate;
let apiKeysRevoke = $apiKeysRevoke;
let checkAdminStatus = $checkAdminStatus;
let getRoute = $getRoute;
let incrementProjectCount = $incrementProjectCount;
let decrementProjectCount = $decrementProjectCount;
let reportRating = $reportRating;
let fetchRouteData = $fetchRouteData;

// Service name → setter for the mutable bindings above (keeps
// setMockServices constant-size when new services are added).
const SERVICE_MOCK_SETTERS = {
	fetchClimbs: (fn) => (fetchClimbs = fn),
	fetchAscents: (fn) => (fetchAscents = fn),
	fetchAllClimbAscents: (fn) => (fetchAllClimbAscents = fn),
	saveClimbNote: (fn) => (saveClimbNote = fn),
	fetchPhotos: (fn) => (fetchPhotos = fn),
	computeStats: (fn) => (computeStats = fn),
	filterClimbs: (fn) => (filterClimbs = fn),
	getCurrentUser: (fn) => (getCurrentUser = fn),
	deleteAccount: (fn) => (deleteAccount = fn),
	apiKeysList: (fn) => (apiKeysList = fn),
	apiKeysCreate: (fn) => (apiKeysCreate = fn),
	apiKeysRevoke: (fn) => (apiKeysRevoke = fn),
	getRoute: (fn) => (getRoute = fn),
	fetchRouteData: (fn) => (fetchRouteData = fn),
	checkAdminStatus: (fn) => (checkAdminStatus = fn),
	incrementProjectCount: (fn) => (incrementProjectCount = fn),
	decrementProjectCount: (fn) => (decrementProjectCount = fn),
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
	setTrainingMockServices(mocks);
}

// ---------- Module-level state ----------

let _allClimbs = [];
let _currentRefresh = null;
let _currentPage = 1;
let _filteredClimbs = [];
const ITEMS_PER_PAGE = 20;

let _communityRatings = new Map(); // routeID -> communityRating; fetched once per session
let _gpsData = new Map(); // routeID -> {latitude, longitude, country}
let _routeCountries = new Map(); // routeID -> ISO country code (only when set); fetched once per session
let _routeDataFetched = false; // set when fetchRouteData succeeded; retry on next load otherwise
/** @type {Map<string, Array>} */

const SEND_CLASSES = {
	Redpoint: "send-rp",
	"On Sight": "send-os",
	"Top Rope": "send-tr",
	"All Free": "send-af",
	Project: "send-proj",
	Pinkpoint: "send-pp",
};

// "Hard" threshold: top ~25% of each grade system
// French ≥ 8b+, UIAA ≥ 11+, YDS ≥ 5.14a
function gradeBadgeClass(difficulty) {
	if (!difficulty) return "grade-normal";
	const fr = GRADES?.French ?? [];
	const uiaa = GRADES?.UIAA ?? [];
	const yds = GRADES?.YDS ?? [];
	const frIdx = fr.indexOf(difficulty);
	const uiaaIdx = uiaa.indexOf(difficulty);
	const ydsIdx = yds.indexOf(difficulty);
	if (frIdx !== -1)
		return frIdx >= fr.indexOf("8b+") ? "grade-hard" : "grade-normal";
	if (uiaaIdx !== -1)
		return uiaaIdx >= uiaa.indexOf("11+") ? "grade-hard" : "grade-normal";
	if (ydsIdx !== -1)
		return ydsIdx >= yds.indexOf("5.14a") ? "grade-hard" : "grade-normal";
	return "grade-normal";
}

function formatDate(date) {
	if (!date) return "—";
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

// ---------- Stats Bar ----------

function renderStatsBar(stats) {
	document.getElementById("stat-total").textContent = stats.total ?? "—";
	document.getElementById("stat-this-year").textContent = stats.thisYear ?? "—";
	document.getElementById("stat-streak").textContent = stats.streak ?? "0";
	document.getElementById("stat-hardest").textContent =
		stats.hardestThisYear || "—";
}

// ---------- Climbs Table ----------

function renderClimbsTable(climbs) {
	_filteredClimbs = climbs || [];
	const tbody = document.getElementById("climbs-tbody");
	const table = document.getElementById("climbs-table");
	const empty = document.getElementById("empty-state");
	const inspectorDeps = {
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

	const totalPages = Math.ceil(_filteredClimbs.length / ITEMS_PER_PAGE);
	if (_currentPage > totalPages) _currentPage = totalPages;
	const start = (_currentPage - 1) * ITEMS_PER_PAGE;
	const pageClimbs = _filteredClimbs.slice(start, start + ITEMS_PER_PAGE);

	for (const climb of pageClimbs) {
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

function hideDetailModal() {
	document.getElementById("modal-overlay").style.display = "none";
	document.body.style.overflow = "";
}

// ---------- Toast ----------

function showToast(message, type = "info") {
	const toast = document.getElementById("toast");
	toast.textContent = message;
	toast.className = `toast toast-${type}`;
	setTimeout(() => {
		toast.className = "toast hidden";
	}, 3000);
}

// ---------- Loading skeleton ----------

function showLoading(visible) {
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

function populateFilters(climbs) {
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
		typeSelect.innerHTML = '<option value="">All Types</option>';
		for (const type of types) {
			const opt = document.createElement("option");
			opt.value = type;
			opt.textContent = type;
			typeSelect.appendChild(opt);
		}
	}
	syncRouteTypeChipBar(types);
}

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
	let activeView = "all"; // 'all' | 'projects' | 'sent'

	function refresh() {
		_currentPage = 1; // reset to first page on any filter/search change
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
		if (activeView === "projects")
			filtered = filtered.filter((c) => Boolean(c.isProject));
		else if (activeView === "sent")
			filtered = filtered.filter((c) => !c.isProject);

		renderClimbsTable(filtered);
	}

	_currentRefresh = refresh;

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

	// Sidebar view links
	function setActiveView(view) {
		activeView = view;
		showLogbookView();
		document.getElementById("stats-view")?.classList.add("hidden");
		["view-all", "view-projects", "view-sent"].forEach((id) => {
			document.getElementById(id)?.classList.remove("active");
		});
		// Deactivate training, stats and admin sidebar items
		document
			.querySelector('[data-view="training"]')
			?.classList.remove("active");
		document.getElementById("view-stats")?.classList.remove("active");
		document.getElementById("view-admin")?.classList.remove("active");
		const viewMap = {
			all: "view-all",
			projects: "view-projects",
			sent: "view-sent",
		};
		const labelMap = {
			all: "All Climbs",
			projects: "Projects",
			sent: "Sent Climbs",
		};
		document.getElementById(viewMap[view])?.classList.add("active");
		const lbl = document.getElementById("view-label");
		if (lbl) lbl.textContent = labelMap[view] ?? "All Climbs";
		// Context-aware action button
		const logSendBtn = document.getElementById("btn-log-send");
		const addProjectBtn = document.getElementById("btn-add-project");
		if (logSendBtn && addProjectBtn) {
			logSendBtn.classList.toggle(
				"hidden",
				view === "projects" || view === "training",
			);
			addProjectBtn.classList.toggle("hidden", view !== "projects");
		}
		refresh();
	}

	document.getElementById("view-all")?.addEventListener("click", (e) => {
		e.preventDefault();
		setActiveView("all");
	});
	document.getElementById("view-projects")?.addEventListener("click", (e) => {
		e.preventDefault();
		setActiveView("projects");
	});
	document.getElementById("view-sent")?.addEventListener("click", (e) => {
		e.preventDefault();
		setActiveView("sent");
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

	document.getElementById("view-stats")?.addEventListener("click", (e) => {
		e.preventDefault();
		showStatsView();
	});

	document.getElementById("view-admin")?.addEventListener("click", (e) => {
		e.preventDefault();
		showAdminView();
	});

	document.getElementById("view-account")?.addEventListener("click", (e) => {
		e.preventDefault();
		showAccountView();
	});

	document
		.getElementById("account-export-btn")
		?.addEventListener("click", exportCSV);
	document
		.getElementById("delete-account-btn")
		?.addEventListener("click", handleDeleteAccount);

	bindSendOverlayHandlers();
	bindProjectOverlayHandlers();
	bindTrainingOverlayHandlers();
	bindApiKeyHandlers();
	bindPeriodTabs();

	// Inject the full-refresh callback so the overlay modules can trigger
	// loadData without a circular module import.
	setDataLoader(loadData);

	// Expose helpers for non-module consumers (stats.js, admin.js)
	globalThis.escapeHtml = escapeHtml;
	globalThis.showConfirmDialog = showConfirmDialog;
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

// ---------- Delete account ----------

async function handleDeleteAccount() {
	if (typeof deleteAccount !== "function") {
		showToast("Account deletion is not available in this mode.", "info");
		return;
	}
	const confirmed = await showConfirmDialog(
		"Delete Account",
		"Your cloud data (climbs, ascents, photos) will be permanently deleted from the server. Your local session will end. This cannot be undone.",
	);
	if (!confirmed) return;
	try {
		await deleteAccount();
		window.location.href = "../login.html";
	} catch (err) {
		console.error("Delete account failed:", err);
		showToast("Failed to delete account. Please try again.", "error");
	}
}

// ---------- API Keys ----------

async function renderApiKeys() {
	const list = document.getElementById("api-keys-list");
	if (!list) return;

	list.innerHTML =
		'<p style="color:#94a3b8;font-size:14px;margin:0">Loading…</p>';

	try {
		const keys = await apiKeysList();

		if (keys.length === 0) {
			list.innerHTML =
				'<p style="color:#94a3b8;font-size:14px;margin:0">No API keys yet.</p>';
			return;
		}

		list.innerHTML = keys
			.map((k) => {
				const created = k.createdAt
					? new Date(k.createdAt).toLocaleDateString("en-US", {
							year: "numeric",
							month: "short",
							day: "numeric",
						})
					: "—";
				const lastUsed = k.lastUsedAt
					? new Date(k.lastUsedAt).toLocaleDateString("en-US", {
							year: "numeric",
							month: "short",
							day: "numeric",
						})
					: "never";
				return `
        <div class="account-card" style="margin-bottom:0.5rem">
          <div class="account-card-text">
            <strong>🔑 ${escapeHtml(k.label)}</strong>
            <p style="margin:2px 0 0">
              <span class="type-badge">${escapeHtml((k.scopes || []).join(", "))}</span>
            </p>
            <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">
              Created ${created} · Last used ${lastUsed}
            </p>
          </div>
          <button class="btn btn-danger btn-sm"
                  data-key-id="${escapeHtml(k.id)}"
                  data-key-label="${escapeHtml(k.label)}">Revoke</button>
        </div>
      `;
			})
			.join("");

		list.querySelectorAll(".btn-danger").forEach((btn) => {
			btn.addEventListener("click", () =>
				handleRevokeKey(btn.dataset.keyId, btn.dataset.keyLabel),
			);
		});
	} catch (e) {
		console.error("Failed to load API keys:", e);
		list.innerHTML =
			'<p style="color:#ef4444;font-size:14px;margin:0">Failed to load keys.</p>';
	}
}

async function handleRevokeKey(keyId, label) {
	const confirmed = await showConfirmDialog(
		"Revoke Key?",
		`"${label}" will stop working immediately. This cannot be undone.`,
	);
	if (!confirmed) return;
	try {
		await apiKeysRevoke(keyId);
		showToast("API key revoked.", "success");
		await renderApiKeys();
	} catch (e) {
		console.error("Revoke failed:", e);
		showToast("Failed to revoke key. Please try again.", "error");
	}
}

function openApiKeyOverlay() {
	document.getElementById("api-key-label").value = "";
	document.getElementById("api-key-label-error").classList.add("hidden");
	document
		.querySelectorAll('#api-key-overlay input[name="api-key-scope"]')
		.forEach((cb) => {
			cb.checked = true;
		});
	document.getElementById("api-key-overlay").classList.remove("hidden");
	document.getElementById("api-key-label").focus();
}

function closeApiKeyOverlay() {
	document.getElementById("api-key-overlay").classList.add("hidden");
}

async function handleGenerateKey() {
	const label = document.getElementById("api-key-label").value.trim();
	const errorEl = document.getElementById("api-key-label-error");

	if (!label) {
		errorEl.classList.remove("hidden");
		document.getElementById("api-key-label").focus();
		return;
	}
	errorEl.classList.add("hidden");

	const scopes = [
		...document.querySelectorAll(
			'#api-key-overlay input[name="api-key-scope"]:checked',
		),
	].map((cb) => cb.value);
	if (scopes.length === 0) {
		showToast("Select at least one scope.", "error");
		return;
	}

	const saveBtn = document.getElementById("api-key-overlay-save");
	saveBtn.disabled = true;
	saveBtn.textContent = "Generating…";

	try {
		const result = await apiKeysCreate({ label, scopes });
		closeApiKeyOverlay();
		document.getElementById("api-key-created-value").textContent = result.key;
		document
			.getElementById("api-key-created-overlay")
			.classList.remove("hidden");
		await renderApiKeys();
	} catch (e) {
		console.error("Generate key failed:", e);
		showToast("Failed to generate key. Please try again.", "error");
	} finally {
		saveBtn.disabled = false;
		saveBtn.textContent = "Generate";
	}
}

function bindApiKeyHandlers() {
	document
		.getElementById("api-key-generate-btn")
		?.addEventListener("click", openApiKeyOverlay);
	document
		.getElementById("api-key-overlay-close")
		?.addEventListener("click", closeApiKeyOverlay);
	document
		.getElementById("api-key-overlay-cancel")
		?.addEventListener("click", closeApiKeyOverlay);
	document.getElementById("api-key-overlay")?.addEventListener("click", (e) => {
		if (e.target === e.currentTarget) closeApiKeyOverlay();
	});
	document
		.getElementById("api-key-overlay-save")
		?.addEventListener("click", handleGenerateKey);
	document.getElementById("api-key-copy-btn")?.addEventListener("click", () => {
		const key = document.getElementById("api-key-created-value").textContent;
		navigator.clipboard
			.writeText(key)
			.then(() => showToast("Key copied to clipboard!", "success"))
			.catch(() => showToast("Copy failed — please copy manually.", "error"));
	});
	document
		.getElementById("api-key-created-done")
		?.addEventListener("click", () => {
			document
				.getElementById("api-key-created-overlay")
				.classList.add("hidden");
		});
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
	try {
		const climbs = await fetchClimbs();
		await fetchAllClimbAscents(climbs);
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
		// Training badge must show the session count on first load, not only
		// after the Training view is opened (user-reported). Fire-and-forget:
		// the climbs view renders without waiting for this.
		loadTrainingData().catch((err) =>
			console.warn("Training sessions could not be loaded", err),
		);
		// Reveal admin sidebar item if current user is an admin
		checkAdminStatus().then((isAdmin) => {
			document
				.getElementById("view-admin")
				?.classList.toggle("hidden", !isAdmin);
		});

		// Fetch community ratings once per session and re-render table with them
		// Mirrors SendLogsView.task { guard communityRatings.isEmpty else { return } } in iOS
		const linkedIDs = [
			...new Set(climbs.map((c) => c.centralRouteID).filter(Boolean)),
		];
		if (!_routeDataFetched && linkedIDs.length > 0) {
			fetchRouteData(linkedIDs)
				.then(({ ratings, gps, countries }) => {
					_routeDataFetched = true; // failed fetches retry on next list load
					_communityRatings = ratings;
					_gpsData = gps;
					_routeCountries = countries;
					if (_currentRefresh) _currentRefresh();
				})
				.catch(() => {});
		}

		// One-time bootstrap: report ratings for sends linked before this feature existed
		bootstrapCommunityRatings(climbs).catch((err) =>
			console.warn("bootstrapCommunityRatings failed:", err),
		);
	} catch (err) {
		showLoading(false);
		showToast("Failed to load climbs. Please try again.", "error");
		console.error("Load error:", err);
	}
}

function showLogbookView() {
	document.getElementById("stats-bar").classList.remove("hidden");
	document.querySelector(".table-container").classList.remove("hidden");
	document.getElementById("training-view").classList.add("hidden");
	document.getElementById("account-view")?.classList.add("hidden");
	document.getElementById("stats-view")?.classList.add("hidden");
	document.getElementById("admin-view")?.classList.add("hidden");
}

function showAccountView() {
	document.getElementById("stats-bar").classList.add("hidden");
	document.querySelector(".table-container").classList.add("hidden");
	document.getElementById("training-view").classList.add("hidden");
	document.getElementById("stats-view")?.classList.add("hidden");
	document.getElementById("admin-view")?.classList.add("hidden");
	document.getElementById("account-view").classList.remove("hidden");
	// Clear sidebar active state (account is in header, not sidebar)
	["view-all", "view-projects", "view-sent"].forEach((id) => {
		document.getElementById(id)?.classList.remove("active");
	});
	document.querySelector('[data-view="training"]')?.classList.remove("active");
	document.getElementById("view-stats")?.classList.remove("active");
	document.getElementById("view-admin")?.classList.remove("active");
	document.getElementById("btn-log-send")?.classList.add("hidden");
	document.getElementById("btn-add-project")?.classList.add("hidden");

	// Populate user info
	const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
	const nameEl = document.getElementById("account-name");
	const emailEl = document.getElementById("account-email");
	if (nameEl) nameEl.textContent = user?.displayName ?? "Climber";
	if (emailEl) emailEl.textContent = user?.email ?? "";

	// Populate grade system preference (one-time binding on first open)
	const gradeSystemEl = document.getElementById("account-grade-system");
	if (gradeSystemEl && !gradeSystemEl.dataset.bound) {
		gradeSystemEl.value = getPreferredGradeSystem();
		gradeSystemEl.addEventListener("change", () => {
			setPreferredGradeSystem(gradeSystemEl.value);
		});
		gradeSystemEl.dataset.bound = "1";
	} else if (gradeSystemEl) {
		gradeSystemEl.value = getPreferredGradeSystem();
	}

	renderApiKeys();
}

async function showStatsView() {
	document.getElementById("stats-bar").classList.add("hidden");
	document.querySelector(".table-container").classList.add("hidden");
	document.getElementById("training-view").classList.add("hidden");
	document.getElementById("account-view")?.classList.add("hidden");
	document.getElementById("admin-view")?.classList.add("hidden");
	document.getElementById("stats-view").classList.remove("hidden");
	// Sidebar active state
	["view-all", "view-projects", "view-sent", "view-account"].forEach((id) => {
		document.getElementById(id)?.classList.remove("active");
	});
	document.querySelector('[data-view="training"]')?.classList.remove("active");
	document.getElementById("view-admin")?.classList.remove("active");
	document.getElementById("view-stats")?.classList.add("active");
	document.getElementById("btn-log-send")?.classList.add("hidden");
	document.getElementById("btn-add-project")?.classList.add("hidden");
	// Fetch sessions directly if not yet loaded (avoids calling renderTrainingPage as a side-effect)
	let sessions = [];
	try {
		sessions = await ensureTrainingSessionsLoaded();
	} catch (e) {
		console.warn("Stats: could not load training sessions", e);
	}
	renderStatsPage(globalThis.allClimbs ?? [], sessions);
	bindStatsPeriodTabs();
}

// ---------- Confirm dialog ----------

function showConfirmDialog(title, message) {
	return new Promise((resolve) => {
		document.getElementById("confirm-title").textContent = title;
		document.getElementById("confirm-message").textContent = message;
		const dialog = document.getElementById("confirm-dialog");
		dialog.classList.remove("hidden");
		const ok = document.getElementById("confirm-ok");
		const cancel = document.getElementById("confirm-cancel");
		function cleanup() {
			dialog.classList.add("hidden");
			ok.removeEventListener("click", onOk);
			cancel.removeEventListener("click", onCancel);
		}
		function onOk() {
			cleanup();
			resolve(true);
		}
		function onCancel() {
			cleanup();
			resolve(false);
		}
		ok.addEventListener("click", onOk);
		cancel.addEventListener("click", onCancel);
	});
}

function showAddProjectOverlay() {
	const overlay = document.getElementById("project-overlay");
	document.getElementById("project-overlay-title").textContent = "Add Project";
	document.getElementById("po-record-name").value = "";
	document.getElementById("po-route").value = "";
	document.getElementById("po-area").value = "";
	document.getElementById("po-crag").value = "";
	initGradePicker(document.getElementById("po-difficulty"), null);
	document.getElementById("po-routetype").value = "Sport";
	document.getElementById("po-attempts").value = "0";
	// iOS parity: a new project's date is its first attempt (default today).
	document.getElementById("po-date").value = new Date()
		.toISOString()
		.slice(0, 10);
	document.getElementById("po-last-attempt-date").value = "";
	document.getElementById("po-highpoint").value = "";
	document.getElementById("po-status").value = "active";
	document.getElementById("po-notes").value = "";
	document.getElementById("po-mark-sent-section").classList.add("hidden");
	document.getElementById("project-overlay-delete").classList.add("hidden");
	document.getElementById("po-route-error").classList.add("hidden");
	document.getElementById("po-route").classList.remove("error");
	resetOverlayState();
	setFindRouteUnlinked("find-route-btn-project");
	syncFindRouteBtn("find-route-btn-project");
	syncOverlayCountrySelects();
	overlay.classList.remove("hidden");
}

function showEditProjectOverlay(climb) {
	showAddProjectOverlay();
	document.getElementById("project-overlay-title").textContent = "Edit Project";
	document.getElementById("po-record-name").value = climb.recordName ?? "";
	document.getElementById("po-route").value = climb.route ?? "";
	document.getElementById("po-area").value = climb.climbingArea ?? "";
	document.getElementById("po-crag").value = climb.crag ?? "";
	initGradePicker(
		document.getElementById("po-difficulty"),
		climb.difficulty ?? null,
	);
	document.getElementById("po-routetype").value = climb.routeType ?? "Sport";
	document.getElementById("po-attempts").value = climb.attemptCount ?? 0;
	document.getElementById("po-date").value = climb.date
		? climb.date.toISOString().slice(0, 10)
		: "";
	document.getElementById("po-last-attempt-date").value = climb.lastAttemptDate
		? climb.lastAttemptDate.toISOString().slice(0, 10)
		: "";
	document.getElementById("po-highpoint").value = climb.highPoint ?? "";
	document.getElementById("po-status").value =
		canonicalizeProjectStatus(climb.projectStatus) ?? "active";
	document.getElementById("po-notes").value = climb.noteText ?? "";
	document.getElementById("po-mark-sent-section").classList.remove("hidden");
	document.getElementById("project-overlay-delete").classList.remove("hidden");

	if (climb.centralRouteID) {
		overlayState.centralRouteID = climb.centralRouteID;
		overlayState.centralRouteName = climb.route || "";
		overlayState.centralRouteCrag = climb.crag || "";
		overlayState.centralRouteArea = climb.climbingArea || "";
		overlayState.centralRouteCreatedBy = null;
		setFindRouteLinked("find-route-btn-project", climb.route, null);
		syncFindRouteBtn("find-route-btn-project");
		fetchRouteOwnershipThenSync(
			climb.centralRouteID,
			"find-route-btn-project",
			climb.route,
		);
	}
	syncOverlayCountrySelects();
}

function bindProjectOverlayHandlers() {
	const closeOverlay = bindOverlayCommon({
		overlayId: "project-overlay",
		fieldPrefix: "po",
		findRouteBtnId: "find-route-btn-project",
	});

	document
		.getElementById("project-overlay-save")
		.addEventListener("click", async function () {
			const routeVal = document.getElementById("po-route").value.trim();
			if (!routeVal) {
				document.getElementById("po-route").classList.add("error");
				document.getElementById("po-route-error").classList.remove("hidden");
				return;
			}
			document.getElementById("po-route").classList.remove("error");
			document.getElementById("po-route-error").classList.add("hidden");

			const btn = this;
			btn.disabled = true;
			btn.textContent = "Saving\u2026";
			try {
				const recordName =
					document.getElementById("po-record-name").value || undefined;
				const lastAttemptVal = document.getElementById("po-last-attempt-date").value;
				const poDateVal = document.getElementById("po-date").value;

				const centralID = await maybeCreateCentralRoute("po", routeVal);

				await saveClimbNote({
					recordName,
					id: recordName ? undefined : crypto.randomUUID().toUpperCase(),
					route: routeVal,
					climbingArea: document.getElementById("po-area").value.trim() || null,
					crag: document.getElementById("po-crag").value.trim() || null,
					difficulty: document.getElementById("po-difficulty").value || null,
					sendType: "Project",
					date: poDateVal ? new Date(poDateVal) : null,
					routeType: document.getElementById("po-routetype").value,
					attemptCount: Number(document.getElementById("po-attempts").value) || 0,
					lastAttemptDate: lastAttemptVal ? new Date(lastAttemptVal) : null,
					highPoint: document.getElementById("po-highpoint").value.trim() || null,
					projectStatus: document.getElementById("po-status").value,
					noteText: document.getElementById("po-notes").value.trim() || null,
					centralRouteID: centralID ?? null,
					reportedRating: 0, // projects never contribute to community rating
				});

				// Community rating — retract if a previously linked send had reported a rating
				// (can happen when converting a send to a project via edit)
				if (
					overlayState.previousReportedRating > 0
					&& overlayState.originalCentralRouteID
				) {
					reportRating(overlayState.originalCentralRouteID, 0, overlayState.previousReportedRating);
				}

				maybePropagateToRoute(centralID, "po", routeVal);

				if (centralID) {
					const isNew = !recordName;
					const projectStatus = document.getElementById("po-status").value;
					if (isNew) {
						incrementProjectCount(centralID);
					} else if (projectStatus === "abandoned") {
						decrementProjectCount(centralID);
					}
				}

				closeOverlay();
				await loadData();
			} catch (err) {
				console.error("Save project failed:", err);
				alert("Save failed: " + (err.message ?? err));
			} finally {
				btn.disabled = false;
				btn.textContent = "Save Project";
			}
		});

	bindOverlayDeleteHandler({
		deleteBtnId: "project-overlay-delete",
		recordFieldId: "po-record-name",
		routeFieldId: "po-route",
		label: "Project",
		closeOverlay,
	});

	document
		.getElementById("po-mark-sent")
		.addEventListener("click", function () {
			const projectRecordName = document.getElementById("po-record-name").value;
			const savedCentralRouteID = overlayState.centralRouteID; // capture before closeOverlay() resets it
			const savedCentralRouteCreatedBy = overlayState.centralRouteCreatedBy;
			const prefill = {
				route: document.getElementById("po-route").value,
				climbingArea: document.getElementById("po-area").value,
				crag: document.getElementById("po-crag").value,
				difficulty: document.getElementById("po-difficulty").value,
				routeType: document.getElementById("po-routetype").value,
				projectRecordName,
				centralRouteID: savedCentralRouteID,
				centralRouteCreatedBy: savedCentralRouteCreatedBy,
			};
			closeOverlay();
			showAddSendOverlay(prefill);
		});

	document
		.getElementById("btn-add-project")
		.addEventListener("click", showAddProjectOverlay);
}

