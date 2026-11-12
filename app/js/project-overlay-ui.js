// project-overlay-ui.js — Project overlay: add/edit project form, status,
// attempts counters, mark-as-sent (project → send transition), and the
// community-rating retraction when a rated send becomes a project.
// Moved out of ui.js as part of the ui.js refactor
// (docs/plan-uijs-refactor.md, Chunk 3).
//
// Shared overlay plumbing (soft-link state, close wiring, route search,
// delete binding, central-route create/propagate) lives in overlay-common.js.
// Pure, DOM-free form helpers live in project-form-model.js.

"use strict";

import {
	canonicalizeProjectStatus,
	saveClimbNote as $saveClimbNote,
} from "./firebase-climbs.js";
import {
	incrementProjectCount as $incrementProjectCount,
	decrementProjectCount as $decrementProjectCount,
	reportRating as $reportRating,
} from "./firebase-routes.js";
import {
	buildProjectSavePayload,
	projectCounterChange,
	validateProjectDates,
} from "./project-form-model.js";
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
	refreshData,
} from "./overlay-common.js";
import { setFindRouteLinked, setFindRouteUnlinked } from "./route-link-ui.js";
import { showAddSendOverlay } from "./send-overlay-ui.js";

// ── Mutable service references (can be overridden by mock mode) ──

let saveClimbNote = $saveClimbNote;
let reportRating = $reportRating;
let incrementProjectCount = $incrementProjectCount;
let decrementProjectCount = $decrementProjectCount;

const PROJECT_MOCK_SETTERS = {
	saveClimbNote: (fn) => (saveClimbNote = fn),
	reportRating: (fn) => (reportRating = fn),
	incrementProjectCount: (fn) => (incrementProjectCount = fn),
	decrementProjectCount: (fn) => (decrementProjectCount = fn),
};

/** Override the project-overlay services (mock mode — see ui.js setMockServices). */
export function setProjectOverlayMockServices(mocks) {
	for (const [key, set] of Object.entries(PROJECT_MOCK_SETTERS)) {
		if (mocks[key]) set(mocks[key]);
	}
}

// ── Shims (ui.js exposes these on globalThis; keeps the dependency one-way) ──

const initGradePicker = (...args) => globalThis.initGradePicker(...args);

// ---------- Add / edit project overlay ----------

export function showAddProjectOverlay() {
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

export function showEditProjectOverlay(climb) {
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

// ---------- Save / counters / rating retraction ----------

function markProjectRouteError() {
	document.getElementById("po-route").classList.add("error");
	document.getElementById("po-route-error").classList.remove("hidden");
}

function clearProjectRouteError() {
	document.getElementById("po-route").classList.remove("error");
	document.getElementById("po-route-error").classList.add("hidden");
}

/** Community rating — retract if a previously linked send had reported a
 * rating (can happen when converting a send to a project via edit). */
function retractPreviousRating() {
	if (
		overlayState.previousReportedRating > 0
		&& overlayState.originalCentralRouteID
	) {
		reportRating(
			overlayState.originalCentralRouteID,
			0,
			overlayState.previousReportedRating,
		);
	}
}

function applyProjectCounters(centralID, { recordName, projectStatus }) {
	if (!centralID) return;
	const change = projectCounterChange({
		isNew: !recordName,
		projectStatus,
	});
	if (change === "increment") incrementProjectCount(centralID);
	else if (change === "decrement") decrementProjectCount(centralID);
}

async function saveProject(closeOverlay) {
	const routeVal = document.getElementById("po-route").value.trim();
	const recordName =
		document.getElementById("po-record-name").value || undefined;
	const projectStatus = document.getElementById("po-status").value;
	const poDateVal = document.getElementById("po-date").value;
	const lastAttemptVal = document.getElementById("po-last-attempt-date").value;

	if (!validateProjectDates(poDateVal, lastAttemptVal)) {
		alert("The last attempt date cannot be before the first attempt date.");
		return;
	}

	const centralID = await maybeCreateCentralRoute("po", routeVal);

	await saveClimbNote(
		buildProjectSavePayload({
			recordName,
			route: routeVal,
			climbingArea: document.getElementById("po-area").value,
			crag: document.getElementById("po-crag").value,
			difficulty: document.getElementById("po-difficulty").value,
			date: poDateVal,
			routeType: document.getElementById("po-routetype").value,
			attempts: document.getElementById("po-attempts").value,
			lastAttemptDate: lastAttemptVal,
			highPoint: document.getElementById("po-highpoint").value,
			projectStatus,
			noteText: document.getElementById("po-notes").value,
			centralRouteID: centralID,
		}),
	);

	retractPreviousRating();
	maybePropagateToRoute(centralID, "po", routeVal);
	applyProjectCounters(centralID, { recordName, projectStatus });

	closeOverlay();
	await refreshData();
}

function bindProjectOverlaySubmit(closeOverlay) {
	const btn = document.getElementById("project-overlay-save");
	btn.addEventListener("click", async () => {
		const routeVal = document.getElementById("po-route").value.trim();
		if (!routeVal) {
			markProjectRouteError();
			return;
		}
		clearProjectRouteError();

		btn.disabled = true;
		btn.textContent = "Saving\u2026";
		try {
			await saveProject(closeOverlay);
		} catch (err) {
			console.error("Save project failed:", err);
			alert("Save failed: " + (err.message ?? err));
		} finally {
			btn.disabled = false;
			btn.textContent = "Save Project";
		}
	});
}

function bindProjectOverlayDelete(closeOverlay) {
	bindOverlayDeleteHandler({
		deleteBtnId: "project-overlay-delete",
		recordFieldId: "po-record-name",
		routeFieldId: "po-route",
		label: "Project",
		closeOverlay,
	});
}

// ---------- Mark as sent (project → send transition) ----------

/**
 * Capture the mark-as-sent prefill from the open overlay's fields and the
 * shared link state — the link fields must be captured before
 * closeOverlay() resets the state.
 */
function buildMarkAsSentPrefill() {
	return {
		route: document.getElementById("po-route").value,
		climbingArea: document.getElementById("po-area").value,
		crag: document.getElementById("po-crag").value,
		difficulty: document.getElementById("po-difficulty").value,
		routeType: document.getElementById("po-routetype").value,
		projectRecordName: document.getElementById("po-record-name").value,
		centralRouteID: overlayState.centralRouteID,
		centralRouteCreatedBy: overlayState.centralRouteCreatedBy,
	};
}

function bindProjectMarkAsSent(closeOverlay) {
	document.getElementById("po-mark-sent").addEventListener("click", () => {
		const prefill = buildMarkAsSentPrefill();
		closeOverlay();
		showAddSendOverlay(prefill);
	});
}

// ---------- Binding ----------

export function bindProjectOverlayHandlers() {
	const closeOverlay = bindOverlayCommon({
		overlayId: "project-overlay",
		fieldPrefix: "po",
		findRouteBtnId: "find-route-btn-project",
	});

	bindProjectOverlaySubmit(closeOverlay);
	bindProjectOverlayDelete(closeOverlay);
	bindProjectMarkAsSent(closeOverlay);

	document
		.getElementById("btn-add-project")
		.addEventListener("click", showAddProjectOverlay);
}
