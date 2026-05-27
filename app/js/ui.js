// ui.js — Dashboard UI rendering and interaction (modular SDK)

import { db, auth } from "./firebase-config.js";
import { doc, getDoc } from "firebase/firestore";
import {
	fetchClimbs as $fetchClimbs,
	fetchAscents as $fetchAscents,
	saveClimbNote as $saveClimbNote,
	deleteClimbNote as $deleteClimbNote,
	saveAscent as $saveAscent,
	deleteAscent as $deleteAscent,
	fetchPhotos as $fetchPhotos,
	fetchAllClimbAscents as $fetchAllClimbAscents,
	computeStats as $computeStats,
	filterClimbs as $filterClimbs,
} from "./firebase-climbs.js";
import {
	fetchTrainingSessions as $fetchTrainingSessions,
	saveTrainingSession as $saveTrainingSession,
	deleteTrainingSession as $deleteTrainingSession,
	computeTrainingStats as $computeTrainingStats,
	TYPE_EMOJI,
} from "./firebase-training.js";
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
	searchRoutes as $searchRoutes,
	createCentralRoute as $createCentralRoute,
	updateCentralRoute as $updateCentralRoute,
	shouldClearSoftLink as $shouldClearSoftLink,
	checkAdminStatus as $checkAdminStatus,
	getRoute as $getRoute,
	incrementSendCount as $incrementSendCount,
	incrementProjectCount as $incrementProjectCount,
	decrementProjectCount as $decrementProjectCount,
	completedProject as $completedProject,
	reportRating as $reportRating,
	fetchRouteData as $fetchRouteData,
} from "./firebase-routes.js";
import { showAdminView } from "./admin.js";

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
let deleteClimbNote = $deleteClimbNote;
let saveAscent = $saveAscent;
let deleteAscent = $deleteAscent;
let fetchPhotos = $fetchPhotos;
let computeStats = $computeStats;
let filterClimbs = $filterClimbs;
let fetchTrainingSessions = $fetchTrainingSessions;
let saveTrainingSession = $saveTrainingSession;
let deleteTrainingSession = $deleteTrainingSession;
let computeTrainingStats = $computeTrainingStats;
let getCurrentUser = $getCurrentUser;
let deleteAccount = $deleteAccount;
let apiKeysList = $apiKeysList;
let apiKeysCreate = $apiKeysCreate;
let apiKeysRevoke = $apiKeysRevoke;
let searchRoutes = $searchRoutes;
let createCentralRoute = $createCentralRoute;
let updateCentralRoute = $updateCentralRoute;
const shouldClearSoftLink = $shouldClearSoftLink;
let checkAdminStatus = $checkAdminStatus;
const getRoute = $getRoute;
const incrementSendCount = $incrementSendCount;
const incrementProjectCount = $incrementProjectCount;
const decrementProjectCount = $decrementProjectCount;
const completedProject = $completedProject;
const reportRating = $reportRating;
const fetchRouteData = $fetchRouteData;

/**
 * Override service bindings for mock mode.
 * Call this before loadData() when mock=true.
 */
export function setMockServices(mocks) {
	if (mocks.fetchClimbs) fetchClimbs = mocks.fetchClimbs;
	if (mocks.fetchAscents) fetchAscents = mocks.fetchAscents;
	if (mocks.fetchAllClimbAscents)
		fetchAllClimbAscents = mocks.fetchAllClimbAscents;
	if (mocks.saveClimbNote) saveClimbNote = mocks.saveClimbNote;
	if (mocks.deleteClimbNote) deleteClimbNote = mocks.deleteClimbNote;
	if (mocks.saveAscent) saveAscent = mocks.saveAscent;
	if (mocks.deleteAscent) deleteAscent = mocks.deleteAscent;
	if (mocks.fetchPhotos) fetchPhotos = mocks.fetchPhotos;
	if (mocks.computeStats) computeStats = mocks.computeStats;
	if (mocks.filterClimbs) filterClimbs = mocks.filterClimbs;
	if (mocks.fetchTrainingSessions)
		fetchTrainingSessions = mocks.fetchTrainingSessions;
	if (mocks.saveTrainingSession)
		saveTrainingSession = mocks.saveTrainingSession;
	if (mocks.deleteTrainingSession)
		deleteTrainingSession = mocks.deleteTrainingSession;
	if (mocks.computeTrainingStats)
		computeTrainingStats = mocks.computeTrainingStats;
	if (mocks.getCurrentUser) getCurrentUser = mocks.getCurrentUser;
	if (mocks.deleteAccount) deleteAccount = mocks.deleteAccount;
	if (mocks.apiKeysList) apiKeysList = mocks.apiKeysList;
	if (mocks.apiKeysCreate) apiKeysCreate = mocks.apiKeysCreate;
	if (mocks.apiKeysRevoke) apiKeysRevoke = mocks.apiKeysRevoke;
	if (mocks.searchRoutes) searchRoutes = mocks.searchRoutes;
	if (mocks.createCentralRoute) createCentralRoute = mocks.createCentralRoute;
	if (mocks.updateCentralRoute) updateCentralRoute = mocks.updateCentralRoute;
	if (mocks.checkAdminStatus) checkAdminStatus = mocks.checkAdminStatus;
}

// ---------- Module-level state ----------

let _allClimbs = [];
let _currentRefresh = null;
let _currentPage = 1;
let _filteredClimbs = [];
const ITEMS_PER_PAGE = 20;

// Central route soft link state (cleared when overlay closes without selection)
let _centralRouteID = null;
let _centralRouteName = "";
let _centralRouteCrag = "";
let _centralRouteArea = "";
let _centralRouteCreatedBy = null;
let _pendingNewCentralRoute = null;
let _previousReportedRating = 0; // reportedRating when edit overlay was opened
let _originalCentralRouteID = null; // centralRouteID when edit overlay was opened
let _communityRatings = new Map(); // routeID -> communityRating; fetched once per session
let _gpsData = new Map(); // routeID -> {latitude, longitude, country}
/** @type {Map<string, Array>} */
const _ascentCache = new Map(); // noteId -> ascents[]; populated lazily on detail modal open

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

