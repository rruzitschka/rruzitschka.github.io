// overlay-common.js — Shared overlay plumbing for the Send and Project
// overlays: the central-route soft-link state (routeID/name/crag/area/
// createdBy/country, pending new route, rating provenance), close/cancel/
// backdrop wiring, the route search overlay, delete binding, and the
// central-route create/propagate helpers.
//
// Split out of ui.js as part of the ui.js refactor
// (docs/plan-uijs-refactor.md, Chunk 2). Both overlay modules import from
// here; ui.js keeps only the project overlay's own field wiring until
// Chunk 3 moves it.

"use strict";

import { db, auth } from "./firebase-config.js";
import { doc, getDoc } from "firebase/firestore";
import {
	searchRoutes as $searchRoutes,
	createCentralRoute as $createCentralRoute,
	updateCentralRoute as $updateCentralRoute,
	shouldClearSoftLink,
} from "./firebase-routes.js";
import {
	deleteClimbNote as $deleteClimbNote,
} from "./firebase-climbs.js";
import {
	syncCountrySelects as _syncCountrySelects,
	overlayCountryChange,
} from "./overlay-country.js";
import {
	setFindRouteLinked,
	setFindRouteUnlinked,
} from "./route-link-ui.js";
import { renderCommunityOwnerIndicatorHtml } from "./ui-theme.js";
import { resetPhotoOverlay } from "./photo-overlay-ui.js";

// ── Mutable service references (can be overridden by mock mode) ──

let searchRoutes = $searchRoutes;
let createCentralRoute = $createCentralRoute;
let updateCentralRoute = $updateCentralRoute;
let deleteClimbNote = $deleteClimbNote;

let _loadData = async () => {};

/** Register the mock services used by the shared overlay plumbing. */
export function setOverlayCommonMockServices(mocks) {
	if (mocks.searchRoutes) searchRoutes = mocks.searchRoutes;
	if (mocks.createCentralRoute) createCentralRoute = mocks.createCentralRoute;
	if (mocks.updateCentralRoute) updateCentralRoute = mocks.updateCentralRoute;
	if (mocks.deleteClimbNote) deleteClimbNote = mocks.deleteClimbNote;
}

/**
 * Register the full-refresh callback (ui.js loadData). Needed by the
 * delete handler; injected to keep the module dependency one-way.
 */
export function setDataLoader(fn) {
	_loadData = fn;
}

/** Trigger the full data refresh (injected via setDataLoader). */
export async function refreshData() {
	await _loadData();
}

// ── Shims (ui.js exposes these on globalThis; keeps the dependency one-way) ──

const escapeHtml = (...args) => globalThis.escapeHtml(...args);
const showConfirmDialog = (...args) => globalThis.showConfirmDialog(...args);
const getPreferredGradeSystem = () => globalThis.getPreferredGradeSystem();
const initGradePicker = (...args) => globalThis.initGradePicker(...args);

// ── Shared overlay state (central-route soft link + rating provenance) ──

/**
 * Mutable state shared by the Send and Project overlays. Both overlay
 * modules read and write these fields; closeOverlay resets them.
 */
export const overlayState = {
	centralRouteID: null,
	centralRouteName: "",
	centralRouteCrag: "",
	centralRouteArea: "",
	centralRouteCreatedBy: null,
	pendingNewCentralRoute: null,
	// reportedRating when the edit overlay was opened (rating provenance)
	previousReportedRating: 0,
	// centralRouteID when the edit overlay was opened (rating provenance)
	originalCentralRouteID: null,
	// country of the route linked in the open overlay; undefined = not yet known
	centralRouteCountry: undefined,
};

/** Reset all shared overlay state (used by closeOverlay). */
// ── Multi-Pitch plan fields (shared by Send + Project overlays) ──────────
/** Toggle a Multi-Pitch plan section by the route-type select value. */
export function syncMultiPitchSection(routetypeEl, sectionId) {
	const section = document.getElementById(sectionId);
	if (!section) return;
	section.classList.toggle(
		"hidden",
		routetypeEl?.value !== "Multi-Pitch",
	);
}


