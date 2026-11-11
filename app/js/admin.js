// admin.js — Admin panel for central route database moderation (modular SDK)
// Depends on: firebase-config.js, firebase-routes.js
// Depends on: escapeHtml, showConfirmDialog (exposed on window by ui.js)
// Depends on: getPreferredGradeSystem (global from grades.js)

"use strict";

import { getCountFromServer } from "firebase/firestore";
import { db, auth } from "./firebase-config.js";
import { COUNTRY_NONE } from "./admin-routes-browser.js";
import { isoCountryOptionsHTML, countryFlagEmoji, isoCountryName } from "./iso-countries.js";
import { reverseGeocodeCountry } from "./reverse-geocode.js";
import { WEB_APP_VERSION } from "./firebase-auth.js";
import {
	adminQueryRoutes,
	routeQueryStreamKeys,
	adminScanCountryTargets,
	adminApplyCountryToTargets,
	adminBackfillAreaSearch,
	adminSaveRoute,
	adminDeleteRoute,
	adminSetGPS,
	adminClearGPS,
	getRoute,
	convertFromFrench,
	collection,
	collectionGroup,
	query,
	where,
	getDocs,
	orderBy,
	limit,
} from "./firebase-routes.js";

// ── Shim: ui.js globals (set on window after ui.js loads; safe to call at runtime) ──
const escapeHtml = (...a) => window.escapeHtml(...a);
const showConfirmDialog = (...a) => window.showConfirmDialog(...a);
const getPreferredGradeSystem = () =>
	window.getPreferredGradeSystem?.() ?? "French";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(date) {
	if (!date) return "—";
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function uidShort(uid) {
	if (!uid) return "—";
	return uid.length > 12 ? uid.slice(0, 6) + "…" + uid.slice(-4) : uid;
}

// ── Admin view entry point ─────────────────────────────────────────────────

export async function showAdminView() {
	document.getElementById("stats-bar").classList.add("hidden");
	document.querySelector(".table-container").classList.add("hidden");
	document.getElementById("training-view").classList.add("hidden");
	document.getElementById("account-view")?.classList.add("hidden");
	document.getElementById("stats-view")?.classList.add("hidden");
	document.getElementById("admin-view").classList.remove("hidden");

	["view-all", "view-projects", "view-sent"].forEach((id) => {
		document.getElementById(id)?.classList.remove("active");
	});
	document.getElementById("view-stats")?.classList.remove("active");
	document.querySelector('[data-view="training"]')?.classList.remove("active");
	document.getElementById("view-admin")?.classList.add("active");
	document.getElementById("btn-log-send")?.classList.add("hidden");
	document.getElementById("btn-add-project")?.classList.add("hidden");

	renderAdminShell("stats");
}

// ── Shell with tabs ────────────────────────────────────────────────────────

function renderAdminShell(activeTab) {
	const view = document.getElementById("admin-view");
	view.innerHTML = `
    <div class="ad-shell">
      <h2 class="ad-title">Admin Panel</h2>
      <div class="ad-tabs">
        <button class="admin-tab ${activeTab === "stats" ? "admin-tab-active" : ""}" data-tab="stats">
          📊 Statistics
        </button>
        <button class="admin-tab ${activeTab === "routes" ? "admin-tab-active" : ""}" data-tab="routes">
          🔍 Routes
        </button>
      </div>
      <div id="admin-tab-content"></div>
    </div>
  `;

	document.querySelectorAll(".admin-tab").forEach((btn) => {
		btn.addEventListener("click", () => {
			const tab = btn.dataset.tab;
			renderAdminShell(tab);
			if (tab === "stats") loadAndRenderAdminStats();
			if (tab === "routes") renderAdminSearch();
		});
	});

	if (activeTab === "stats") loadAndRenderAdminStats();
	if (activeTab === "routes") renderAdminSearch();
}

// ── Statistics ─────────────────────────────────────────────────────────────

async function loadAndRenderAdminStats() {
	const el = document.getElementById("admin-tab-content");
	if (!el) return;
	el.innerHTML = '<p class="ad-loading">Loading…</p>';

	try {
		const [totalSnap, activeSnap, orphanedSnap, usersSnap, apiKeysSnap, userDocsSnap] =
			await Promise.all([
				getCountFromServer(collection(db, "routes")),
				getCountFromServer(
					query(collection(db, "routes"), where("isOrphaned", "==", false)),
				),
				getCountFromServer(
					query(collection(db, "routes"), where("isOrphaned", "==", true)),
				),
				getCountFromServer(collection(db, "users")),
				getDocs(collectionGroup(db, "apiKeys")),
				// full user docs for the lastSeen version distribution (small collection)
				getDocs(collection(db, "users")),
			]);

		const totalRoutes = totalSnap.data().count;
		const activeRoutes = activeSnap.data().count;
		const orphanedRoutes = orphanedSnap.data().count;
		const totalUsers = usersSnap.data().count;
		const totalKeys = apiKeysSnap.size;
		const usersWithKeys = new Set(
			apiKeysSnap.docs.map((d) => d.ref.parent.parent.id),
		).size;

		el.innerHTML = `
      <div class="ad-stat-grid">
        ${adminStatCard("Community Routes", totalRoutes)}
        ${adminStatCard("Active Routes", activeRoutes)}
        ${adminStatCard("Orphaned Routes", orphanedRoutes, orphanedRoutes > 0 ? "warn" : null)}
        ${adminStatCard("Registered Users", totalUsers)}
        ${adminStatCard("API Keys Issued", totalKeys)}
        ${adminStatCard("Users with API Keys", usersWithKeys)}
      </div>
      ${renderAdminLastSeenVersions(userDocsSnap)}
      <p class="ad-refresh-row">
        <button id="admin-stats-refresh" class="ad-refresh-btn">↻ Refresh</button>
      </p>
    `;

		document
			.getElementById("admin-stats-refresh")
			?.addEventListener("click", loadAndRenderAdminStats);
	} catch (err) {
		console.error("Admin stats failed:", err);
		el.innerHTML = `<p class="ad-error">✗ Failed to load stats: ${escapeHtml(err.message ?? err)}</p>`;
	}
}

/**
 * Version distribution from the users/{uid} presence stamps (lastSeen…
 * AppVersion, see the analytics plan). Rendered as a small two-column table;
 * counts users per last-seen version per platform ("—" = never seen).
 */
function renderAdminLastSeenVersions(userDocsSnap) {
	const iosCounts = new Map();
	const webCounts = new Map();
	let iosUnknown = 0;
	let webUnknown = 0;
	for (const d of userDocsSnap.docs) {
		const v = d.data();
		if (v.lastSeenIOS == null && v.lastSeenIOSAppVersion == null) {
			// not an iOS user — fall through
		} else if (v.lastSeenIOSAppVersion) {
			iosCounts.set(v.lastSeenIOSAppVersion, (iosCounts.get(v.lastSeenIOSAppVersion) ?? 0) + 1);
		} else {
			iosUnknown += 1;
		}
		if (v.lastSeenWebAppVersion) {
			webCounts.set(v.lastSeenWebAppVersion, (webCounts.get(v.lastSeenWebAppVersion) ?? 0) + 1);
		} else if (v.lastSeenWeb != null) {
			// used the web before the version stamp existed
			webUnknown += 1;
		}
	}
	const versions = [...new Set([...iosCounts.keys(), ...webCounts.keys()])].sort(
		(a, b) => b.localeCompare(a, undefined, { numeric: true }),
	);
	const rows = versions
		.map(
			(v) => `
        <tr>
          <td class="ad-table-mono">${v}</td>
          <td>${iosCounts.get(v) ?? 0} iOS</td>
          <td>${webCounts.get(v) ?? 0} web${v === WEB_APP_VERSION ? " ← current" : ""}</td>
        </tr>`,
		)
		.join("");
	if (!rows) return ""; // no version stamps deployed yet
	return `
    <div class="ad-versions-block">
      <div class="ad-versions-title">Users per last-seen version</div>
      <table class="ad-table-mini">
        ${rows}
        <tr><td colspan="3" class="ad-table-note">
          no version stamp yet: ${iosUnknown} iOS · ${webUnknown} web
        </td></tr>
      </table>
    </div>
  `;
}

function adminStatCard(label, value, kind) {
	return `
    <div class="ad-stat-card">
      <div class="ad-stat-value ${kind === "warn" ? "ad-stat-value-warn" : ""}">${value}</div>
      <div class="ad-stat-label">${label}</div>
    </div>
  `;
}

async function runAdminBackfillAreaSearch(
	btnId = "admin-backfill-areasearch",
	statusId = "admin-backfill-status",
) {
	const btn = document.getElementById(btnId);
	const status = document.getElementById(statusId);
	if (!btn || !status || btn.disabled) return;
	btn.disabled = true;
	setAdminStatus(status, "Scanning routes…");
	try {
		const stats = await adminBackfillAreaSearch( // NOSONAR — adminBackfillAreaSearch is async (cross-module); Sonar S4123 false positive
			({ scanned: s, updated: u }) => {
				status.textContent = `Scanned ${s} routes · updating ${u}…`;
			},
		);
		const { scanned, updated, batches } = stats;
		setAdminStatus(status, `✓ Done — scanned ${scanned}, updated ${updated} (${batches} batch${batches === 1 ? "" : "es"}).`, "ok");
		scheduleStatusClear(status);
	} catch (err) {
		console.error("Backfill areaSearch failed:", err);
		setAdminStatus(status, `✗ Failed: ${escapeHtml(err.message ?? err)}`, "err");
		scheduleStatusClear(status);
	} finally {
		btn.disabled = false;
	}
}

/** Set a status span's text and tone ("neutral" | "ok" | "err") via classes. */
function setAdminStatus(statusEl, text, kind = "neutral") {
	if (!statusEl) return;
	const base = [...statusEl.classList].filter((c) => !c.startsWith("ad-status"));
	statusEl.className = [...base, `ad-status-${kind}`].join(" ");
	statusEl.textContent = text;
}

/** Auto-clear a one-shot status message after 10s (only if not superseded). */
function scheduleStatusClear(statusEl) {
	const before = statusEl.textContent;
	clearTimeout(scheduleStatusClear._timer);
	scheduleStatusClear._timer = setTimeout(() => {
		if (statusEl.isConnected && statusEl.textContent === before) {
			statusEl.textContent = "";
		}
	}, 10_000);
}

// ── Admin routes browser (paginated list + filters + search) ────────────────

const PAGE_SIZE = 25;
const ADMIN_ROUTE_TYPES = ["Sport", "Boulder", "Multi-Pitch", "Trad"];

// Browser UI state — module level so it survives navigation to the edit form
// and is restored (values + page + scroll position) when the user comes back.
const adminBrowserState = {
	searchText: "",
	searchField: "any",
	sortBy: "name", // "name" | "createdAt" — newest-first, browse-all only
	routeType: "",
	country: "",
	isOrphaned: false,
	page: 0,
	pages: [null], // pages[i] = cursors object that starts page i
	total: null,
	pendingScroll: 0, // scrollY to restore after back-navigation, 0 = none
	loadSeq: 0,
};

/** Sort dropdown options for the admin routes browser filter bar. */
const ADMIN_SORT_OPTIONS = [
	{ value: "name", label: "Sort: Name (A–Z)" },
	{ value: "createdAt", label: "Sort: Newest first" },
];

/** Render the sort dropdown for the admin routes browser filter bar. */
function renderAdminSortSelect(selected) {
	const options = ADMIN_SORT_OPTIONS.map(
		(o) => `<option value="${o.value}"${o.value === selected ? " selected" : ""}>${o.label}</option>`,
	).join("");
	return `<select id="admin-b-sort" class="form-input ad-select-auto"
                title="Sort order — “Newest first” applies when not searching">${options}</select>`;
}

/**
 * Distinct ISO country codes across `routes`, scanned once per session and
 * cached in sessionStorage. Returns null when the list is huge or the scan
 * fails — callers fall back to a free-text input.
 */
async function loadAdminCountryOptions() {
	try {
		const cached = sessionStorage.getItem("adminRouteCountries");
		if (cached) return JSON.parse(cached);
		const snap = await getDocs(
			query(collection(db, "routes"), orderBy("country"), limit(1000)),
		);
		const codes = [
			...new Set(snap.docs.map((d) => d.data().country).filter(Boolean)),
		].sort((a, b) => a.localeCompare(b));
		if (codes.length > 100) return null;
		sessionStorage.setItem("adminRouteCountries", JSON.stringify(codes));
		return codes;
	} catch (err) {
		console.warn("loadAdminCountryOptions failed:", err);
		return null;
	}
}

function resetAdminBrowserPagination() {
	adminBrowserState.page = 0;
	adminBrowserState.pages = [null];
	adminBrowserState.total = null;
	adminBrowserState.pendingScroll = 0;
}

function readAdminBrowserFilters() {
	adminBrowserState.searchText =
		document.getElementById("admin-b-search")?.value.trim() ?? "";
	adminBrowserState.searchField =
		document.getElementById("admin-b-field")?.value ?? "any";
	adminBrowserState.sortBy =
		document.getElementById("admin-b-sort")?.value ?? "name";
	adminBrowserState.routeType =
		document.getElementById("admin-b-type")?.value ?? "";
	adminBrowserState.country =
		document.getElementById("admin-b-country")?.value ?? "";
	adminBrowserState.isOrphaned =
		document.getElementById("admin-b-orphaned")?.checked ?? false;
}

async function loadAdminBrowserPage(page) {
	const resultsEl = document.getElementById("admin-b-results");
	if (!resultsEl) return;
	const seq = ++adminBrowserState.loadSeq;

	resultsEl.innerHTML = '<p class="ad-loading">Loading…</p>';

	try {
		const cursors = adminBrowserState.pages[page] ?? null;
		const { routes, nextCursors, total } = await adminQueryRoutes({
			searchText: adminBrowserState.searchText,
			searchField: adminBrowserState.searchField,
			sortBy: adminBrowserState.sortBy,
			routeType: adminBrowserState.routeType || null,
			country: adminBrowserState.country || null,
			isOrphaned: adminBrowserState.isOrphaned,
			pageSize: PAGE_SIZE,
			cursors,
		});
		if (seq !== adminBrowserState.loadSeq) return; // stale response

		adminBrowserState.total = total;
		adminBrowserState.page = page;
		adminBrowserState.pages[page + 1] = nextCursors;

		const hasNext =
			nextCursors.exhausted.length <
			routeQueryStreamKeys(
				adminBrowserState.searchText,
				adminBrowserState.searchField,
			).length;

		if (!routes.length) {
			resultsEl.innerHTML =
				'<p class="ad-loading">No routes match your filters.</p>';
			return;
		}

		resultsEl.innerHTML =
			renderAdminBrowserCount(total) +
			routes.map(renderAdminRouteRow).join("") +
			renderAdminBrowserFooter(page, hasNext);

		resultsEl
			.querySelectorAll(".admin-route-row")
			.forEach((rowEl) => {
				rowEl.addEventListener("click", () => {
					adminBrowserState.pendingScroll = window.scrollY;
					openAdminEditForm(rowEl.dataset.id);
				});
			});
		resultsEl
			.querySelector("#admin-b-prev")
			?.addEventListener("click", () =>
				loadAdminBrowserPage(page - 1),
			);
		resultsEl
			.querySelector("#admin-b-next")
			?.addEventListener("click", () =>
				loadAdminBrowserPage(page + 1),
			);
		resultsEl
			.querySelector("#admin-b-retry")
			?.addEventListener("click", () => loadAdminBrowserPage(page));
		resultsEl
			.querySelector("#admin-b-backfill")
			?.addEventListener("click", () =>
				runAdminBackfillAreaSearch("admin-b-backfill", "admin-b-backfill-status"),
			);
		document.getElementById("admin-b-apply-country").disabled =
			!adminBrowserFiltersActive();
		if (adminBrowserState.pendingScroll) {
			window.scrollTo(0, adminBrowserState.pendingScroll);
			adminBrowserState.pendingScroll = 0;
		}
	} catch (err) {
		if (seq !== adminBrowserState.loadSeq) return;
		console.error("Admin routes browser error:", err);
		resultsEl.innerHTML = `
      <p class="ad-error">Failed to load routes: ${escapeHtml(err.message ?? err)}</p>
      <button id="admin-b-retry" class="btn btn-secondary btn-sm ad-mt-sm">Retry</button>
    `;
		resultsEl
			.querySelector("#admin-b-retry")
			?.addEventListener("click", () => loadAdminBrowserPage(page));
	}
}

function renderAdminBrowserCount(total) {
	if (total == null) return "";
	return `
    <div class="ad-count-row">
      <p class="ad-count-text">${total} routes</p>
      <span class="ad-spacer"></span>
      <button id="admin-b-backfill" class="btn btn-secondary btn-sm"
              title="Rebuild nameSearch/cragSearch/areaSearch where missing or stale (idempotent, safe to re-run)">
        Rebuild search fields
      </button>
      <span id="admin-b-backfill-status" class="ad-backfill-status"></span>
    </div>
  `;
}

function adminBrowserFiltersActive() {
	return Boolean(
		adminBrowserState.searchText ||
			adminBrowserState.routeType ||
			adminBrowserState.country ||
			adminBrowserState.isOrphaned,
	);
}

function renderAdminRouteRow(r) {
	const chipClass =
		{
			Sport: "ad-chip-sport",
			Boulder: "ad-chip-boulder",
			"Multi-Pitch": "ad-chip-multipitch",
			Trad: "ad-chip-trad",
		}[r.routeType] ?? "ad-chip-default";
	const displayGrade = convertFromFrench(r.grade, getPreferredGradeSystem());
	const badges = [
		r.isOrphaned ? '<span class="ad-orphan-badge">orphaned</span>' : "",
		r.latitude == null
			? ""
			: '<span title="GPS pin set" class="ad-pin-badge">📍</span>',
	]
		.filter(Boolean)
		.join("");
	const countryLabel = r.country
		? `${countryFlagEmoji(r.country)} ${escapeHtml(r.country)}`
		: "—";

	return `
    <div class="admin-route-row ${r.isOrphaned ? "ad-route-orphaned" : ""}" data-id="${escapeHtml(r.id)}">
      <div class="ad-route-main">
        <div class="ad-route-name">
          ${escapeHtml(r.name)}${badges}
        </div>
        <div class="ad-route-sub">
          ${escapeHtml(r.crag)}${r.climbingArea ? " · " + escapeHtml(r.climbingArea) : ""}
          &nbsp;·&nbsp;${countryLabel}
        </div>
      </div>
      <div class="ad-route-side">
        <span class="ad-route-grade">${escapeHtml(displayGrade)}</span>
        <span class="ad-chip ${chipClass}">${escapeHtml(r.routeType)}</span>
        <span class="ad-route-sends">✓ ${r.sendCount}</span>
      </div>
    </div>
  `;
}

function renderAdminBrowserFooter(page, hasNext) {
	const totalPages = Math.max(1, Math.ceil((adminBrowserState.total ?? 0) / PAGE_SIZE));
	return `
    <div class="ad-list-footer">
      <button id="admin-b-prev" class="btn btn-secondary btn-sm" ${page === 0 ? "disabled" : ""}>
        ← Previous
      </button>
      <span class="ad-footer-count">Page ${page + 1} of ${totalPages}</span>
      <button id="admin-b-next" class="btn btn-secondary btn-sm" ${hasNext ? "" : "disabled"}>
        Next →
      </button>
    </div>
  `;
}

// ── Batch country assignment ─────────────────────────────────────────────────

/**
 * Promise-based confirmation dialog for the batch country apply.
 * Resolves { country, fillEmptyOnly } on confirm, null on cancel.
 */
function showAdminApplyCountryDialog({ matched, gpsBacked, overwriteCount, codes }) {
	return new Promise((resolve) => {
		const overlay = document.createElement("div");
		overlay.style.cssText =
			"position:fixed;inset:0;background:rgba(15,23,42,0.5);display:flex;align-items:center;justify-content:center;z-index:1000";
		const countryInput = codes
			? `<select id="admin-ac-country" class="form-input ad-select-full">
              <option value="">Select country…</option>
              ${codes
					.map(
						(c) =>
							`<option value="${escapeHtml(c)}">${countryFlagEmoji(c)} ${escapeHtml(c)}</option>`,
					)
					.join("")}
              <option value="__other__">Other (enter code)…</option>
            </select>`
			: `<input type="text" id="admin-ac-country" class="form-input ad-select-full"
               placeholder="ISO country code" maxlength="2" autocomplete="off" />`;

		overlay.className = "ad-dialog-overlay";
		overlay.innerHTML = `
      <div class="ad-dialog-card">
        <h3 class="ad-dialog-title">Apply country to results</h3>
        <p class="ad-dialog-text">
          Apply country to <b>${matched}</b> routes?
          (${gpsBacked} GPS-backed routes will be skipped.)
        </p>
        <div class="ad-mb-sm">${countryInput}</div>
        <label class="ad-checkbox-label ad-mb-xs">
          <input type="checkbox" id="admin-ac-fill" checked />
          Only fill routes without a country
        </label>
        <p id="admin-ac-warn" class="ad-dialog-warn"></p>
        <p class="ad-dialog-hint">
          A later admin GPS assignment (which reverse-geocodes) will overwrite a
          manually set country — GPS-derived values win.
        </p>
        <div class="ad-dialog-actions">
          <button id="admin-ac-cancel" class="btn btn-secondary btn-sm">Cancel</button>
          <button id="admin-ac-ok" class="btn btn-primary btn-sm">Apply</button>
        </div>
      </div>
    `;
		document.body.appendChild(overlay);

		const fill = overlay.querySelector("#admin-ac-fill");
		const warn = overlay.querySelector("#admin-ac-warn");
		function updateWarn() {
			if (fill.checked) {
				warn.style.display = "none";
				warn.textContent = "";
			} else {
				warn.style.display = "";
				warn.textContent =
					`This will overwrite existing country values on ${overwriteCount} routes without GPS. ` +
					"GPS-backed routes are never modified.";
			}
		}
		fill.addEventListener("change", updateWarn);
		updateWarn();

		// "Other" swaps the select for a free-text code input (keeps the same id
		// so the confirm handler is unchanged).
		overlay.querySelector("#admin-ac-country").addEventListener("change", (e) => {
			if (e.target.value !== "__other__") return;
			const input = document.createElement("input");
			input.type = "text";
			input.id = "admin-ac-country";
			input.className = "form-input ad-select-full";
			input.placeholder = "ISO country code";
			input.maxLength = 2;
			input.autocomplete = "off";
			e.target.replaceWith(input);
			input.focus();
		});

		function cleanup() {
			overlay.remove();
		}
		overlay.querySelector("#admin-ac-cancel").addEventListener("click", () => {
			cleanup();
			resolve(null);
		});
		overlay.querySelector("#admin-ac-ok").addEventListener("click", () => {
			const country = overlay
				.querySelector("#admin-ac-country")
				.value.trim()
				.toUpperCase();
			if (country.length !== 2) {
				warn.className = "ad-dialog-err";
				warn.textContent = "Please pick a 2-letter ISO country code.";
				return;
			}
			cleanup();
			resolve({ country, fillEmptyOnly: fill.checked });
		});
	});
}

/**
 * Scan → confirm → write flow behind the "Apply country to results…" button.
 * Status/progress/summary are shown in the backfill status span.
 */
async function runAdminApplyCountry() {
	const resultsEl = document.getElementById("admin-b-results");
	const statusEl = document.getElementById("admin-b-backfill-status");
	const btn = document.getElementById("admin-b-apply-country");
	if (!btn || btn.disabled) return;

	const filters = {
		searchText: adminBrowserState.searchText,
		searchField: adminBrowserState.searchField,
		routeType: adminBrowserState.routeType || null,
		country: adminBrowserState.country || null,
		isOrphaned: adminBrowserState.isOrphaned,
	};
	const setStatus = (text, kind = "neutral") => {
		setAdminStatus(statusEl, text, kind);
	};

	btn.disabled = true;
	try {
		setStatus("Scanning matched routes…");
		const scan = await adminScanCountryTargets(filters, true, ({ scanned }) =>
			setStatus(`Scanning matched routes… ${scanned} found`),
		);
		const matched = scan.targets.length + scan.skippedAlreadySet + scan.skippedGPS;
		if (matched === 0) {
			setStatus("No matching routes found.", "muted");
			return;
		}

		const codes = await loadAdminCountryOptions();
		const decision = await showAdminApplyCountryDialog({
			matched,
			gpsBacked: scan.skippedGPS,
			overwriteCount: scan.skippedAlreadySet,
			codes,
		});
		if (!decision) return; // cancelled

		let targets = scan.targets;
		if (!decision.fillEmptyOnly && scan.skippedAlreadySet > 0) {
			// Overwrite mode: re-scan so previously-set (GPS-less) docs are targets too
			setStatus("Scanning (overwrite mode)…");
			const rescan = await adminScanCountryTargets(filters, false);
			targets = rescan.targets;
		}
		if (targets.length === 0) {
			setStatus(
				`Nothing to do — all ${scan.skippedGPS} matched routes are GPS-backed.`,
				"muted",
			);
			return;
		}

		setStatus(`Updating ${targets.length} routes…`);
		const updated = await adminApplyCountryToTargets(
			targets,
			decision.country,
			({ updated: u, total }) => setStatus(`Updating routes… ${u}/${total}`),
		);
		setStatus(
			`✓ Updated ${updated} routes · skipped ${scan.skippedAlreadySet} already set · skipped ${scan.skippedGPS} GPS-backed`,
			"ok",
		);
		scheduleStatusClear(statusEl);
		// Country values changed — the session-cached dropdown list is now stale;
		// drop it so the next Routes-tab render re-scans.
		sessionStorage.removeItem("adminRouteCountries");
		if (resultsEl) {
			loadAdminBrowserPage(adminBrowserState.page); // refresh rows
		}
	} catch (err) {
		console.error("Apply country batch failed:", err);
		setStatus(`✗ Failed: ${escapeHtml(err.message ?? err)}`, "err");
	} finally {
		btn.disabled = false;
	}
}

function renderAdminSearch() {
	const el = document.getElementById("admin-tab-content");
	if (!el) return;
	el.innerHTML = `
      <div class="ad-filter-bar">
        <input type="text" id="admin-b-search" placeholder="Search route, crag, or area…"
               class="form-input ad-search-input" autocomplete="off"
               value="${escapeHtml(adminBrowserState.searchText)}" />
        <select id="admin-b-field" class="form-input ad-select-auto" title="Search in">
          ${["any", "name", "crag", "area"]
				.map(
					(f) =>
						`<option value="${f}"${adminBrowserState.searchField === f ? " selected" : ""}>Field: ${f === "any" ? "Any" : f[0].toUpperCase() + f.slice(1)}</option>`,
				)
				.join("")}
        </select>
          ${renderAdminSortSelect(adminBrowserState.sortBy)}
      </div>
      <div class="ad-filter-bar-center">
        <select id="admin-b-type" class="form-input ad-select-auto">
          <option value="">Type: All</option>
          ${ADMIN_ROUTE_TYPES.map(
				(t) =>
					`<option value="${escapeHtml(t)}"${adminBrowserState.routeType === t ? " selected" : ""}>${escapeHtml(t)}</option>`,
			).join("")}
        </select>
        <select id="admin-b-country" class="form-input ad-select-auto">
          <option value="">Country: All</option>
          <option value="${COUNTRY_NONE}">Country: (none)</option>
        </select>
        <label class="ad-checkbox-label">
          <input type="checkbox" id="admin-b-orphaned" ${adminBrowserState.isOrphaned ? "checked" : ""} />
          Orphaned only
        </label>
        <span class="ad-spacer"></span>
        <button id="admin-b-apply-country" class="btn btn-secondary btn-sm"
                title="Set the same country on all matching routes (GPS-backed routes are never modified)">
          Apply country to results…
        </button>
      </div>

      <div id="admin-b-results">
        <p class="ad-loading">Loading…</p>
      </div>
  `;

	// Country dropdown: hydrate once per session; fall back to free-text input
	// when the distinct list is huge or the scan fails.
	const countrySelect = document.getElementById("admin-b-country");
	loadAdminCountryOptions().then((codes) => {
		if (countrySelect.isConnected === false) return;
		if (codes) {
			if (adminBrowserState.country === COUNTRY_NONE) {
				countrySelect.querySelector(`option[value="${COUNTRY_NONE}"]`).selected = true;
			}
			codes.forEach((c) => {
				const opt = document.createElement("option");
				opt.value = c;
				opt.textContent = `${countryFlagEmoji(c)} ${c}`;
				if (adminBrowserState.country === c) opt.selected = true;
				countrySelect.appendChild(opt);
			});
		} else {
			const input = document.createElement("input");
			input.type = "text";
			input.id = "admin-b-country";
			input.className = "form-input ad-country-input";
			input.placeholder = "Country (ISO)";
			input.maxLength = 2;
			input.autocomplete = "off";
			input.value = adminBrowserState.country;
			input.addEventListener("change", () => {
				readAdminBrowserFilters();
				resetAdminBrowserPagination();
				loadAdminBrowserPage(0);
			});
			countrySelect.replaceWith(input);
		}
	});

	let timer = null;
	document.getElementById("admin-b-search").addEventListener("input", () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			readAdminBrowserFilters();
			resetAdminBrowserPagination();
			loadAdminBrowserPage(0);
		}, 300);
	});

	["admin-b-field", "admin-b-sort", "admin-b-type", "admin-b-country"].forEach((id) => {
		document
			.getElementById(id)
			.addEventListener("change", () => {
				readAdminBrowserFilters();
				resetAdminBrowserPagination();
				loadAdminBrowserPage(0);
			});
	});
	document.getElementById("admin-b-orphaned").addEventListener("change", () => {
		readAdminBrowserFilters();
		resetAdminBrowserPagination();
		loadAdminBrowserPage(0);
	});
	// The apply-country button lives in this static filter bar — bind it here
	// (it is NOT inside #admin-b-results; its disabled state is refreshed per
	// list load in loadAdminBrowserPage).
	document
		.getElementById("admin-b-apply-country")
		.addEventListener("click", runAdminApplyCountry);

	loadAdminBrowserPage(adminBrowserState.page);
}

