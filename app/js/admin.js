// admin.js — Admin panel for central route database moderation (modular SDK)
// Depends on: firebase-config.js, firebase-routes.js
// Depends on: escapeHtml, showConfirmDialog (exposed on window by ui.js)
// Depends on: getPreferredGradeSystem (global from grades.js)

"use strict";

import { getCountFromServer } from "firebase/firestore";
import { db, auth } from "./firebase-config.js";
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
    <div style="max-width:680px;margin:0 auto;padding:1.5rem 0">
      <h2 style="margin:0 0 1.25rem;font-size:1.25rem">Admin Panel</h2>
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border-color);margin-bottom:1.5rem">
        <button class="admin-tab ${activeTab === "stats" ? "admin-tab-active" : ""}" data-tab="stats"
          style="padding:0.5rem 1.25rem;background:none;border:none;cursor:pointer;font-size:0.9rem;
            font-weight:600;color:${activeTab === "stats" ? "var(--accent-color,#6366f1)" : "#64748b"};
            border-bottom:${activeTab === "stats" ? "2px solid var(--accent-color,#6366f1)" : "2px solid transparent"};
            margin-bottom:-2px">
          📊 Statistics
        </button>
        <button class="admin-tab ${activeTab === "routes" ? "admin-tab-active" : ""}" data-tab="routes"
          style="padding:0.5rem 1.25rem;background:none;border:none;cursor:pointer;font-size:0.9rem;
            font-weight:600;color:${activeTab === "routes" ? "var(--accent-color,#6366f1)" : "#64748b"};
            border-bottom:${activeTab === "routes" ? "2px solid var(--accent-color,#6366f1)" : "2px solid transparent"};
            margin-bottom:-2px">
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
	el.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem">Loading…</p>';

	try {
		const [totalSnap, activeSnap, orphanedSnap, usersSnap, apiKeysSnap] =
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
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:1.5rem">
        ${adminStatCard("Community Routes", totalRoutes)}
        ${adminStatCard("Active Routes", activeRoutes)}
        ${adminStatCard("Orphaned Routes", orphanedRoutes, orphanedRoutes > 0 ? "#f97316" : null)}
        ${adminStatCard("Registered Users", totalUsers)}
        ${adminStatCard("API Keys Issued", totalKeys)}
        ${adminStatCard("Users with API Keys", usersWithKeys)}
      </div>
      <p style="font-size:0.75rem;color:#94a3b8;text-align:right">
        <button id="admin-stats-refresh" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:0.75rem;">↻ Refresh</button>
      </p>
    `;

		document
			.getElementById("admin-stats-refresh")
			?.addEventListener("click", loadAndRenderAdminStats);
	} catch (err) {
		console.error("Admin stats failed:", err);
		el.innerHTML = `<p style="color:#ef4444;font-size:0.875rem">✗ Failed to load stats: ${escapeHtml(err.message ?? err)}</p>`;
	}
}

function adminStatCard(label, value, valueColor) {
	return `
    <div style="background:var(--card-bg,#fff);border:1px solid var(--border-color);
      border-radius:10px;padding:1rem;display:flex;flex-direction:column;gap:4px">
      <div style="font-size:1.6rem;font-weight:700;color:${valueColor ?? "inherit"}">${value}</div>
      <div style="font-size:0.78rem;color:#64748b">${label}</div>
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
	status.style.color = "#64748b";
	status.textContent = "Scanning routes…";
	try {
		const stats = await adminBackfillAreaSearch( // NOSONAR — adminBackfillAreaSearch is async (cross-module); Sonar S4123 false positive
			({ scanned: s, updated: u }) => {
				status.textContent = `Scanned ${s} routes · updating ${u}…`;
			},
		);
		const { scanned, updated, batches } = stats;
		status.style.color = "#16a34a";
		status.textContent = `✓ Done — scanned ${scanned}, updated ${updated} (${batches} batch${batches === 1 ? "" : "es"}).`;
		scheduleStatusClear(status);
	} catch (err) {
		console.error("Backfill areaSearch failed:", err);
		status.style.color = "#ef4444";
		status.textContent = `✗ Failed: ${escapeHtml(err.message ?? err)}`;
		scheduleStatusClear(status);
	} finally {
		btn.disabled = false;
	}
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
	routeType: "",
	country: "",
	isOrphaned: false,
	page: 0,
	pages: [null], // pages[i] = cursors object that starts page i
	total: null,
	pendingScroll: 0, // scrollY to restore after back-navigation, 0 = none
	loadSeq: 0,
};