/** Multi-Pitch plan fields from the overlay — {} for other route types
 * (undefined fields are merge-preserved, matching iOS plan-data retention). */
export function multiPitchFieldsFromOverlay(routetypeEl, base) {
	if (routetypeEl?.value !== "Multi-Pitch") return {};
	// Optional chaining for deploy skew (cached old index.html + fresh JS):
	// a missing input yields undefined → merge-preserved, not lost.
	return {
		pitches: document.getElementById(`${base}-pitches`)?.value,
		approachNotes: document.getElementById(`${base}-approach`)?.value,
		descentNotes: document.getElementById(`${base}-descent`)?.value,
		gearNotes: document.getElementById(`${base}-gear`)?.value,
	};
}

/** Reset the Multi-Pitch plan inputs (iOS MultiPitchPlanFormFields defaults:
 * 0 pitches, empty notes). pitchesId is the first field's id; the others are
 * derived by the -approach/-descent/-gear suffixes. */
export function resetMultiPitchFields(pitchesId) {
	const base = pitchesId.replace(/-pitches$/, "");
	const el = document.getElementById(pitchesId);
	if (el) el.value = "0";
	for (const suffix of ["approach", "descent", "gear"]) {
		const f = document.getElementById(`${base}-${suffix}`);
		if (f) f.value = "";
	}
}

/** Fill the Multi-Pitch plan inputs from a climb (number null → 0). */
export function fillMultiPitchFields(climb, pitchesId) {
	const base = pitchesId.replace(/-pitches$/, "");
	const el = document.getElementById(pitchesId);
	if (el) el.value = String(climb?.numberOfPitches ?? 0);
	const fields = {
		approach: climb?.approachNotes ?? "",
		descent: climb?.descentNotes ?? "",
		gear: climb?.gearNotes ?? "",
	};
	for (const [suffix, value] of Object.entries(fields)) {
		const f = document.getElementById(`${base}-${suffix}`);
		if (f) f.value = value;
	}
}

export function resetOverlayState() {
	overlayState.centralRouteID = null;
	overlayState.centralRouteName = "";
	overlayState.centralRouteCrag = "";
	overlayState.centralRouteArea = "";
	overlayState.centralRouteCreatedBy = null;
	overlayState.pendingNewCentralRoute = null;
	overlayState.previousReportedRating = 0;
	overlayState.originalCentralRouteID = null;
	overlayState.centralRouteCountry = undefined;
}

/** Sync the country selects from the current shared overlay state. */
export function syncOverlayCountrySelects() {
	_syncCountrySelects({
		uid: auth.currentUser?.uid,
		centralRouteID: overlayState.centralRouteID,
		pendingNewCentralRoute: overlayState.pendingNewCentralRoute,
		createdBy: overlayState.centralRouteCreatedBy,
		country: overlayState.centralRouteCountry,
	});
}

/**
 * Hide the "Find in Community DB" button while the overlay's route is
 * linked to the central DB (editing a linked note, or a pending new route
 * just picked); show it again once the link clears (so relinking stays
 * possible). Unlinked/legacy notes keep the button.
 */
export function syncFindRouteBtn(findRouteBtnId) {
	const isLinked = Boolean(
		overlayState.centralRouteID || overlayState.pendingNewCentralRoute,
	);
	document.getElementById(findRouteBtnId)?.classList.toggle("hidden", isLinked);
}

// ── Route search overlay ──

/**
 * Build and inject a route search overlay into the DOM.
 * @param {string} displaySystem - User's grade system ('French'|'YDS'|'UIAA')
 * @param {function} onSelect - called with (route, isNew) when user picks/creates a route
 */