// ── Edit form — fetch full doc then render ─────────────────────────────────

async function openAdminEditForm(routeID) {
	const el = document.getElementById("admin-tab-content");
	if (!el) return;
	el.innerHTML = '<p class="ad-loading">Loading…</p>';
	try {
		const route = await getRoute(routeID);
		if (!route) throw new Error("Route not found");
		renderAdminEditForm(route);
	} catch (err) {
		console.error("openAdminEditForm failed:", err);
		el.innerHTML = `
      <button id="admin-back-btn" class="btn btn-secondary btn-sm ad-back-btn">← Back</button>
      <p class="ad-error-inline">Failed to load route: ${escapeHtml(err.message ?? err)}</p>
    `;
		document
			.getElementById("admin-back-btn")
			?.addEventListener("click", () => renderAdminShell("routes"));
	}
}

// ── Edit form render ───────────────────────────────────────────────────────

// ── GPS map initializer ──────────────────────────────────────────────────────

/**
 * Initialise the Leaflet map inside #admin-gps-map.
 * Requires Leaflet to be loaded as a global (window.L) before this is called.
 * Places a draggable marker at the route's current GPS pin (or at the centre of
 * Europe when no pin exists). Map clicks and marker drags both sync back to the
 * lat/lon inputs so the admin can fine-tune the position numerically.
 */
