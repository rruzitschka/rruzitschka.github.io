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
	incrementAttemptCount as $incrementAttemptCount,
	reportRating as $reportRating,
} from "./firebase-routes.js";
import {
	buildProjectSavePayload,
	projectCounterChange,
	validateProjectDates,
} from "./project-form-model.js";
import { buildAttemptFields } from "./attempt-form-model.js";
import {
	overlayState,
	resetOverlayState,
	syncOverlayCountrySelects,
	syncFindRouteBtn,
	syncMultiPitchSection,
	resetMultiPitchFields,
	fillMultiPitchFields,
	multiPitchFieldsFromOverlay,
	bindOverlayCommon,
	bindOverlayDeleteHandler,
	fetchRouteOwnershipThenSync,
	maybeCreateCentralRoute,
	maybePropagateToRoute,
	refreshData,
} from "./overlay-common.js";
import { setFindRouteLinked, setFindRouteUnlinked } from "./route-link-ui.js";
import { formatDateInput } from "./ui-theme.js";

// ── Mutable service references (can be overridden by mock mode) ──

let saveClimbNote = $saveClimbNote;
let reportRating = $reportRating;
let incrementProjectCount = $incrementProjectCount;
let decrementProjectCount = $decrementProjectCount;
let incrementAttemptCount = $incrementAttemptCount;