export function buildRouteSearchOverlay(displaySystem, onSelect) {
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
			.then((routes) => renderSearchResults(resultsEl, routes, onSelect, overlay))
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

/** Render the matched routes and bind row clicks; empty result sets show
 * the create-new hint. `overlay` is removed when a route is picked. */
function renderSearchResults(resultsEl, routes, onSelect, overlay) {
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
            <strong>${escapeHtml(r.name)}${r.createdBy === currentUID ? renderCommunityOwnerIndicatorHtml(true) : renderCommunityOwnerIndicatorHtml(false)}</strong>
            <span style="color:var(--accent-color);font-weight:600;">${escapeHtml(r.displayGrade)}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            ${escapeHtml(r.crag)}${r.climbingArea ? " · " + escapeHtml(r.climbingArea) : ""} · ${escapeHtml(r.routeType)}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            ✓ ${r.sendCount} sends · ${r.projectCount} projecting${r.communityRating == null ? "" : ` · ★ ${r.communityRating.toFixed(1)}`}${r.latitude == null ? "" : " · 📍"}
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
}

// ── Shared overlay helpers ──

/**
 * Fetch the linked route's ownership + country asynchronously, update the
 * soft-link ownership icon and the country selects. Shared by the Send and
 * Project overlays after they link a central route.
 */
export function fetchRouteOwnershipThenSync(routeID, findRouteBtnId, routeLabel) {
	getDoc(doc(db, "routes", routeID))
		.then((routeSnap) => {
			if (!routeSnap.exists()) return;
			overlayState.centralRouteCreatedBy =
				routeSnap.data().createdBy ?? null;
			overlayState.centralRouteCountry = routeSnap.data().country ?? null;
			setFindRouteLinked(
				findRouteBtnId,
				routeLabel,
				overlayState.centralRouteCreatedBy,
			);
			syncOverlayCountrySelects();
		})
		.catch(() => {});
}

/**
 * Shared setup for Send and Project overlays.
 * Wires close/cancel/backdrop, the "find route" button, and soft-link clearing.
 * Returns a closeOverlay() function for use in save/delete handlers.
 */
export function bindOverlayCommon({ overlayId, fieldPrefix: p, findRouteBtnId }) {
	function closeOverlay() {
		document.getElementById(overlayId).classList.add("hidden");
		resetOverlayState();
		resetPhotoOverlay(p);
		setFindRouteUnlinked(findRouteBtnId);
		syncOverlayCountrySelects();
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
		buildRouteSearchOverlay(getPreferredGradeSystem(), (route, isNew) =>
			applyRouteSelection(route, isNew, p, findRouteBtnId),
		);
	});

	[`${p}-route`, `${p}-crag`, `${p}-area`].forEach((fieldId) => {
		document.getElementById(fieldId)?.addEventListener("input", () => {
			if (softLinkShouldBeCleared(p)) {
				overlayState.centralRouteID = null;
				setFindRouteUnlinked(findRouteBtnId);
				syncOverlayCountrySelects();
				syncFindRouteBtn(findRouteBtnId);
			}
		});
	});

	return closeOverlay;
}

/** Apply a picked (or newly created) route to the overlay fields and the
 * shared soft-link state. */
function applyRouteSelection(route, isNew, p, findRouteBtnId) {
	applyRouteFields(route, p);
	applyRouteLinkState(route, isNew, findRouteBtnId);
	syncOverlayCountrySelects();
}

/** Fill the overlay's route/area/crag/grade/routetype fields. */
function applyRouteFields(route, p) {
	document.getElementById(`${p}-route`).value = route.name || "";
	document.getElementById(`${p}-area`).value = route.climbingArea || "";
	document.getElementById(`${p}-crag`).value = route.crag || "";
	if (route.displayGrade) {
		initGradePicker(document.getElementById(`${p}-difficulty`), route.displayGrade);
	}
	if (route.routeType) {
		document.getElementById(`${p}-routetype`).value = route.routeType;
	}
}