function initAdminGPSMap(route) {
	const mapEl = document.getElementById("admin-gps-map");
	if (!mapEl || !window.L) return;

	const hasGPS = route.latitude != null && route.longitude != null;
	const initialView = hasGPS ? [route.latitude, route.longitude] : [47.0, 14.0]; // centre of Europe fallback
	const initialZoom = hasGPS ? 14 : 4;

	const map = window.L.map(mapEl).setView(initialView, initialZoom);
	window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		attribution:
			'\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		maxZoom: 19,
	}).addTo(map);

	const latInput = document.getElementById("admin-gps-lat");
	const lonInput = document.getElementById("admin-gps-lon");

	function syncInputs(latlng) {
		latInput.value = latlng.lat.toFixed(6);
		lonInput.value = latlng.lng.toFixed(6);
	}

	let marker = null;
	function placeMarker(latlng) {
		// Normalise array [lat, lng] → object so syncInputs can use .lat/.lng
		const ll = Array.isArray(latlng)
			? { lat: latlng[0], lng: latlng[1] }
			: latlng;
		if (marker) {
			marker.setLatLng(ll);
		} else {
			marker = window.L.marker(ll, { draggable: true }).addTo(map);
			marker.on("dragend", (e) => syncInputs(e.target.getLatLng()));
		}
		syncInputs(ll);
	}

	if (hasGPS) placeMarker([route.latitude, route.longitude]);

	map.on("click", (e) => {
		placeMarker(e.latlng);
	});

	// Typing in lat/lon inputs moves the marker
	function onInputChange() {
		const lat = parseFloat(latInput.value);
		const lon = parseFloat(lonInput.value);
		if (
			!isNaN(lat) &&
			!isNaN(lon) &&
			lat >= -90 &&
			lat <= 90 &&
			lon >= -180 &&
			lon <= 180
		) {
			placeMarker([lat, lon]);
			map.setView([lat, lon], Math.max(map.getZoom(), 12));
		}
	}
	latInput.addEventListener("change", onInputChange);
	lonInput.addEventListener("change", onInputChange);
}