function renderStars(rating) {
	const n = Math.round(rating ?? 0);
	let s = "";
	for (let i = 1; i <= 5; i++) s += i <= n ? "★" : "☆";
	return `<span class="stars">${s}</span>`;
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

	tbody.innerHTML = "";

	if (_filteredClimbs.length === 0) {
		table.style.display = "none";
		empty.style.display = "block";
		renderPagination(0, 0);
		return;
	}

	table.style.display = "";
	empty.style.display = "none";

	const totalPages = Math.ceil(_filteredClimbs.length / ITEMS_PER_PAGE);
	if (_currentPage > totalPages) _currentPage = totalPages;
	const start = (_currentPage - 1) * ITEMS_PER_PAGE;
	const pageClimbs = _filteredClimbs.slice(start, start + ITEMS_PER_PAGE);

	for (const climb of pageClimbs) {
		const gradeClass = gradeBadgeClass(climb.difficulty);
		const sendClass = SEND_CLASSES[climb.sendType] ?? "send-proj";
		const tr = document.createElement("tr");
		tr.style.cursor = "pointer";
		tr.innerHTML = `
      <td><strong>${escapeHtml(climb.route || "—")}</strong>${climb.centralRouteID && _gpsData.has(climb.centralRouteID) ? ' <span title="Route start GPS available" style="font-size:0.8rem">📍</span>' : ""}</td>
      <td>${escapeHtml(climb.climbingArea || "—")}${climb.crag ? ` <small style="color:#64748b">/ ${escapeHtml(climb.crag)}</small>` : ""}</td>
      <td><span class="type-badge">${escapeHtml(climb.routeType || "—")}</span></td>
      <td><span class="badge ${gradeClass}">${escapeHtml(climb.difficulty || "—")}</span></td>
      <td>${formatDate(climb.date)}</td>
      <td><span class="badge ${sendClass}">${escapeHtml(climb.sendType || "—")}</span></td>
      <td>${renderStars(climb.rating)}${
				climb.centralRouteID && _communityRatings.has(climb.centralRouteID)
					? `<small style="color:#94a3b8;margin-left:3px;">(${_communityRatings.get(climb.centralRouteID).toFixed(1)})</small>`
					: ""
			}</td>
    `;
		tr.addEventListener("click", () => showDetailModal(climb));
		tbody.appendChild(tr);
	}

	renderPagination(_filteredClimbs.length, totalPages);
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

function showDetailModal(climb) {
	const overlay = document.getElementById("modal-overlay");
	const content = document.getElementById("modal-content");

	const sendClass = SEND_CLASSES[climb.sendType] ?? "send-proj";

	let html = `
    <div style="display:flex;align-items:baseline;gap:0.5rem;margin-bottom:0.3rem;flex-wrap:wrap">
      <h2 style="margin:0;line-height:1.3">
        ${escapeHtml(climb.route || "—")}
        <span style="font-weight:400;color:inherit">${escapeHtml(climb.difficulty || "—")}</span>
      </h2>
      ${climb.routeType ? `<span style="font-size:0.9rem;color:#64748b;font-weight:500">${escapeHtml(climb.routeType)}</span>` : ""}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${climb.centralRouteID ? "0.4rem" : "1.25rem"}">
      <span style="color:#64748b;font-size:0.95rem">
        ${escapeHtml(climb.climbingArea || "")}${climb.crag ? ` &rsaquo; ${escapeHtml(climb.crag)}` : ""}
      </span>
      <span class="badge ${sendClass}">${escapeHtml(climb.sendType || "—")}</span>
    </div>
    ${
			climb.centralRouteID
				? `<div style="margin-bottom:1rem">
      <span id="detail-central-route-chip" style="
        display:inline-flex;align-items:center;gap:4px;
        font-size:0.75rem;color:#64748b;
        background:#f1f5f9;border-radius:6px;
        padding:2px 8px;">☁ In community database
      </span>
    </div>`
				: ""
		}
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem;margin-bottom:1rem">
      <tr>
        <td style="padding:0.35rem 0;color:#64748b;width:40%">Date</td>
        <td style="padding:0.35rem 0">${formatDate(climb.date)}</td>
      </tr>
      <tr>
        <td style="padding:0.35rem 0;color:#64748b">Rating</td>
        <td style="padding:0.35rem 0">${renderStars(climb.rating)}<span id="detail-community-rating" style="font-size:0.8rem;color:#94a3b8;margin-left:4px;"></span></td>
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
          ${climb.projectStatus ? `<tr><td style="padding:0.3rem 0;color:#64748b;width:40%">Status</td><td>${escapeHtml(climb.projectStatus.charAt(0).toUpperCase() + climb.projectStatus.slice(1))}</td></tr>` : ""}
          ${climb.highPoint ? `<tr><td style="padding:0.3rem 0;color:#64748b">High Point</td><td>${escapeHtml(String(climb.highPoint))}</td></tr>` : ""}
          ${climb.lastAttemptDate ? `<tr><td style="padding:0.3rem 0;color:#64748b">Last Attempt</td><td>${formatDate(climb.lastAttemptDate)}</td></tr>` : ""}
          ${climb.attemptCount ? `<tr><td style="padding:0.3rem 0;color:#64748b">Attempts</td><td>${climb.attemptCount}</td></tr>` : ""}
        </table>
        ${climb.projectNotes ? `<div style="margin-top:0.5rem;font-size:0.9rem;color:#475569;white-space:pre-wrap">${escapeHtml(climb.projectNotes)}</div>` : ""}
      </div>
    `;
	}

	// Ascents placeholder — filled asynchronously from _ascentCache
	html += `<div id="detail-ascents-container"></div>`;

	// Photos section: async-loaded from Firestore sub-collection
	html += `<div id="detail-gps-row"></div>`;
	html += `<div id="modal-photos-container" style="margin-bottom:1rem"></div>`;

	html += `<div style="display:flex;justify-content:flex-end;margin-top:.5rem">
    <button id="detail-edit-btn" class="btn btn-primary btn-sm">Edit Climb</button>
  </div>`;

	content.innerHTML = html;
	overlay.style.display = "flex";
	document.body.style.overflow = "hidden";

	// Async: fetch central route — updates ownership chip and community rating
	if (climb.centralRouteID) {
		getRoute(climb.centralRouteID)
			.then((route) => {
				if (!route) return;
				const chip = document.getElementById("detail-central-route-chip");
				if (chip && route.createdBy === auth.currentUser?.uid) {
					chip.innerHTML =
						'☁ In community database <span title="You created this route">👤</span>';
				}
				const ratingSpan = document.getElementById("detail-community-rating");
				if (ratingSpan && route.communityRating != null) {
					ratingSpan.textContent = `(${route.communityRating.toFixed(1)})`;
				}
				// GPS row — injected after the table when coordinates are available
				if (route.latitude != null && route.longitude != null) {
					const gpsContainer = document.getElementById("detail-gps-row");
					if (gpsContainer) {
						const mapsURL = `https://maps.apple.com/?ll=${route.latitude},${route.longitude}&q=${encodeURIComponent(climb.route || "Route start")}`;
						const flag = route.country
							? String.fromCodePoint(
									...[...route.country.toUpperCase()].map(
										(c) => 0x1f1e6 - 65 + c.charCodeAt(0),
									),
								)
							: "";
						gpsContainer.innerHTML = `
							<div style="margin-bottom:1.25rem;padding:0.75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
								<div style="font-size:0.8rem;color:#64748b;margin-bottom:0.25rem;">📍 Route Start${flag ? " " + flag : ""}</div>
								<div style="font-size:0.85rem;font-family:monospace;margin-bottom:0.4rem;">${route.latitude.toFixed(5)}°, ${route.longitude.toFixed(5)}°</div>
								<a href="${escapeHtml(mapsURL)}" target="_blank" rel="noopener" style="font-size:0.82rem;color:var(--accent-color,#6366f1);">Open in Maps ↗</a>
							</div>`;
					}
				}
			})
			.catch(() => {});
	}

	// Async: lazy-load ascents for the detail modal view
	if (climb.recordName) {
		_getAscentsCached(climb.recordName)
			.then((ascents) => {
				if (ascents.length === 0) return;
				const container = document.getElementById("detail-ascents-container");
				if (!container) return;
				container.innerHTML = `
					<div style="margin-bottom:1.25rem">
						<div style="font-weight:600;margin-bottom:0.5rem">Repeat Ascents</div>
						<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
							${ascents
								.map((a, i) => {
									const d = a.date
										? new Date(a.date).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})
										: "\u2014";
									const border =
										i < ascents.length - 1
											? "border-bottom:1px solid #f1f5f9;"
											: "";
									return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;font-size:0.9rem;${border}">
										<span style="color:#64748b;min-width:90px;font-size:0.82rem">${d}</span>
										<span style="flex:1">${escapeHtml(a.sendType ?? "Redpoint")}</span>
										${a.notes ? `<span style="color:#64748b;font-size:0.85rem;font-style:italic">${escapeHtml(a.notes)}</span>` : ""}
									</div>`;
								})
								.join("")}
						</div>
					</div>`;
			})
			.catch(() => {});
	}

	// Async photo load
	if (climb.recordName && typeof fetchPhotos === "function") {
		fetchPhotos(climb.recordName).then((photos) => {
			const container = document.getElementById("modal-photos-container");
			if (!container || photos.length === 0) return;
			container.innerHTML = `
        <div style="font-weight:600;margin-bottom:0.5rem">Photos</div>
        <div style="display:flex;gap:0.5rem;overflow-x:auto;padding-bottom:0.25rem">
          ${photos
						.map(
							(p) => `
            <a href="${escapeHtml(p.storageURL)}" target="_blank" rel="noopener" style="flex-shrink:0">
              <img src="${escapeHtml(p.storageURL)}" alt="Route photo"
                style="height:120px;width:auto;max-width:160px;object-fit:cover;border-radius:8px;display:block">
            </a>
          `,
						)
						.join("")}
        </div>
      `;
		});
	}

	document.getElementById("detail-edit-btn").addEventListener("click", () => {
		hideDetailModal();
		if (climb.sendType === "Project") {
			showEditProjectOverlay(climb);
		} else {
			showEditSendOverlay(climb);
		}
	});
}

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
			filtered = filtered.filter((c) => !!c.isProject);
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

	// Expose helpers for non-module consumers (stats.js, admin.js)
	window.escapeHtml = escapeHtml;
	window.showConfirmDialog = showConfirmDialog;
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
		"Date,Route,Area,Crag,Grade,Rating,Note,SendType,RouteType,ProjectStatus,AttemptCount,HighPoint,LastAttemptDate,ProjectNotes,AscentType,AscentID,AscentNotes,AscentDate\n";
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
		rows +=
			base +
			"," +
			[
				esc("FirstSend"),
				esc(c.id ?? c.recordName),
				esc(""),
				esc(fmtDate(c.date)),
			].join(",") +
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
		if (
			(_communityRatings.size === 0 || _gpsData.size === 0) &&
			linkedIDs.length > 0
		) {
			fetchRouteData(linkedIDs)
				.then(({ ratings, gps }) => {
					_communityRatings = ratings;
					_gpsData = gps;
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

// ---------- Training view toggle ----------

function showTrainingView() {
	document.getElementById("stats-bar").classList.add("hidden");
	document.querySelector(".table-container").classList.add("hidden");
	document.getElementById("training-view").classList.remove("hidden");
	document.getElementById("account-view")?.classList.add("hidden");
	document.getElementById("stats-view")?.classList.add("hidden");
	document.getElementById("admin-view")?.classList.add("hidden");
	// Sidebar active state
	["view-all", "view-projects", "view-sent", "view-account"].forEach((id) => {
		document.getElementById(id)?.classList.remove("active");
	});
	document.getElementById("view-stats")?.classList.remove("active");
	document.getElementById("view-admin")?.classList.remove("active");
	document.querySelector('[data-view="training"]')?.classList.add("active");
	document.getElementById("btn-log-send")?.classList.add("hidden");
	document.getElementById("btn-add-project")?.classList.add("hidden");
	loadTrainingData();
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
	if (!trainingLoaded) {
		try {
			allSessions = await fetchTrainingSessions();
			window.allSessions = allSessions;
			trainingLoaded = true;
			document.getElementById("badge-sessions").textContent =
				allSessions.length;
		} catch (e) {
			console.warn("Stats: could not load training sessions", e);
		}
	}
	renderStatsPage(window.allClimbs ?? [], allSessions);
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

// ---------- Star rating picker ----------

let currentStarRating = 0;

function setStarRating(value) {
	currentStarRating = value;
	document.querySelectorAll("#so-rating span").forEach((span, i) => {
		span.classList.toggle("filled", i < value);
	});
}

function bindStarPicker() {
	document.querySelectorAll("#so-rating span").forEach((span) => {
		span.addEventListener("click", () =>
			setStarRating(Number(span.dataset.value)),
		);
		span.addEventListener("mouseenter", () => {
			const v = Number(span.dataset.value);
			document.querySelectorAll("#so-rating span").forEach((s, i) => {
				s.classList.toggle("filled", i < v);
			});
		});
		span.addEventListener("mouseleave", () => setStarRating(currentStarRating));
	});
}

function setStylePill(value) {
	const styleMap = {
		Redpoint: "active-rp",
		"On Sight": "active-os",
		"Top Rope": "active-tr",
		"All Free": "active-af",
		Pinkpoint: "active-pk",
	};
	document.querySelectorAll("#so-style-tabs .style-tab").forEach((tab) => {
		tab.className = "style-tab";
		if (tab.dataset.style === value) tab.classList.add(styleMap[value] ?? "");
	});
	const hidden = document.getElementById("so-sendtype");
	if (hidden) hidden.value = value;
}

// ---------- Route search overlay ----------

/** Update a find-route button to linked state, with 👤 if the current user owns the route. */
function setFindRouteLinked(btnId, routeName, createdBy) {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	const isOwned = createdBy && createdBy === auth.currentUser?.uid;
	btn.textContent = isOwned ? "✓ 👤" : "✓";
	btn.title = isOwned
		? `✓ ${routeName} (you created this route)`
		: `✓ ${routeName}`;
	btn.style.color = "var(--success-color, green)";
}

/** Reset a find-route button to unlinked state. */
function setFindRouteUnlinked(btnId) {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	btn.textContent = "🔍";
	btn.title = "Find Route in Database";
	btn.style.color = "";
}

/**
 * Build and inject a route search overlay into the DOM.
 * @param {string} displaySystem - User's grade system ('French'|'YDS'|'UIAA')
 * @param {function} onSelect - called with (route, isNew) when user picks/creates a route
 */
function buildRouteSearchOverlay(displaySystem, onSelect) {
	document.getElementById("route-search-overlay")?.remove();

	const overlay = document.createElement("div");
	overlay.id = "route-search-overlay";
	overlay.className = "modal-overlay active";
	overlay.innerHTML = `
    <div class="modal-content" style="max-width:500px;max-height:80vh;display:flex;flex-direction:column;padding:0;overflow:hidden;">
      <div class="modal-header" style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-color);flex-shrink:0;">
        <h3 class="modal-title">Find Route</h3>
        <button class="modal-close" id="route-search-close">&times;</button>
      </div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
        <input type="text" id="route-search-name" placeholder="Route name…"
               class="form-input" autocomplete="off" />
        <input type="text" id="route-search-crag" placeholder="Crag (search standalone or combine)"
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
		const name = document.getElementById("route-search-name").value.trim();
		const crag = document.getElementById("route-search-crag").value.trim();
		const createBtn = document.getElementById("route-search-create");
		const resultsEl = document.getElementById("route-search-results");

		createBtn.style.display = name.length >= 2 ? "block" : "none";
		createBtn.textContent = `+ Create "${name}"`;

		// Mirror iOS RouteSearchView: trigger as soon as name >= 2 OR crag >= 2
		if (name.length < 2 && crag.length < 2) {
			resultsEl.innerHTML =
				'<p class="text-muted" style="font-size:13px;">Type at least 2 characters in route name or crag to search.</p>';
			return;
		}

		resultsEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:24px 0;color:var(--text-muted,#94a3b8);font-size:13px;">
        <div style="width:16px;height:16px;border:2px solid #e2e8f0;border-top-color:var(--accent-color,#3b82f6);border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div>
        Searching…
      </div>`;

		searchRoutes(name, crag || null, displaySystem, 20)
			.then((routes) => {
				if (!routes.length) {
					resultsEl.innerHTML =
						'<p class="text-muted" style="font-size:13px;">No routes found. Use the button below to create a new one.</p>';
					return;
				}
				const currentUID = auth.currentUser?.uid ?? null;
				resultsEl.innerHTML = routes
					.map(
						(r) => `
        <div class="route-search-result" data-id="${r.id}" style="
          padding:10px 8px;border-bottom:1px solid var(--border-color);cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${escapeHtml(r.name)}${r.createdBy === currentUID ? ' <span title="You created this route" style="font-size:11px;">👤</span>' : ""}</strong>
            <span style="color:var(--accent-color);font-weight:600;">${escapeHtml(r.displayGrade)}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            ${escapeHtml(r.crag)}${r.climbingArea ? " · " + escapeHtml(r.climbingArea) : ""} · ${escapeHtml(r.routeType)}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            ✓ ${r.sendCount} sends · ${r.projectCount} projecting${r.communityRating != null ? ` · ★ ${r.communityRating.toFixed(1)}` : ""}${r.latitude != null ? " · 📍" : ""}
          </div>
        </div>
      `,
					)
					.join("");

				resultsEl.querySelectorAll(".route-search-result").forEach((el) => {
					el.addEventListener("click", () => {
						const route = routes.find((r) => r.id === el.dataset.id);
						if (route) {
							onSelect(route, false);
							overlay.remove();
						}
					});
				});
			})
			.catch((err) => {
				console.error("Route search error:", err);
				resultsEl.innerHTML =
					'<p style="color:red;font-size:13px;">Search failed. Check your connection.</p>';
			});
	}

	["route-search-name", "route-search-crag"].forEach((id) => {
		document.getElementById(id).addEventListener("input", () => {
			clearTimeout(searchTimer);
			searchTimer = setTimeout(doSearch, 300);
		});
	});

	document
		.getElementById("route-search-create")
		.addEventListener("click", () => {
			const name = document.getElementById("route-search-name").value.trim();
			const crag = document.getElementById("route-search-crag").value.trim();

			const resultsEl = document.getElementById("route-search-results");
			const existingItems = resultsEl.querySelectorAll(".route-search-result");
			const hasDupes = [...existingItems].some((el) => {
				const nameEl = el.querySelector("strong");
				return (
					nameEl && nameEl.textContent.toLowerCase() === name.toLowerCase()
				);
			});

			const proceed = () => {
				const newRoute = {
					id: null,
					name,
					climbingArea: "",
					crag,
					grade: "",
					displayGrade: "",
					routeType: "Sport",
					isNew: true,
				};
				onSelect(newRoute, true);
				overlay.remove();
			};

			if (hasDupes) {
				// Mirror iOS RouteSearchView: show a proper modal instead of a browser confirm()
				showConfirmDialog(
					"Route Already Exists?",
					`Similar routes were found at this crag. Create \u201c${name}\u201d as a new entry anyway?`,
				).then((ok) => {
					if (ok) proceed();
				});
			} else {
				proceed();
			}
		});

	document
		.getElementById("route-search-close")
		.addEventListener("click", () => overlay.remove());
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove();
	});

	setTimeout(() => document.getElementById("route-search-name")?.focus(), 50);
}

// ---------- Send overlay ----------

function showAddSendOverlay(prefill = {}) {
	const overlay = document.getElementById("send-overlay");
	document.getElementById("send-overlay-title").textContent = "Log Send";
	document.getElementById("so-record-name").value = "";
	document.getElementById("so-route").value = prefill.route ?? "";
	document.getElementById("so-area").value = prefill.climbingArea ?? "";
	document.getElementById("so-crag").value = prefill.crag ?? "";
	initGradePicker(
		document.getElementById("so-difficulty"),
		prefill.difficulty ?? null,
	);
	document.getElementById("so-routetype").value = prefill.routeType ?? "Sport";
	document.getElementById("so-date").value = new Date()
		.toISOString()
		.slice(0, 10);
	document.getElementById("so-notes").value = "";
	setStarRating(0);
	setStylePill("Redpoint");
	document.getElementById("so-ascents-section").classList.add("hidden");
	document.getElementById("so-ascent-form").classList.add("hidden");
	document.getElementById("so-ascent-toggle").textContent = "+ Add";
	document.getElementById("send-overlay-delete").classList.add("hidden");
	document.getElementById("so-route-error").classList.add("hidden");
	document.getElementById("so-route").classList.remove("error");
	overlay.dataset.projectRecordName = prefill.projectRecordName ?? "";

	// Restore soft link if coming from a linked project (mark-as-sent flow)
	if (prefill.centralRouteID) {
		_centralRouteID = prefill.centralRouteID;
		_centralRouteName = prefill.route || "";
		_centralRouteCrag = prefill.crag || "";
		_centralRouteArea = prefill.climbingArea || "";
		_centralRouteCreatedBy = prefill.centralRouteCreatedBy ?? null;
		setFindRouteLinked(
			"find-route-btn-send",
			prefill.route,
			_centralRouteCreatedBy,
		);
	}

	overlay.classList.remove("hidden");
}

function showEditSendOverlay(climb) {
	showAddSendOverlay();
	document.getElementById("send-overlay-title").textContent = "Edit Send";
	document.getElementById("so-record-name").value = climb.recordName ?? "";
	document.getElementById("so-route").value = climb.route ?? "";
	document.getElementById("so-area").value = climb.climbingArea ?? "";
	document.getElementById("so-crag").value = climb.crag ?? "";
	initGradePicker(
		document.getElementById("so-difficulty"),
		climb.difficulty ?? null,
	);
	document.getElementById("so-routetype").value = climb.routeType ?? "Sport";
	document.getElementById("so-date").value = climb.date
		? climb.date.toISOString().slice(0, 10)
		: "";
	document.getElementById("so-notes").value = climb.noteText ?? "";
	setStarRating(climb.rating ?? 0);
	setStylePill(climb.sendType ?? "Redpoint");
	document.getElementById("so-ascents-section").classList.remove("hidden");
	document.getElementById("send-overlay-delete").classList.remove("hidden");
	renderAscentsList(climb);

	_previousReportedRating = climb.reportedRating ?? 0;
	_originalCentralRouteID = climb.centralRouteID ?? null;

	if (climb.centralRouteID) {
		_centralRouteID = climb.centralRouteID;
		_centralRouteName = climb.route || "";
		_centralRouteCrag = climb.crag || "";
		_centralRouteArea = climb.climbingArea || "";
		_centralRouteCreatedBy = null;
		setFindRouteLinked("find-route-btn-send", climb.route, null);
		// Fetch createdBy asynchronously to update ownership icon
		getDoc(doc(db, "routes", climb.centralRouteID))
			.then((routeSnap) => {
				if (routeSnap.exists()) {
					_centralRouteCreatedBy = routeSnap.data().createdBy ?? null;
					setFindRouteLinked(
						"find-route-btn-send",
						climb.route,
						_centralRouteCreatedBy,
					);
				}
			})
			.catch(() => {});
	}
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
	document.getElementById("po-last-attempt-date").value = "";
	document.getElementById("po-highpoint").value = "";
	document.getElementById("po-status").value = "active";
	document.getElementById("po-notes").value = "";
	document.getElementById("po-mark-sent-section").classList.add("hidden");
	document.getElementById("project-overlay-delete").classList.add("hidden");
	document.getElementById("po-route-error").classList.add("hidden");
	document.getElementById("po-route").classList.remove("error");
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
	document.getElementById("po-last-attempt-date").value = climb.lastAttemptDate
		? climb.lastAttemptDate.toISOString().slice(0, 10)
		: "";
	document.getElementById("po-highpoint").value = climb.highPoint ?? "";
	document.getElementById("po-status").value = climb.projectStatus ?? "active";
	document.getElementById("po-notes").value = climb.noteText ?? "";
	document.getElementById("po-mark-sent-section").classList.remove("hidden");
	document.getElementById("project-overlay-delete").classList.remove("hidden");

	if (climb.centralRouteID) {
		_centralRouteID = climb.centralRouteID;
		_centralRouteName = climb.route || "";
		_centralRouteCrag = climb.crag || "";
		_centralRouteArea = climb.climbingArea || "";
		_centralRouteCreatedBy = null;
		setFindRouteLinked("find-route-btn-project", climb.route, null);
		getDoc(doc(db, "routes", climb.centralRouteID))
			.then((routeSnap) => {
				if (routeSnap.exists()) {
					_centralRouteCreatedBy = routeSnap.data().createdBy ?? null;
					setFindRouteLinked(
						"find-route-btn-project",
						climb.route,
						_centralRouteCreatedBy,
					);
				}
			})
			.catch(() => {});
	}
}

// ── Overlay shared helpers ──────────────────────────────────────────────────

/**
 * Shared setup for Send and Project overlays.
 * Wires close/cancel/backdrop, the "find route" button, and soft-link clearing.
 * Returns a closeOverlay() function for use in save/delete handlers.
 */
function bindOverlayCommon({ overlayId, fieldPrefix: p, findRouteBtnId }) {
	function closeOverlay() {
		document.getElementById(overlayId).classList.add("hidden");
		_centralRouteID = null;
		_centralRouteName = "";
		_centralRouteCrag = "";
		_centralRouteArea = "";
		_centralRouteCreatedBy = null;
		_pendingNewCentralRoute = null;
		_previousReportedRating = 0;
		_originalCentralRouteID = null;
		setFindRouteUnlinked(findRouteBtnId);
	}

	document
		.getElementById(`${overlayId}-close`)
		.addEventListener("click", closeOverlay);
	document
		.getElementById(`${overlayId}-cancel`)
		.addEventListener("click", closeOverlay);
	document.getElementById(overlayId).addEventListener("click", (e) => {
		if (e.target === e.currentTarget) closeOverlay();
	});

	document.getElementById(findRouteBtnId).addEventListener("click", () => {
		buildRouteSearchOverlay(getPreferredGradeSystem(), (route, isNew) => {
			document.getElementById(`${p}-route`).value = route.name || "";
			document.getElementById(`${p}-area`).value = route.climbingArea || "";
			document.getElementById(`${p}-crag`).value = route.crag || "";
			if (route.displayGrade)
				initGradePicker(
					document.getElementById(`${p}-difficulty`),
					route.displayGrade,
				);
			if (route.routeType)
				document.getElementById(`${p}-routetype`).value = route.routeType;
			_centralRouteID = route.id;
			_centralRouteName = route.name || "";
			_centralRouteCrag = route.crag || "";
			_centralRouteArea = route.climbingArea || "";
			_centralRouteCreatedBy = route.createdBy ?? null;
			if (isNew) {
				_pendingNewCentralRoute = route;
				_centralRouteID = null;
				_centralRouteCreatedBy = null;
			}
			setFindRouteLinked(findRouteBtnId, route.name, _centralRouteCreatedBy);
		});
	});

	[`${p}-route`, `${p}-crag`, `${p}-area`].forEach((fieldId) => {
		document.getElementById(fieldId)?.addEventListener("input", () => {
			const isOwner =
				_centralRouteCreatedBy &&
				_centralRouteCreatedBy === auth.currentUser?.uid;
			if (
				_centralRouteID &&
				!isOwner &&
				shouldClearSoftLink(
					{
						name: _centralRouteName,
						crag: _centralRouteCrag,
						area: _centralRouteArea,
					},
					{
						name: document.getElementById(`${p}-route`).value,
						crag: document.getElementById(`${p}-crag`).value,
						area: document.getElementById(`${p}-area`).value,
					},
				)
			) {
				_centralRouteID = null;
				setFindRouteUnlinked(findRouteBtnId);
			}
		});
	});

	return closeOverlay;
}

/** Binds the delete button for Send or Project overlays. */
function bindOverlayDeleteHandler({
	deleteBtnId,
	recordFieldId,
	routeFieldId,
	label,
	closeOverlay,
}) {
	document
		.getElementById(deleteBtnId)
		.addEventListener("click", async function () {
			const recordName = document.getElementById(recordFieldId).value;
			const name = document.getElementById(routeFieldId).value;
			const confirmed = await showConfirmDialog(
				`Delete ${label}?`,
				`"${name}" will be permanently deleted.`,
			);
			if (!confirmed) return;
			try {
				await deleteClimbNote(recordName);
				closeOverlay();
				await loadData();
			} catch (err) {
				alert("Delete failed: " + (err.message ?? err));
			}
		});
}

/**
 * Creates a central route if _pendingNewCentralRoute is set.
 * Returns the resolved centralID (may be unchanged if no pending route).
 */
async function _maybeCreateCentralRoute(fieldPrefix, routeVal) {
	if (!_pendingNewCentralRoute) return _centralRouteID;
	const p = fieldPrefix;
	let centralID = _centralRouteID;
	try {
		centralID = await createCentralRoute({
			name: routeVal,
			climbingArea: document.getElementById(`${p}-area`).value.trim() || "",
			crag: document.getElementById(`${p}-crag`).value.trim() || "",
			grade: document.getElementById(`${p}-difficulty`).value || "",
			gradeSystem: getPreferredGradeSystem(),
			routeType: document.getElementById(`${p}-routetype`).value,
		});
		_centralRouteID = centralID;
	} catch (err) {
		console.warn("Failed to create central route:", err);
		// Don't block save if central route creation fails
	}
	_pendingNewCentralRoute = null;
	return centralID;
}

/** Propagates overlay field edits back to central route if the current user is the creator. */
function _maybePropagateToRoute(centralID, fieldPrefix, routeVal) {
	if (!centralID || _centralRouteCreatedBy !== auth.currentUser?.uid) return;
	const p = fieldPrefix;
	updateCentralRoute(centralID, {
		name: routeVal,
		climbingArea: document.getElementById(`${p}-area`).value.trim() || "",
		crag: document.getElementById(`${p}-crag`).value.trim() || "",
		grade: document.getElementById(`${p}-difficulty`).value || "",
		gradeSystem: getPreferredGradeSystem(),
		routeType: document.getElementById(`${p}-routetype`).value,
	});
}

function bindSendOverlayHandlers() {
	const closeOverlay = bindOverlayCommon({
		overlayId: "send-overlay",
		fieldPrefix: "so",
		findRouteBtnId: "find-route-btn-send",
	});

	document.querySelectorAll("#so-style-tabs .style-tab").forEach((tab) => {
		tab.addEventListener("click", () => setStylePill(tab.dataset.style));
	});

	document
		.getElementById("send-overlay-save")
		.addEventListener("click", async function () {
			const routeVal = document.getElementById("so-route").value.trim();
			if (!routeVal) {
				document.getElementById("so-route").classList.add("error");
				document.getElementById("so-route-error").classList.remove("hidden");
				return;
			}
			document.getElementById("so-route").classList.remove("error");
			document.getElementById("so-route-error").classList.add("hidden");

			const btn = this;
			btn.disabled = true;
			btn.textContent = "Saving\u2026";
			try {
				const recordName =
					document.getElementById("so-record-name").value || undefined;
				const projectRecordName =
					document.getElementById("send-overlay").dataset.projectRecordName;

				const centralID = await _maybeCreateCentralRoute("so", routeVal);

				await saveClimbNote({
					recordName,
					id: recordName ? undefined : crypto.randomUUID().toUpperCase(),
					route: routeVal,
					climbingArea: document.getElementById("so-area").value.trim() || null,
					crag: document.getElementById("so-crag").value.trim() || null,
					difficulty: document.getElementById("so-difficulty").value || null,
					date: document.getElementById("so-date").value
						? new Date(document.getElementById("so-date").value)
						: null,
					sendType: document.getElementById("so-sendtype").value,
					routeType: document.getElementById("so-routetype").value,
					rating: currentStarRating,
					reportedRating:
						centralID && currentStarRating > 0 ? currentStarRating : 0,
					noteText: document.getElementById("so-notes").value.trim() || null,
					centralRouteID: centralID ?? null,
				});

				// Community rating — new sends (previousRating = 0) handled in block above;
				// edits use delta logic based on link state
				if (recordName) {
					const sameRoute = centralID && centralID === _originalCentralRouteID;
					const linkCleared = !centralID && Boolean(_originalCentralRouteID);
					const newLink = Boolean(centralID) && !sameRoute;

					if (sameRoute) {
						reportRating(centralID, currentStarRating, _previousReportedRating);
					} else if (linkCleared) {
						if (_previousReportedRating > 0) {
							reportRating(_originalCentralRouteID, 0, _previousReportedRating);
						}
					} else if (newLink) {
						if (_originalCentralRouteID && _previousReportedRating > 0) {
							reportRating(_originalCentralRouteID, 0, _previousReportedRating);
						}
						reportRating(centralID, currentStarRating, 0);
					}
				}

				_maybePropagateToRoute(centralID, "so", routeVal);

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
						console.error("Mark as Sent: project delete failed", delErr);
						alert(
							"Send saved, but the original project could not be deleted \u2014 please delete it manually.",
						);
					}
				}

				closeOverlay();
				await loadData();
			} catch (err) {
				console.error("Save send failed:", err);
				alert("Save failed: " + (err.message ?? err));
			} finally {
				btn.disabled = false;
				btn.textContent = "Save Send";
			}
		});

	bindOverlayDeleteHandler({
		deleteBtnId: "send-overlay-delete",
		recordFieldId: "so-record-name",
		routeFieldId: "so-route",
		label: "Send",
		closeOverlay,
	});

	document
		.getElementById("so-ascent-toggle")
		.addEventListener("click", function () {
			const form = document.getElementById("so-ascent-form");
			const isHidden = form.classList.toggle("hidden");
			this.textContent = isHidden ? "+ Add" : "\u2715";
		});

	document
		.getElementById("so-ascent-add")
		.addEventListener("click", async function () {
			const climbRecordName = document.getElementById("so-record-name").value;
			if (!climbRecordName) return;
			const dateVal = document.getElementById("so-ascent-date").value;
			const typeVal = document.getElementById("so-ascent-type").value;
			const notesVal = document.getElementById("so-ascent-notes").value.trim();
			try {
				await saveAscent({
					id: crypto.randomUUID(),
					date: dateVal ? new Date(dateVal) : new Date(),
					sendType: typeVal,
					notes: notesVal || null,
					climbNoteRecordName: climbRecordName,
				});
				document.getElementById("so-ascent-date").value = "";
				document.getElementById("so-ascent-notes").value = "";
				document.getElementById("so-ascent-form").classList.add("hidden");
				document.getElementById("so-ascent-toggle").textContent = "+ Add";
				_ascentCache.delete(climbRecordName); // invalidate so renderAscentsList re-fetches
				await loadData();
				await renderAscentsList({ recordName: climbRecordName });
			} catch (err) {
				alert("Add ascent failed: " + (err.message ?? err));
			}
		});

	document
		.getElementById("btn-log-send")
		.addEventListener("click", showAddSendOverlay);
	bindStarPicker();
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
				const lastAttemptVal = document.getElementById(
					"po-last-attempt-date",
				).value;

				const centralID = await _maybeCreateCentralRoute("po", routeVal);

				await saveClimbNote({
					recordName,
					id: recordName ? undefined : crypto.randomUUID().toUpperCase(),
					route: routeVal,
					climbingArea: document.getElementById("po-area").value.trim() || null,
					crag: document.getElementById("po-crag").value.trim() || null,
					difficulty: document.getElementById("po-difficulty").value || null,
					sendType: "Project",
					routeType: document.getElementById("po-routetype").value,
					attemptCount:
						Number(document.getElementById("po-attempts").value) || 0,
					lastAttemptDate: lastAttemptVal ? new Date(lastAttemptVal) : null,
					highPoint:
						document.getElementById("po-highpoint").value.trim() || null,
					projectStatus: document.getElementById("po-status").value,
					noteText: document.getElementById("po-notes").value.trim() || null,
					centralRouteID: centralID ?? null,
					reportedRating: 0, // projects never contribute to community rating
				});

				// Community rating — retract if a previously linked send had reported a rating
				// (can happen when converting a send to a project via edit)
				if (_previousReportedRating > 0 && _originalCentralRouteID) {
					reportRating(_originalCentralRouteID, 0, _previousReportedRating);
				}

				_maybePropagateToRoute(centralID, "po", routeVal);

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
			const savedCentralRouteID = _centralRouteID; // capture before closeOverlay() resets it
			const savedCentralRouteCreatedBy = _centralRouteCreatedBy;
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

// ---------- Training overlay ----------

function setIntensity(value) {
	document.querySelectorAll(".intensity-btn").forEach((btn) => {
		btn.classList.toggle("active", Number(btn.dataset.value) <= value);
	});
}

function showTrainingDetailModal(session) {
	const overlay = document.getElementById("modal-overlay");
	const content = document.getElementById("modal-content");

	const dateStr = session.date
		? session.date.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "—";
	const durationStr = session.duration ? `${session.duration} min` : "—";
	const intensityDots = [1, 2, 3, 4, 5]
		.map(
			(i) =>
				`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i <= (session.intensity ?? 3) ? "#0f172a" : "#e2e8f0"};margin-right:3px"></span>`,
		)
		.join("");

	let html = `
    <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <h2 style="margin:0;line-height:1.3">${escapeHtml(session.type ?? "Training")}</h2>
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
	overlay.style.display = "flex";
	document.body.style.overflow = "hidden";

	document
		.getElementById("training-detail-edit-btn")
		.addEventListener("click", () => {
			hideDetailModal();
			showEditTrainingOverlay(session);
		});
}

function showAddTrainingOverlay() {
	const overlay = document.getElementById("training-overlay");
	document.getElementById("training-overlay-title").textContent = "Log Session";
	document.getElementById("to-record-name").value = "";
	document.getElementById("to-type").value = "Hangboard";
	document.getElementById("to-date").value = new Date()
		.toISOString()
		.slice(0, 10);
	document.getElementById("to-duration").value = "60";
	document.getElementById("to-notes").value = "";
	setIntensity(3);
	document.getElementById("training-overlay-delete").classList.add("hidden");
	overlay.classList.remove("hidden");
}

function showEditTrainingOverlay(session) {
	showAddTrainingOverlay();
	document.getElementById("training-overlay-title").textContent =
		"Edit Session";
	document.getElementById("to-record-name").value = session.recordName ?? "";
	document.getElementById("to-type").value = session.type ?? "Gym Session";
	document.getElementById("to-date").value = session.date
		? session.date.toISOString().slice(0, 10)
		: "";
	document.getElementById("to-duration").value = session.duration ?? 60;
	document.getElementById("to-notes").value = session.notes ?? "";
	setIntensity(session.intensity ?? 3);
	document.getElementById("training-overlay-delete").classList.remove("hidden");
}

function bindTrainingOverlayHandlers() {
	function closeOverlay() {
		document.getElementById("training-overlay").classList.add("hidden");
	}
	document
		.getElementById("training-overlay-close")
		.addEventListener("click", closeOverlay);
	document
		.getElementById("training-overlay-cancel")
		.addEventListener("click", closeOverlay);
	document.getElementById("training-overlay").addEventListener("click", (e) => {
		if (e.target === e.currentTarget) closeOverlay();
	});

	document.querySelectorAll(".intensity-btn").forEach((btn) => {
		btn.addEventListener("click", () =>
			setIntensity(Number(btn.dataset.value)),
		);
	});

	document
		.getElementById("training-overlay-save")
		.addEventListener("click", async function () {
			const btn = this;
			btn.disabled = true;
			btn.textContent = "Saving…";
			try {
				const recordName =
					document.getElementById("to-record-name").value || undefined;
				const dateVal = document.getElementById("to-date").value;
				const activeIntensityBtns = document.querySelectorAll(
					".intensity-btn.active",
				);
				const activeIntensityBtn = activeIntensityBtns.length
					? activeIntensityBtns[activeIntensityBtns.length - 1]
					: null;
				await saveTrainingSession({
					recordName,
					id: recordName ? undefined : crypto.randomUUID(),
					type: document.getElementById("to-type").value,
					date: dateVal ? new Date(dateVal) : new Date(),
					duration: Number(document.getElementById("to-duration").value),
					intensity: activeIntensityBtn
						? Number(activeIntensityBtn.dataset.value)
						: 3,
					notes: document.getElementById("to-notes").value.trim() || null,
				});
				closeOverlay();
				trainingLoaded = false;
				await loadTrainingData();
			} catch (err) {
				alert("Save failed: " + (err.message ?? err));
			} finally {
				btn.disabled = false;
				btn.textContent = "Save Session";
			}
		});

	document
		.getElementById("training-overlay-delete")
		.addEventListener("click", async function () {
			const recordName = document.getElementById("to-record-name").value;
			const type = document.getElementById("to-type").value;
			const confirmed = await showConfirmDialog(
				"Delete Session?",
				`This ${type} session will be permanently deleted.`,
			);
			if (!confirmed) return;
			try {
				await deleteTrainingSession(recordName);
				document.getElementById("training-overlay").classList.add("hidden");
				trainingLoaded = false;
				await loadTrainingData();
			} catch (err) {
				alert("Delete failed: " + (err.message ?? err));
			}
		});

	document
		.getElementById("btn-log-session")
		.addEventListener("click", showAddTrainingOverlay);

	document.getElementById("training-list").addEventListener("click", (e) => {
		const row = e.target.closest(".session-row");
		if (!row) return;
		const session = allSessions.find(
			(s) => s.recordName === row.dataset.record,
		);
		if (session) showTrainingDetailModal(session);
	});
}

// ---------- Training data + rendering ----------

let allSessions = [];
let trainingPeriod = "allTime";
let trainingLoaded = false;

async function loadTrainingData() {
	if (trainingLoaded) {
		renderTrainingPage(allSessions, trainingPeriod);
		return;
	}
	trainingLoaded = true;
	allSessions = await fetchTrainingSessions();
	window.allSessions = allSessions;
	document.getElementById("badge-sessions").textContent = allSessions.length;
	renderTrainingPage(allSessions, trainingPeriod);
}

function renderTrainingPage(sessions, period) {
	const stats = computeTrainingStats(sessions, period);

	document.getElementById("ts-total").textContent = stats.totalSessions;
	document.getElementById("ts-time").textContent = stats.formattedTotalTime(
		stats.totalMinutes,
	);
	document.getElementById("ts-days").textContent = stats.trainingDays;
	document.getElementById("ts-avg").textContent = stats.avgPerWeek.toFixed(1);

	const listEl = document.getElementById("training-list");
	const filtered = sessions.filter((s) => {
		if (period === "allTime") return true;
		const now = new Date();
		if (!s.date) return false;
		if (period === "week") {
			const w = new Date(now);
			w.setDate(now.getDate() - 7);
			return s.date >= w;
		}
		if (period === "month")
			return (
				s.date.getFullYear() === now.getFullYear() &&
				s.date.getMonth() === now.getMonth()
			);
		if (period === "year") return s.date.getFullYear() === now.getFullYear();
		return true;
	});
	listEl.innerHTML =
		filtered
			.map((s) => {
				const emoji = TYPE_EMOJI[s.type] || "🏋️";
				const dateStr = s.date
					? s.date.toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
							year: "numeric",
						})
					: "—";
				const dots = [1, 2, 3, 4, 5]
					.map(
						(i) =>
							`<div class="intensity-dot${i <= (s.intensity ?? 0) ? " filled" : ""}"></div>`,
					)
					.join("");
				return `<div class="session-row" data-record="${escapeHtml(s.recordName)}">
      <div class="type-icon">${emoji}</div>
      <div class="session-info">
        <div class="session-type">${escapeHtml(s.type)}</div>
        <div class="session-meta">${dateStr}${s.notes ? " · " + escapeHtml(s.notes.slice(0, 40)) + (s.notes.length > 40 ? "…" : "") : ""}</div>
      </div>
      <div class="session-right">
        <div class="intensity-dots">${dots}</div>
        <div class="session-duration">${s.duration} min</div>
      </div>
    </div>`;
			})
			.join("") ||
		'<p style="color:#94a3b8;font-size:.875rem;padding:.5rem 0">No sessions in this period.</p>';
}

// ---------- Period tabs ----------

function bindPeriodTabs() {
	document
		.getElementById("training-period-tabs")
		.addEventListener("click", (e) => {
			const btn = e.target.closest("[data-period]");
			if (!btn) return;
			trainingPeriod = btn.dataset.period;
			document
				.querySelectorAll("#training-period-tabs button")
				.forEach((b) => b.classList.toggle("active", b === btn));
			renderTrainingPage(allSessions, trainingPeriod);
		});
}

// ---------- Ascent list ----------

async function renderAscentsList(climb) {
	const container = document.getElementById("so-ascents-list");
	const ascents = await _getAscentsCached(climb.recordName);
	container.innerHTML = ascents
		.map((a) => {
			const d = a.date
				? new Date(a.date).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					})
				: "\u2014";
			return `<div class="ascent-row">
      <span class="ascent-date">${d}</span>
      <span class="ascent-type">${escapeHtml(a.sendType ?? "Redpoint")}</span>
      ${a.notes ? `<span class="ascent-notes">${escapeHtml(a.notes)}</span>` : '<span class="ascent-notes"></span>'}
      <button class="ascent-delete" data-record="${escapeHtml(a.recordName)}" title="Delete ascent">✕</button>
    </div>`;
		})
		.join("");

	container.querySelectorAll(".ascent-delete").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const confirmed = await showConfirmDialog(
				"Delete Ascent?",
				"This ascent record will be removed.",
			);
			if (!confirmed) return;
			await deleteAscent(btn.dataset.record);
			_ascentCache.delete(climb.recordName); // invalidate so next open re-fetches
			await renderAscentsList(climb);
		});
	});
}

/**
 * Returns cached ascents for a note, fetching from Firestore on first access.
 */
async function _getAscentsCached(noteId) {
	if (!noteId) return [];
	if (_ascentCache.has(noteId)) return _ascentCache.get(noteId);
	const ascents = await fetchAscents(noteId);
	_ascentCache.set(noteId, ascents);
	return ascents;
}