/** Update the shared soft-link state + ownership icon for the picked route. */
function applyRouteLinkState(route, isNew, findRouteBtnId) {
	overlayState.centralRouteName = route.name || "";
	overlayState.centralRouteCrag = route.crag || "";
	overlayState.centralRouteArea = route.climbingArea || "";
	overlayState.centralRouteCreatedBy = route.createdBy ?? null;
	overlayState.centralRouteCountry = route.country ?? null;
	if (isNew) {
		overlayState.pendingNewCentralRoute = route;
		overlayState.centralRouteID = null;
		overlayState.centralRouteCreatedBy = null;
	} else {
		overlayState.centralRouteID = route.id;
	}
	setFindRouteLinked(findRouteBtnId, route.name, overlayState.centralRouteCreatedBy);
	syncFindRouteBtn(findRouteBtnId);
}

/** True when the overlay fields drifted from the linked route so far that
 * the soft link must be cleared (owner edits are allowed). */
function softLinkShouldBeCleared(p) {
	const state = overlayState;
	if (!state.centralRouteID) return false;
	if (state.centralRouteCreatedBy === auth.currentUser?.uid) return false;
	return shouldClearSoftLink(
		{
			name: state.centralRouteName,
			crag: state.centralRouteCrag,
			area: state.centralRouteArea,
		},
		{
			name: document.getElementById(`${p}-route`).value,
			crag: document.getElementById(`${p}-crag`).value,
			area: document.getElementById(`${p}-area`).value,
		},
	);
}

/** Binds the delete button for Send or Project overlays. */
export function bindOverlayDeleteHandler({
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
				await refreshData();
			} catch (err) {
				alert("Delete failed: " + (err.message ?? err));
			}
		});
}

/**
 * Creates a central route if a pending new route is set.
 * Returns the resolved centralID (may be unchanged if no pending route).
 */
export async function maybeCreateCentralRoute(fieldPrefix, routeVal) {
	if (!overlayState.pendingNewCentralRoute) return overlayState.centralRouteID;
	const p = fieldPrefix;
	let centralID = overlayState.centralRouteID;
	try {
		centralID = await createCentralRoute({
			name: routeVal,
			climbingArea: document.getElementById(`${p}-area`).value.trim() || "",
			crag: document.getElementById(`${p}-crag`).value.trim() || "",
			grade: document.getElementById(`${p}-difficulty`).value || "",
			gradeSystem: getPreferredGradeSystem(),
			routeType: document.getElementById(`${p}-routetype`).value,
			country:
				document.getElementById(`${p}-country`)?.value.trim().toUpperCase() || null,
		});
		overlayState.centralRouteID = centralID;
	} catch (err) {
		console.warn("Failed to create central route:", err);
		// Don't block save if central route creation fails
	}
	overlayState.pendingNewCentralRoute = null;
	return centralID;
}

/** Propagates overlay field edits back to central route if the current user is the creator. */
export function maybePropagateToRoute(centralID, fieldPrefix, routeVal, isGym = false) {
	// Gym notes never write back to the central route DB (ADR 0005).
	if (isGym) return;
	if (!centralID || overlayState.centralRouteCreatedBy !== auth.currentUser?.uid)
		return;
	const p = fieldPrefix;
	updateCentralRoute(centralID, {
		name: routeVal,
		climbingArea: document.getElementById(`${p}-area`).value.trim() || "",
		crag: document.getElementById(`${p}-crag`).value.trim() || "",
		grade: document.getElementById(`${p}-difficulty`).value || "",
		gradeSystem: getPreferredGradeSystem(),
		routeType: document.getElementById(`${p}-routetype`).value,
		// {} until the linked route's country is known — a fast save before the
		// route fetch resolved must not silently wipe the country. "" → clears.
		...overlayCountryChange(p, overlayState.centralRouteCountry),
	});
}