// ── Edit form render ──────────────────────────────────────────────────────

function renderAdminEditForm(route) {
	const currentUID = auth.currentUser?.uid ?? "";

	const displayGrade =
		convertFromFrench(route.grade, getPreferredGradeSystem()) ||
		route.createdGrade ||
		route.grade;

	const recentEditsHtml = route.recentEdits.length
		? `
    <div class="ad-audit-block">
      <div class="ad-section-title">
        Recent Edits (last ${route.recentEdits.length})
      </div>
      ${route.recentEdits
				.map((e) => {
					const actionLabel =
						e.action ??
						(e.note?.startsWith("admin country batch") ? "country-batch" : "update");
					const changesHtml = (e.changes ?? [])
						.map((c) => {
							const fmt = (v) => {
								if (v === null || v === undefined) return "—";
								const s = String(v);
								return s === "" ? "(empty)" : escapeHtml(s);
							};
							return `
              <div class="ad-audit-change">
                <span class="ad-change-field">${escapeHtml(c.field)}:</span>
                <span class="ad-change-old">${fmt(c.from)}</span>
                → <span class="ad-change-new">${fmt(c.to)}</span>
              </div>`;
						})
						.join("");
					return `
        <div class="ad-audit-row">
          <div class="ad-audit-meta">
            <span class="ad-audit-time">${fmtDateTime(e.editedAt)}</span>
            <span class="ad-mono" title="${escapeHtml(e.editedBy)}">${uidShort(e.editedBy)}</span>
            ${e.editedBy === currentUID ? '<span class="ad-audit-you">(you)</span>' : ""}
            <span class="ad-audit-badge">${escapeHtml(actionLabel)}</span>
            ${e.note ? `<span class="ad-audit-note">${escapeHtml(e.note)}</span>` : ""}
          </div>
          ${changesHtml}
        </div>`;
				})
				.join("")}
    </div>
  `
		: '<p class="ad-empty">No edit history recorded yet.</p>';

	const lot = route.lastOwnershipTransfer;
	const transferYouBadge =
		lot?.transferredBy === currentUID
			? ' <span class="ad-audit-you">(you)</span>'
			: "";
	const ownershipHtml = lot
		? `
    <div class="ad-audit-block">
      <div class="ad-section-title">
        Last Ownership Transfer
      </div>
      <div class="ad-info-box">
        <div><span class="ad-kv-key">When</span> ${fmtDateTime(lot.transferredAt)}</div>
        <div><span class="ad-kv-key">From</span> <span class="ad-mono" title="${escapeHtml(lot.fromUID ?? "")}">${uidShort(lot.fromUID)}</span></div>
        <div><span class="ad-kv-key">To</span> <span class="ad-mono" title="${escapeHtml(lot.toUID ?? "")}">${uidShort(lot.toUID)}</span></div>
        <div><span class="ad-kv-key">By admin</span> <span class="ad-mono" title="${escapeHtml(lot.transferredBy ?? "")}">${uidShort(lot.transferredBy)}</span>${transferYouBadge}</div>
      </div>
    </div>
  `
		: '<p class="ad-empty">No ownership transfer recorded.</p>';

	const gpsCountryHtml = route.country
		? `&nbsp;·&nbsp;<span class="ad-country-flag">${escapeHtml(route.country)}</span>`
		: "";
	const gpsPinHtml =
		route.latitude != null
			? `
          <p class="ad-note-body">
            Current pin: <strong>${route.latitude.toFixed(5)}°, ${route.longitude.toFixed(5)}°</strong>
            ${gpsCountryHtml}
          </p>
        `
			: `
          <p class="ad-note-body">No GPS coordinates set for this route.</p>
        `;

	const el = document.getElementById("admin-tab-content");
	el.innerHTML = `
    <div class="ad-form">
      <button id="admin-back-btn" class="btn btn-secondary btn-sm ad-back-btn">
        ← Back to search
      </button>
      <h2 class="ad-title">Edit Route</h2>

      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" id="admin-f-name" class="form-input" value="${escapeHtml(route.name)}" />
      </div>
      <div class="ad-grid-2">
        <div class="form-group">
          <label class="form-label">Climbing Area</label>
          <input type="text" id="admin-f-area" class="form-input" value="${escapeHtml(route.climbingArea)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Crag</label>
          <input type="text" id="admin-f-crag" class="form-input" value="${escapeHtml(route.crag)}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Country</label>
        <select id="admin-f-country" class="form-input">
          ${isoCountryOptionsHTML(route.country ?? "", "— No country —")}
        </select>
        ${route.country ? `<p class="ad-country-current">Current: ${countryFlagEmoji(route.country)} ${isoCountryName(route.country) ?? escapeHtml(route.country)}</p>` : ""}
      </div>
      <div class="ad-grid-2">
        <div class="form-group">
          <label class="form-label">Grade</label>
          <input type="text" id="admin-f-grade" class="form-input" value="${escapeHtml(displayGrade)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Route Type</label>
          <select id="admin-f-routetype" class="form-input">
            ${[
							"Sport",
							"Boulder",
							"Multi-Pitch",
							"Trad",
						]
							.map(
								(t) =>
									`<option${route.routeType === t ? " selected" : ""}>${escapeHtml(t)}</option>`,
							)
							.join("")}
          </select>
        </div>
      </div>

      <div class="ad-section">
        <div class="ad-section-heading ad-heading-warn">
          ⚙ Admin Fields
        </div>
        <div class="form-group">
          <label class="form-label ad-label-row">
            <span>Owner UID <span class="ad-label-hint">(paste new UID to transfer)</span></span>
            <button id="admin-transfer-to-me" class="btn btn-secondary btn-sm ad-btn-xs">
              Transfer to me
            </button>
          </label>
          <input type="text" id="admin-f-createdby" class="form-input ad-input-mono"
                 value="${escapeHtml(route.createdBy ?? "")}" />
        </div>
        <label class="ad-checkbox-lg">
          <input type="checkbox" id="admin-f-orphaned" ${route.isOrphaned ? "checked" : ""} />
          Mark as orphaned
        </label>
      </div>

      <div class="ad-section">
        <div class="ad-section-heading ad-heading-info">
          📍 GPS &amp; Location
        </div>
        ${gpsPinHtml}
        <div id="admin-gps-map" class="ad-map"></div>
        <p class="ad-note-muted ad-mb-sm">
          ${
						route.latitude != null
							? "Drag the pin or click the map to reposition it, then press “Save GPS Pin”."
							: "Click the map or drag the pin to place it, then press “Save GPS Pin”."
					}
        </p>
        <div class="ad-grid-2-tight">
          <div class="form-group ad-grid-flat">
            <label class="form-label ad-label-sm">Latitude</label>
            <input type="number" id="admin-gps-lat" class="form-input" step="any"
                   value="${route.latitude ?? ""}" placeholder="e.g. 47.0512" />
          </div>
          <div class="form-group ad-grid-flat">
            <label class="form-label ad-label-sm">Longitude</label>
            <input type="number" id="admin-gps-lon" class="form-input" step="any"
                   value="${route.longitude ?? ""}" placeholder="e.g. 15.4414" />
          </div>
        </div>
        <p class="ad-note-muted ad-mb-sm">
          Saving a GPS pin reverse-geocodes the country and overwrites any
          existing value (manual or GPS-derived). Removing the pin keeps the
          country.
        </p>
        <div class="ad-btn-row">
          <button id="admin-gps-save-btn" class="btn btn-primary btn-sm">📍 Save GPS Pin</button>
          ${
					route.latitude != null
						? '<button id="admin-gps-clear-btn" class="btn btn-danger btn-sm">✕ Remove GPS</button>'
						: ""
				}
        </div>
        <div id="admin-gps-status" class="ad-status ad-status-gps"></div>
      </div>

      <div class="ad-section">
        <div class="ad-section-heading ad-heading-muted">
          Audit Trail
        </div>
        ${recentEditsHtml}
        ${ownershipHtml}
      </div>

      <div class="ad-info-box ad-mb">
        <strong>Route ID:</strong> <span class="ad-mono">${escapeHtml(route.id)}</span><br>
        <strong>Last saved:</strong> ${fmtDateTime(route.updatedAt)}
        ${route.updatedBy ? ` &nbsp;·&nbsp; <span title="${escapeHtml(route.updatedBy)}">${uidShort(route.updatedBy)}</span>` : ""}
        &nbsp;·&nbsp; <strong>Sends:</strong> ${route.sendCount} &nbsp; <strong>Projects:</strong> ${route.projectCount}
      </div>

      <div class="ad-footer-actions">
        <button id="admin-delete-btn" class="btn btn-danger btn-sm">Delete Route</button>
        <div class="ad-btn-row">
          <button id="admin-cancel-btn" class="btn btn-secondary btn-sm">Cancel</button>
          <button id="admin-save-btn" class="btn btn-primary btn-sm">Save Changes</button>
        </div>
      </div>
      <div id="admin-form-status" class="ad-status ad-status-form"></div>
    </div>
  `;

	document
		.getElementById("admin-back-btn")
		.addEventListener("click", () => renderAdminShell("routes"));
	document
		.getElementById("admin-cancel-btn")
		.addEventListener("click", () => renderAdminShell("routes"));

	document
		.getElementById("admin-transfer-to-me")
		.addEventListener("click", () => {
			document.getElementById("admin-f-createdby").value =
				auth.currentUser?.uid ?? "";
		});

	document
		.getElementById("admin-save-btn")
		.addEventListener("click", async () => {
			const btn = document.getElementById("admin-save-btn");
			const status = document.getElementById("admin-form-status");
			btn.disabled = true;
			btn.textContent = "Saving…";
			status.textContent = "";
			try {
				await adminSaveRoute(route.id, {
					name: document.getElementById("admin-f-name").value.trim(),
					climbingArea: document.getElementById("admin-f-area").value.trim(),
					crag: document.getElementById("admin-f-crag").value.trim(),
					grade: document.getElementById("admin-f-grade").value.trim(),
					gradeSystem: getPreferredGradeSystem(),
					routeType: document.getElementById("admin-f-routetype").value,
					createdBy: document.getElementById("admin-f-createdby").value.trim(),
					isOrphaned: document.getElementById("admin-f-orphaned").checked,
						// "" → adminSaveRoute stores null (clears); null would leave untouched
						country:
							document.getElementById("admin-f-country")?.value || "",
				});
				status.className = "ad-status ad-status-form ad-status-ok";
				status.textContent = "✓ Saved successfully";
				setTimeout(() => openAdminEditForm(route.id), 800);
			} catch (err) {
				console.error("adminSaveRoute failed:", err);
				status.className = "ad-status ad-status-form ad-status-err";
				status.textContent = "✗ Save failed: " + (err.message ?? err);
			} finally {
				btn.disabled = false;
				btn.textContent = "Save Changes";
			}
		});

	document
		.getElementById("admin-delete-btn")
		.addEventListener("click", async () => {
			const name =
				document.getElementById("admin-f-name").value.trim() || route.name;
			const confirmed = await showConfirmDialog(
				"Delete Route?",
				`"${name}" will be permanently removed from the community database. This cannot be undone.`,
			);
			if (!confirmed) return;
			const btn = document.getElementById("admin-delete-btn");
			btn.disabled = true;
			btn.textContent = "Deleting…";
			try {
				await adminDeleteRoute(route.id);
				renderAdminShell("routes");
			} catch (err) {
				console.error("adminDeleteRoute failed:", err);
				const status = document.getElementById("admin-form-status");
				status.className = "ad-status ad-status-form ad-status-err";
				status.textContent = "✗ Delete failed: " + (err.message ?? err);
				btn.disabled = false;
				btn.textContent = "Delete Route";
			}
		});

	// ── GPS section ───────────────────────────────────────────────────────────
	// Defer map init so the browser has time to lay out #admin-gps-map before
	// Leaflet measures its dimensions (initialising on a zero-size div = blank map).
	setTimeout(() => initAdminGPSMap(route), 0);

	document
		.getElementById("admin-gps-save-btn")
		.addEventListener("click", async () => {
			const lat = parseFloat(document.getElementById("admin-gps-lat").value);
			const lon = parseFloat(document.getElementById("admin-gps-lon").value);
			// GPS wins over any existing (manual) country: reverse-geocode the pin;
			// null on geocode failure → adminSetGPS leaves the country untouched
			const country = await reverseGeocodeCountry(lat, lon);
			const status = document.getElementById("admin-gps-status");
			const btn = document.getElementById("admin-gps-save-btn");

			if (
				isNaN(lat) ||
				isNaN(lon) ||
				lat < -90 ||
				lat > 90 ||
				lon < -180 ||
				lon > 180
			) {
				status.className = "ad-status ad-status-gps ad-status-err";
				status.textContent = "✗ Enter valid coordinates (lat ±90°, lon ±180°).";
				return;
			}
			btn.disabled = true;
			btn.textContent = "Saving…";
			status.textContent = "";
			try {
				await adminSetGPS(route.id, lat, lon, country);
				status.className = "ad-status ad-status-gps ad-status-ok";
				status.textContent = country
					? `\u2713 GPS pin saved — country set to ${countryFlagEmoji(country)} ${isoCountryName(country) ?? country}.`
					: "\u2713 GPS pin saved — country could not be determined, existing value kept.";
				setTimeout(() => openAdminEditForm(route.id), 800);
			} catch (err) {
				console.error("adminSetGPS failed:", err);
				status.className = "ad-status ad-status-gps ad-status-err";
				status.textContent = "\u2717 Save failed: " + (err.message ?? err);
				btn.disabled = false;
				btn.textContent = "\ud83d\udccd Save GPS Pin";
			}
		});

	document
		.getElementById("admin-gps-clear-btn")
		?.addEventListener("click", async () => {
			const confirmed = await showConfirmDialog(
				"Remove GPS?",
				"This will delete the route start coordinates for all users. This cannot be undone.",
			);
			if (!confirmed) return;
			const status = document.getElementById("admin-gps-status");
			try {
				await adminClearGPS(route.id);
				status.className = "ad-status ad-status-gps ad-status-ok";
				status.textContent = "\u2713 GPS removed.";
				setTimeout(() => openAdminEditForm(route.id), 800);
			} catch (err) {
				console.error("adminClearGPS failed:", err);
				status.className = "ad-status ad-status-gps ad-status-err";
				status.textContent = "\u2717 Remove failed: " + (err.message ?? err);
			}
		});
}