const PROJECT_MOCK_SETTERS = {
	saveClimbNote: (fn) => (saveClimbNote = fn),
	reportRating: (fn) => (reportRating = fn),
	incrementProjectCount: (fn) => (incrementProjectCount = fn),
	decrementProjectCount: (fn) => (decrementProjectCount = fn),
	incrementAttemptCount: (fn) => (incrementAttemptCount = fn),
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
	resetMultiPitchFields("po-mp-pitches");
	// iOS parity: a new project's date is its first attempt (default today).
	document.getElementById("po-date").value = formatDateInput();
	document.getElementById("po-last-attempt-date").value = "";
	document.getElementById("po-highpoint").value = "";
	document.getElementById("po-status").value = "active";
	document.getElementById("po-notes").value = "";
	resetAttemptFields();
	document.getElementById("project-overlay-delete").classList.add("hidden");
	document.getElementById("po-route-error").classList.add("hidden");
	document.getElementById("po-route").classList.remove("error");
	resetOverlayState();
	setFindRouteUnlinked("find-route-btn-project");
	syncFindRouteBtn("find-route-btn-project");
		syncOverlayCountrySelects();
	overlay.classList.remove("hidden");
	currentProject = null;
	syncAttemptSectionVisibility();
	syncMultiPitchSectionVisibility();
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
	fillMultiPitchFields(climb, "po-mp-pitches");
	document.getElementById("po-attempts").value = climb.attemptCount ?? 0;
	// Local calendar dates — these inputs round-trip with attempt payloads
	// that parse date-only strings as local dates (see attempt-form-model.js).
	document.getElementById("po-date").value = formatDateInput(climb.date);
	document.getElementById("po-last-attempt-date").value = formatDateInput(
		climb.lastAttemptDate,
	);
	document.getElementById("po-highpoint").value = climb.highPoint ?? "";
	document.getElementById("po-status").value =
		canonicalizeProjectStatus(climb.projectStatus) ?? "active";
	document.getElementById("po-notes").value = climb.noteText ?? "";
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
	currentProject = climb;
	syncAttemptSectionVisibility();
	syncMultiPitchSectionVisibility();
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
			...multiPitchFieldsFromOverlay(
				document.getElementById("po-routetype"),
				"po-mp",
			),
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

// ---------- Log Attempt (iOS AttemptLogView parity) ----------

/** The climb being edited (projectNotes / date fallbacks live on it, not in
 * the overlay form) — null in add mode, where attempts cannot be logged. */
let currentProject = null;

/** Fresh defaults for the attempt inputs (a new attempt starts from today,
 * duration 0, not successful — mirrors AttemptLogView state init). */
function resetAttemptFields() {
	document.getElementById("po-attempt-date").value = formatDateInput();
	document.getElementById("po-attempt-duration").value = "0";
	document.getElementById("po-attempt-highpoint").value = "";
	document.getElementById("po-attempt-success").checked = false;
	document.getElementById("po-attempt-notes").value = "";
}

/** Multi-Pitch plan fields exist only for Multi-Pitch routes (iOS parity:
 * MultiPitchPlanFormFields is gated on the route type). */
function syncMultiPitchSectionVisibility() {
	syncMultiPitchSection(
		document.getElementById("po-routetype"),
		"po-mp-section",
	);
}

/** "Add Attempt" is only offered while the project is still active — iOS
 * hides the button for completed/abandoned projects. */
function syncAttemptSectionVisibility() {
	const section = document.getElementById("po-attempt-section");
	if (!section) return;
	const status = document.getElementById("po-status").value;
	const active =
		currentProject != null && status !== "completed" && status !== "abandoned";
	section.classList.toggle("hidden", !active);
}

/** Project date from the overlay field; the captured climb's date when
 * the field was cleared (failed attempts keep the project's date). */
function overlayProjectDate() {
	const poDateVal = document.getElementById("po-date").value;
	return poDateVal || currentProject?.date || null;
}

/** The editable high point wins; the captured climb's value is the fallback
 * for a failed attempt that didn't reach a new high point. */
function overlayProjectHighPoint() {
	const poVal = document.getElementById("po-highpoint").value;
	return poVal || currentProject?.highPoint || null;
}

/** Overlay fields + captured climb → project state for buildAttemptFields. */
function attemptProjectStateFromOverlay() {
	return {
		recordName: document.getElementById("po-record-name").value,
		route: document.getElementById("po-route").value.trim(),
		climbingArea: document.getElementById("po-area").value,
		crag: document.getElementById("po-crag").value,
		difficulty: document.getElementById("po-difficulty").value,
		routeType: document.getElementById("po-routetype").value,
		centralRouteID: overlayState.centralRouteID,
		attempts: document.getElementById("po-attempts").value,
		projectNotes: currentProject?.projectNotes ?? null,
		projectStatus: document.getElementById("po-status").value,
		highPoint: overlayProjectHighPoint(),
		climbDuration: currentProject?.climbDuration ?? 0,
		noteText: document.getElementById("po-notes").value,
		...multiPitchFieldsFromOverlay(
			document.getElementById("po-routetype"),
			"po-mp",
		),
		date: overlayProjectDate(),
	};
}

function attemptInputFromOverlay() {
	return {
		attemptDate: document.getElementById("po-attempt-date").value,
		durationMinutes: document.getElementById("po-attempt-duration").value,
		wasSuccessful: document.getElementById("po-attempt-success").checked,
		highPoint: document.getElementById("po-attempt-highpoint").value,
		notes: document.getElementById("po-attempt-notes").value,
	};
}

async function saveAttemptFromOverlay(closeOverlay) {
	const routeVal = document.getElementById("po-route").value.trim();
	if (!routeVal) {
		markProjectRouteError();
		return;
	}
	clearProjectRouteError();
	const btn = document.getElementById("po-save-attempt");
	btn.disabled = true;
	btn.textContent = "Saving…";
	try {
		const payload = buildAttemptFields(
			attemptProjectStateFromOverlay(),
			attemptInputFromOverlay(),
		);
		await saveClimbNote(payload);
		// Fire-and-forget: bump the central route's attempt counter (iOS parity).
		if (payload.centralRouteID) incrementAttemptCount(payload.centralRouteID);
		closeOverlay();
		await refreshData();
	} catch (err) {
		console.error("Save attempt failed:", err);
		alert("Save failed: " + (err.message ?? err));
	} finally {
		btn.disabled = false;
		btn.textContent = "Save Attempt";
	}
}

function bindProjectAttemptSection(closeOverlay) {
	const attemptBtn = document.getElementById("po-save-attempt");
	if (attemptBtn) {
		attemptBtn.addEventListener("click", () => {
			saveAttemptFromOverlay(closeOverlay);
		});
	}
	const statusSelect = document.getElementById("po-status");
	if (statusSelect) {
		statusSelect.addEventListener("change", syncAttemptSectionVisibility);
	}
	const routetypeSelect = document.getElementById("po-routetype");
	if (routetypeSelect) {
		routetypeSelect.addEventListener("change", syncMultiPitchSectionVisibility);
	}
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
	bindProjectAttemptSection(closeOverlay);

	document
		.getElementById("btn-add-project")
		.addEventListener("click", showAddProjectOverlay);
}