// Type chip palette (module-level so the edit form could reuse it later)
const TYPE_CHIP_COLORS = {
	Sport: { bg: "#ecfdf5", color: "#059669" },
	Boulder: { bg: "#fff7ed", color: "#ea580c" },
	"Multi-Pitch": { bg: "#f5f3ff", color: "#7c3aed" },
	Trad: { bg: "#eff6ff", color: "#2563eb" },
};

function countryFlagEmoji(code) {
	if (code?.length !== 2) return "";
	return String.fromCodePoint(
		...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.codePointAt(0) - 65),
	);
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

	resultsEl.innerHTML =
		'<p style="color:#94a3b8;font-size:0.875rem">Loading…</p>';

	try {
		const cursors = adminBrowserState.pages[page] ?? null;
		const { routes, nextCursors, total } = await adminQueryRoutes({
			searchText: adminBrowserState.searchText,
			searchField: adminBrowserState.searchField,
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
			resultsEl.innerHTML = `
          <p style="color:#94a3b8;font-size:0.875rem">No routes match your filters.</p>
        `;
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
			.querySelector("#admin-b-apply-country")
			?.addEventListener("click", runAdminApplyCountry);
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
      <p style="color:#ef4444;font-size:0.875rem">Failed to load routes: ${escapeHtml(err.message ?? err)}</p>
      <button id="admin-b-retry" class="btn btn-secondary btn-sm" style="margin-top:0.5rem">Retry</button>
    `;
		resultsEl
			.querySelector("#admin-b-retry")
			?.addEventListener("click", () => loadAdminBrowserPage(page));
	}
}

function renderAdminBrowserCount(total) {
	if (total == null) return "";
	return `
    <div style="display:flex;align-items:center;gap:10px;margin:0 0 8px">
      <p style="font-size:0.8rem;color:#64748b;margin:0">${total} routes</p>
      <span style="flex:1"></span>
      <button id="admin-b-backfill" class="btn btn-secondary btn-sm"
              title="Add the missing areaSearch field to route docs (idempotent, safe to re-run)">
        Backfill areaSearch
      </button>
      <span id="admin-b-backfill-status" style="font-size:0.75rem;color:#94a3b8"></span>
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
	const chip = TYPE_CHIP_COLORS[r.routeType] ?? { bg: "#f1f5f9", color: "#475569" };
	const displayGrade = convertFromFrench(r.grade, getPreferredGradeSystem());
	const badges = [
		r.isOrphaned
			? '<span style="font-size:0.7rem;color:#f97316;margin-left:6px;background:#ffedd5;padding:1px 6px;border-radius:4px">orphaned</span>'
			: "",
		r.latitude == null
			? ""
			: '<span title="GPS pin set" style="margin-left:4px;font-size:0.75rem">📍</span>',
	]
		.filter(Boolean)
		.join("");
	const countryLabel = r.country
		? `${countryFlagEmoji(r.country)} ${escapeHtml(r.country)}`
		: "—";

	return `
    <div class="admin-route-row" data-id="${escapeHtml(r.id)}" style="
      display:flex;justify-content:space-between;align-items:center;gap:8px;
      padding:10px 12px;border:1px solid var(--border-color);
      border-radius:8px;margin-bottom:6px;cursor:pointer;
      background:${r.isOrphaned ? "#fff7ed" : "var(--card-bg, #fff)"}">
      <div style="min-width:0">
        <div style="font-weight:600;font-size:0.95rem">
          ${escapeHtml(r.name)}${badges}
        </div>
        <div style="font-size:0.8rem;color:#64748b">
          ${escapeHtml(r.crag)}${r.climbingArea ? " · " + escapeHtml(r.climbingArea) : ""}
          &nbsp;·&nbsp;${countryLabel}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;text-align:right">
        <span style="font-size:0.8rem;font-weight:600">${escapeHtml(displayGrade)}</span>
        <span style="font-size:0.7rem;padding:1px 8px;border-radius:4px;background:${chip.bg};color:${chip.color}">${escapeHtml(r.routeType)}</span>
        <span style="font-size:0.8rem;color:#94a3b8">✓ ${r.sendCount}</span>
      </div>
    </div>
  `;
}

function renderAdminBrowserFooter(page, hasNext) {
	const totalPages = Math.max(1, Math.ceil((adminBrowserState.total ?? 0) / PAGE_SIZE));
	return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
      <button id="admin-b-prev" class="btn btn-secondary btn-sm" ${page === 0 ? "disabled" : ""}>
        ← Previous
      </button>
      <span style="font-size:0.8rem;color:#64748b">Page ${page + 1} of ${totalPages}</span>
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
			? `<select id="admin-ac-country" class="form-input" style="width:100%">
              <option value="">Select country…</option>
              ${codes
					.map(
						(c) =>
							`<option value="${escapeHtml(c)}">${countryFlagEmoji(c)} ${escapeHtml(c)}</option>`,
					)
					.join("")}
              <option value="__other__">Other (enter code)…</option>
            </select>`
			: `<input type="text" id="admin-ac-country" class="form-input" style="width:100%"
               placeholder="ISO country code" maxlength="2" autocomplete="off" />`;

		overlay.innerHTML = `
      <div style="background:var(--card-bg,#fff);border-radius:12px;padding:1.25rem;max-width:440px;width:90%;box-shadow:0 10px 30px rgba(0,0,0,0.2)">
        <h3 style="margin:0 0 0.5rem;font-size:1rem">Apply country to results</h3>
        <p style="margin:0 0 0.75rem;font-size:0.85rem">
          Apply country to <b>${matched}</b> routes?
          (${gpsBacked} GPS-backed routes will be skipped.)
        </p>
        <div style="margin-bottom:0.75rem">${countryInput}</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;margin-bottom:0.5rem">
          <input type="checkbox" id="admin-ac-fill" checked />
          Only fill routes without a country
        </label>
        <p id="admin-ac-warn" style="display:none;margin:0 0 0.5rem;font-size:0.78rem;color:#b45309"></p>
        <p style="margin:0 0 0.75rem;font-size:0.75rem;color:#94a3b8">
          A later admin GPS assignment (which reverse-geocodes) will overwrite a
          manually set country — GPS-derived values win.
        </p>
        <div style="display:flex;justify-content:flex-end;gap:8px">
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
			input.className = "form-input";
			input.style.width = "100%";
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
				warn.style.display = "";
				warn.style.color = "#ef4444";
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
	const setStatus = (text, color = "#64748b") => {
		if (statusEl) {
			statusEl.style.color = color;
			statusEl.textContent = text;
		}
	};

	btn.disabled = true;
	try {
		setStatus("Scanning matched routes…");
		const scan = await adminScanCountryTargets(filters, true, ({ scanned }) =>
			setStatus(`Scanning matched routes… ${scanned} found`),
		);
		const matched = scan.targets.length + scan.skippedAlreadySet + scan.skippedGPS;
		if (matched === 0) {
			setStatus("No matching routes found.", "#94a3b8");
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
				"#94a3b8",
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
			"#16a34a",
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
		setStatus(`✗ Failed: ${escapeHtml(err.message ?? err)}`, "#ef4444");
	} finally {
		btn.disabled = false;
	}
}

function renderAdminSearch() {
	const el = document.getElementById("admin-tab-content");
	if (!el) return;
	el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <input type="text" id="admin-b-search" placeholder="Search route, crag, or area…"
               class="form-input" style="flex:1;min-width:200px" autocomplete="off"
               value="${escapeHtml(adminBrowserState.searchText)}" />
        <select id="admin-b-field" class="form-input" style="width:auto" title="Search in">
          ${["any", "name", "crag", "area"]
				.map(
					(f) =>
						`<option value="${f}"${adminBrowserState.searchField === f ? " selected" : ""}>Field: ${f === "any" ? "Any" : f[0].toUpperCase() + f.slice(1)}</option>`,
				)
				.join("")}
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
        <select id="admin-b-type" class="form-input" style="width:auto">
          <option value="">Type: All</option>
          ${ADMIN_ROUTE_TYPES.map(
				(t) =>
					`<option value="${escapeHtml(t)}"${adminBrowserState.routeType === t ? " selected" : ""}>${escapeHtml(t)}</option>`,
			).join("")}
        </select>
        <select id="admin-b-country" class="form-input" style="width:auto">
          <option value="">Country: All</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;color:#64748b;cursor:pointer">
          <input type="checkbox" id="admin-b-orphaned" ${adminBrowserState.isOrphaned ? "checked" : ""} />
          Orphaned only
        </label>
        <span style="flex:1"></span>
        <button id="admin-b-apply-country" class="btn btn-secondary btn-sm"
                title="Set the same country on all matching routes (GPS-backed routes are never modified)">
          Apply country to results…
        </button>
      </div>

      <div id="admin-b-results">
        <p style="color:#94a3b8;font-size:0.875rem">Loading…</p>
      </div>
  `;

	// Country dropdown: hydrate once per session; fall back to free-text input
	// when the distinct list is huge or the scan fails.
	const countrySelect = document.getElementById("admin-b-country");
	loadAdminCountryOptions().then((codes) => {
		if (countrySelect.isConnected === false) return;
		if (codes) {
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
			input.className = "form-input";
			input.style.width = "120px";
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

	["admin-b-field", "admin-b-type", "admin-b-country"].forEach((id) => {
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

	loadAdminBrowserPage(adminBrowserState.page);
}

// ── Edit form — fetch full doc then render ─────────────────────────────────

async function openAdminEditForm(routeID) {
	const el = document.getElementById("admin-tab-content");
	if (!el) return;
	el.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem">Loading…</p>';
	try {
		const route = await getRoute(routeID);
		if (!route) throw new Error("Route not found");
		renderAdminEditForm(route);
	} catch (err) {
		console.error("openAdminEditForm failed:", err);
		el.innerHTML = `
      <button id="admin-back-btn" class="btn btn-secondary btn-sm" style="margin-bottom:1rem">← Back</button>
      <p style="color:#ef4444">Failed to load route: ${escapeHtml(err.message ?? err)}</p>
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
    <div style="margin-bottom:1rem">
      <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem">
        Recent Edits (last ${route.recentEdits.length})
      </div>
      ${route.recentEdits
				.map(
					(e) => `
        <div style="font-size:0.8rem;color:#64748b;padding:3px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:8px">
          <span style="color:#94a3b8;min-width:140px">${fmtDateTime(e.editedAt)}</span>
          <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(e.editedBy)}">${uidShort(e.editedBy)}</span>
          ${e.editedBy === currentUID ? '<span style="color:#6366f1;font-size:0.7rem">(you)</span>' : ""}
        </div>
      `,
				)
				.join("")}
    </div>
  `
		: '<p style="font-size:0.8rem;color:#94a3b8;margin-bottom:1rem">No edit history recorded yet.</p>';

	const lot = route.lastOwnershipTransfer;
	const ownershipHtml = lot
		? `
    <div style="margin-bottom:1rem">
      <div style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem">
        Last Ownership Transfer
      </div>
      <div style="font-size:0.8rem;color:#64748b;background:#f8fafc;border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;line-height:1.8">
        <div><span style="color:#94a3b8;width:80px;display:inline-block">When</span> ${fmtDateTime(lot.transferredAt)}</div>
        <div><span style="color:#94a3b8;width:80px;display:inline-block">From</span> <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(lot.fromUID ?? "")}">${uidShort(lot.fromUID)}</span></div>
        <div><span style="color:#94a3b8;width:80px;display:inline-block">To</span> <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(lot.toUID ?? "")}">${uidShort(lot.toUID)}</span></div>
        <div><span style="color:#94a3b8;width:80px;display:inline-block">By admin</span> <span style="font-family:monospace;font-size:0.75rem" title="${escapeHtml(lot.transferredBy ?? "")}">${uidShort(lot.transferredBy)}</span>${lot.transferredBy === currentUID ? ' <span style="color:#6366f1;font-size:0.7rem">(you)</span>' : ""}</div>
      </div>
    </div>
  `
		: '<p style="font-size:0.8rem;color:#94a3b8;margin-bottom:1rem">No ownership transfer recorded.</p>';

	const el = document.getElementById("admin-tab-content");
	el.innerHTML = `
    <div style="max-width:560px">
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
                 value="${escapeHtml(route.createdBy ?? "")}"
                 style="font-family:monospace;font-size:0.82rem" />
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer;margin-top:0.5rem">
          <input type="checkbox" id="admin-f-orphaned" ${route.isOrphaned ? "checked" : ""} />
          Mark as orphaned
        </label>
      </div>

      <div style="border-top:1px solid var(--border-color);margin:1.25rem 0;padding-top:1.25rem">
        <div style="font-size:0.75rem;font-weight:600;color:#3b82f6;margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.05em">
          📍 GPS &amp; Location
        </div>
        ${
					route.latitude != null
						? `
          <p style="font-size:0.825rem;color:#64748b;margin-bottom:0.5rem">
            Current pin: <strong>${route.latitude.toFixed(5)}°, ${route.longitude.toFixed(5)}°</strong>
            ${route.country ? `&nbsp;·&nbsp;<span style="font-size:0.8rem">${escapeHtml(route.country)}</span>` : ""}
          </p>
        `
						: `
          <p style="font-size:0.825rem;color:#94a3b8;margin-bottom:0.5rem">No GPS coordinates set for this route.</p>
        `
				}
        <div id="admin-gps-map" style="height:220px;border-radius:8px;border:1px solid var(--border-color);margin-bottom:0.75rem;background:#f1f5f9"></div>
        <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.75rem">
          ${
						route.latitude != null
							? "Drag the pin or click the map to reposition it, then press “Save GPS Pin”."
							: "Click the map or drag the pin to place it, then press “Save GPS Pin”."
					}
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:8px;margin-bottom:0.75rem;align-items:end">
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:0.75rem">Latitude</label>
            <input type="number" id="admin-gps-lat" class="form-input" step="any"
                   value="${route.latitude ?? ""}" placeholder="e.g. 47.0512" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:0.75rem">Longitude</label>
            <input type="number" id="admin-gps-lon" class="form-input" step="any"
                   value="${route.longitude ?? ""}" placeholder="e.g. 15.4414" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label" style="font-size:0.75rem">Country</label>
            <input type="text" id="admin-gps-country" class="form-input" maxlength="2"
                   value="${escapeHtml(route.country ?? "")}" placeholder="AT" style="text-transform:uppercase" />
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="admin-gps-save-btn" class="btn btn-primary btn-sm">📍 Save GPS Pin</button>
          ${
						route.latitude != null
							? '<button id="admin-gps-clear-btn" class="btn btn-danger btn-sm">✕ Remove GPS</button>'
							: ""
					}
        </div>
        <div id="admin-gps-status" style="margin-top:0.5rem;font-size:0.825rem;min-height:1.2em"></div>
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
        ${route.updatedBy ? ` &nbsp;·&nbsp; <span title="${escapeHtml(route.updatedBy)}">${uidShort(route.updatedBy)}</span>` : ""}
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
					country: null, // GPS country managed separately via adminSetGPS
				});
				status.style.color = "var(--success-color, #16a34a)";
				status.textContent = "✓ Saved successfully";
				setTimeout(() => openAdminEditForm(route.id), 800);
			} catch (err) {
				console.error("adminSaveRoute failed:", err);
				status.style.color = "#ef4444";
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
				status.style.color = "#ef4444";
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
			const country =
				document
					.getElementById("admin-gps-country")
					.value.trim()
					.toUpperCase() || null;
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
				status.style.color = "#ef4444";
				status.textContent = "✗ Enter valid coordinates (lat ±90°, lon ±180°).";
				return;
			}
			btn.disabled = true;
			btn.textContent = "Saving…";
			status.textContent = "";
			try {
				await adminSetGPS(route.id, lat, lon, country);
				status.style.color = "var(--success-color, #16a34a)";
				status.textContent = "\u2713 GPS pin saved.";
				setTimeout(() => openAdminEditForm(route.id), 800);
			} catch (err) {
				console.error("adminSetGPS failed:", err);
				status.style.color = "#ef4444";
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
				status.style.color = "var(--success-color, #16a34a)";
				status.textContent = "\u2713 GPS removed.";
				setTimeout(() => openAdminEditForm(route.id), 800);
			} catch (err) {
				console.error("adminClearGPS failed:", err);
				status.style.color = "#ef4444";
				status.textContent = "\u2717 Remove failed: " + (err.message ?? err);
			}
		});
}
