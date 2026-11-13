// send-overlay-ui.js — Send overlay: add/edit send form, style tabs, star
// rating, route-type sync, inline ascent form, and the route-type/style
// DOM sync rules. Moved out of ui.js as part of the ui.js refactor
// (docs/plan-uijs-refactor.md, Chunk 2).
//
// Shared overlay plumbing (soft-link state, close wiring, route search,
// delete binding, central-route create/propagate) lives in overlay-common.js.
// Pure, DOM-free form helpers live in send-form-model.js.

"use strict";

import {
	canonicalizeSendType,
	normalizeSendType,
	saveClimbNote as $saveClimbNote,
	deleteClimbNote as $deleteClimbNote,
	saveAscent as $saveAscent,
	deleteAscent as $deleteAscent,
	fetchAscents as $fetchAscents,
} from "./firebase-climbs.js";
import { formatDateInput } from "./ui-theme.js";
import {
	incrementSendCount as $incrementSendCount,
	completedProject as $completedProject,
	reportRating as $reportRating,
} from "./firebase-routes.js";
import {
	GYM_ROUTE_TYPES,
	coerceSendTypeForRouteType,
	isStyleTabHidden,
} from "./send-style.js";
import {
	stylePillClass,
	buildSendSavePayload,
	sendRatingReportCalls,
	buildAscentInput,
} from "./send-form-model.js";
import {
	overlayState,
	resetOverlayState,
	syncOverlayCountrySelects,
	syncFindRouteBtn,
	bindOverlayCommon,
	bindOverlayDeleteHandler,
	syncMultiPitchSection,
	resetMultiPitchFields,
	fillMultiPitchFields,
	multiPitchFieldsFromOverlay,
	fetchRouteOwnershipThenSync,
	maybeCreateCentralRoute,
	maybePropagateToRoute,
	refreshData,
} from "./overlay-common.js";
import { setFindRouteLinked, setFindRouteUnlinked } from "./route-link-ui.js";
import {
	resetPhotoOverlay,
	fillPhotoOverlay,
	flushPendingPhotos,
} from "./photo-overlay-ui.js";

// ── Mutable service references (can be overridden by mock mode) ──

let saveClimbNote = $saveClimbNote;
let deleteClimbNote = $deleteClimbNote;
let saveAscent = $saveAscent;
let deleteAscent = $deleteAscent;
let fetchAscents = $fetchAscents;
let incrementSendCount = $incrementSendCount;
let completedProject = $completedProject;
let reportRating = $reportRating;

/** Override the send-overlay services (mock mode — see ui.js setMockServices). */
const SEND_MOCK_SETTERS = {
	saveClimbNote: (fn) => (saveClimbNote = fn),
	deleteClimbNote: (fn) => (deleteClimbNote = fn),
	saveAscent: (fn) => (saveAscent = fn),
	deleteAscent: (fn) => (deleteAscent = fn),
	fetchAscents: (fn) => (fetchAscents = fn),
	incrementSendCount: (fn) => (incrementSendCount = fn),
	completedProject: (fn) => (completedProject = fn),
	reportRating: (fn) => (reportRating = fn),
};

export function setSendOverlayMockServices(mocks) {
	for (const [key, set] of Object.entries(SEND_MOCK_SETTERS)) {
		if (mocks[key]) set(mocks[key]);
	}
}

// ── Shims (ui.js exposes these on globalThis; keeps the dependency one-way) ──

const escapeHtml = (...args) => globalThis.escapeHtml(...args);
const showConfirmDialog = (...args) => globalThis.showConfirmDialog(...args);
const initGradePicker = (...args) => globalThis.initGradePicker(...args);

// Gym route types and send-type coercion/visibility rules live in the pure
// send-style.js module (unit-tested) — this module only applies them to the DOM.

// ---------- Star rating ----------

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

// ---------- Route-type / style sync ----------

/** Tab visibility: boulder shows Flash/Top, rope shows rope styles (gyms
 * without pinkpoint/all free); a legacy send type that matches no visible
 * tab stays selectable (iOS keeps legacy types selectable on edits). */
function syncStyleTabVisibility(current, routeType) {
	document.querySelectorAll("#so-style-tabs .style-tab").forEach((tab) => {
		tab.classList.toggle(
			"hidden",
			isStyleTabHidden(tab.dataset.style, current, routeType),
		);
	});
}

/** Gym notes use the crag field for the gym name (ADR 0005); guarded so a
 * missing element (deploy skew) cannot throw. */
function syncCragFieldForGym(isGym) {
	const cragLabel = document.getElementById("so-crag-label");
	if (cragLabel) cragLabel.textContent = isGym ? "Gym" : "Crag";
	const cragInput = document.getElementById("so-crag");
	if (cragInput)
		cragInput.placeholder = isGym
			? "e.g. Boulderhalle Wien"
			: "e.g. La Face";
}

/**
 * Syncs the send overlay's gym-sensitive UI to the selected route type:
 * Crag label ↔ Gym (+ hide the climbing-area field), and which send-type
 * tabs are visible. With `normalize` (user type switch), the send type is
 * coerced like iOS. Legacy send types on existing notes are preserved and
 * their tab kept visible.
 */
function syncSendOverlayForRouteType(normalize = false) {
	const routeType = document.getElementById("so-routetype").value;
	const isGym = GYM_ROUTE_TYPES.has(routeType);
	syncMultiPitchSection(
		document.getElementById("so-routetype"),
		"so-mp-section",
	);
	// Area and country belong to the central route DB, which gym notes never
	// touch (ADR 0005). Optional chaining: a cached old index.html paired
	// with fresh JS (deploy skew) must never throw and kill the overlay.
	syncCragFieldForGym(isGym);
	document.getElementById("so-area-group")?.classList.toggle("hidden", isGym);
	document
		.getElementById("so-country-group")
		?.classList.toggle("hidden", isGym);

	let current = canonicalizeSendType(
		document.getElementById("so-sendtype").value,
	);
	if (normalize && current !== "project") {
		const next = coerceSendTypeForRouteType(current, routeType);
		if (next !== current) {
			current = next;
			setStylePill(normalizeSendType(next));
		}
	}

	syncStyleTabVisibility(current, routeType);
}

function setStylePill(value) {
	document.querySelectorAll("#so-style-tabs .style-tab").forEach((tab) => {
		// Only reset the active state — `className = ...` would also strip the
		// hidden class that route-type visibility sync relies on.
		tab.classList.remove(
			"active-rp",
			"active-os",
			"active-tr",
			"active-af",
			"active-pk",
			"active-fl",
			"active-tp",
		);
		if (tab.dataset.style === value) tab.classList.add(stylePillClass(value));
	});
	const hidden = document.getElementById("so-sendtype");
	if (hidden) hidden.value = value;
}

// ---------- Add / edit send overlay ----------

export function showAddSendOverlay(prefill = {}) {
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
	document.getElementById("so-date").value = formatDateInput();
	document.getElementById("so-notes").value = "";
	resetMultiPitchFields("so-mp-pitches");
	setStarRating(0);
	setStylePill("Redpoint");
	syncSendOverlayForRouteType();
	document.getElementById("so-ascents-section").classList.add("hidden");
	document.getElementById("so-ascent-form").classList.add("hidden");
	document.getElementById("so-ascent-toggle").textContent = "+ Add";
	document.getElementById("send-overlay-delete").classList.add("hidden");
	document.getElementById("so-route-error").classList.add("hidden");
	document.getElementById("so-route").classList.remove("error");
	overlay.dataset.projectRecordName = prefill.projectRecordName ?? "";
	resetOverlayState();
	setFindRouteUnlinked("find-route-btn-send");
	syncFindRouteBtn("find-route-btn-send");

	// Restore soft link if coming from a linked project (mark-as-sent flow)
	if (prefill.centralRouteID) {
		overlayState.centralRouteID = prefill.centralRouteID;
		overlayState.centralRouteName = prefill.route || "";
		overlayState.centralRouteCrag = prefill.crag || "";
		overlayState.centralRouteArea = prefill.climbingArea || "";
		overlayState.centralRouteCreatedBy = prefill.centralRouteCreatedBy ?? null;
		setFindRouteLinked(
			"find-route-btn-send",
			prefill.route,
			overlayState.centralRouteCreatedBy,
		);
		syncFindRouteBtn("find-route-btn-send");
		// Fetch country asynchronously so the country select can prefill
		fetchRouteOwnershipThenSync(
			prefill.centralRouteID,
			"find-route-btn-send",
			prefill.route,
		);
	}

	syncOverlayCountrySelects();
	resetPhotoOverlay("so");
	overlay.classList.remove("hidden");
}

export function showEditSendOverlay(climb) {
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
	document.getElementById("so-date").value = formatDateInput(climb.date);
	document.getElementById("so-notes").value = climb.noteText ?? "";
	fillMultiPitchFields(climb, "so-mp-pitches");
	setStarRating(climb.rating ?? 0);
	setStylePill(climb.sendType ?? "Redpoint");
	syncSendOverlayForRouteType();
	document.getElementById("so-ascents-section").classList.remove("hidden");
	document.getElementById("send-overlay-delete").classList.remove("hidden");
	renderAscentsList(climb);
	fillPhotoOverlay("so", climb.recordName);

	overlayState.previousReportedRating = climb.reportedRating ?? 0;
	overlayState.originalCentralRouteID = climb.centralRouteID ?? null;

	if (climb.centralRouteID) {
		overlayState.centralRouteID = climb.centralRouteID;
		overlayState.centralRouteName = climb.route || "";
		overlayState.centralRouteCrag = climb.crag || "";
		overlayState.centralRouteArea = climb.climbingArea || "";
		overlayState.centralRouteCreatedBy = null;
		setFindRouteLinked("find-route-btn-send", climb.route, null);
		syncFindRouteBtn("find-route-btn-send");
		// Fetch createdBy + country asynchronously to update ownership icon
		// and the country select (owner-only editing)
		fetchRouteOwnershipThenSync(
			climb.centralRouteID,
			"find-route-btn-send",
			climb.route,
		);
	}
	syncOverlayCountrySelects();
}

// ---------- Save / counters / rating ----------

function markSendRouteError() {
	document.getElementById("so-route").classList.add("error");
	document.getElementById("so-route-error").classList.remove("hidden");
}

function clearSendRouteError() {
	document.getElementById("so-route").classList.remove("error");
	document.getElementById("so-route-error").classList.add("hidden");
}

function applySendRatingReports(centralID, { recordName, isGym }) {
	// Community rating — edits use delta logic based on link state; gym
	// notes never write to routes/ (ADR 0005); new sends carry their
	// reportedRating in the save payload (previousRating = 0).
	if (!recordName || isGym) return;
	const calls = sendRatingReportCalls({
		centralID,
		originalCentralRouteID: overlayState.originalCentralRouteID,
		previousReportedRating: overlayState.previousReportedRating,
		rating: currentStarRating,
	});
	for (const call of calls) {
		reportRating(call.routeID, call.rating, call.previousRating);
	}
}

function applySendCounters(centralID, projectRecordName) {
	if (!centralID) return;
	if (projectRecordName) {
		// Coming from mark-as-sent: decrement projectCount + increment sendCount atomically
		completedProject(centralID);
	} else {
		incrementSendCount(centralID);
	}
}

async function deleteProjectRecord(projectRecordName) {
	try {
		await deleteClimbNote(projectRecordName);
	} catch (delErr) {
		console.error("Mark as Sent: project delete failed", delErr);
		alert(
			"Send saved, but the original project could not be deleted \u2014 please delete it manually.",
		);
	}
}

async function saveSend(closeOverlay) {
	const routeVal = document.getElementById("so-route").value.trim();
	const recordName =
		document.getElementById("so-record-name").value || undefined;
	const projectRecordName =
		document.getElementById("send-overlay").dataset.projectRecordName;
	const routeTypeVal = document.getElementById("so-routetype").value;
	const isGym = GYM_ROUTE_TYPES.has(routeTypeVal);

	// Gym notes are hard-gated from the central route DB (ADR 0005):
	// no central doc creation, no link (a converted note's link is
	// cleared), no rating/counter writes.
	if (isGym) overlayState.pendingNewCentralRoute = null;
	const centralID = isGym
		? null
		: await maybeCreateCentralRoute("so", routeVal);

	const savedRecordName =
		(await saveClimbNote(
			buildSendSavePayload({
			recordName,
			route: routeVal,
			climbingArea: document.getElementById("so-area").value,
			crag: document.getElementById("so-crag").value,
			difficulty: document.getElementById("so-difficulty").value,
			date: document.getElementById("so-date").value,
			sendType: document.getElementById("so-sendtype").value,
			routeType: routeTypeVal,
			rating: currentStarRating,
			noteText: document.getElementById("so-notes").value,
			// Multi-Pitch plan fields; {} for other types (merge-preserved)
			...multiPitchFieldsFromOverlay(
				document.getElementById("so-routetype"),
				"so-mp",
			),
			centralRouteID: centralID,
		}),
	)) || recordName;

	// Photos queued while the note did not exist yet (add overlay) —
	// uploaded now, mirroring the iOS NewLogOverlayView save flow.
	await flushPendingPhotos("so", savedRecordName);

	applySendRatingReports(centralID, { recordName, isGym });
	maybePropagateToRoute(centralID, "so", routeVal, isGym);
	applySendCounters(centralID, projectRecordName);
	if (projectRecordName) await deleteProjectRecord(projectRecordName);

	closeOverlay();
	await refreshData();
}

function bindSendOverlaySubmit(closeOverlay) {
	const btn = document.getElementById("send-overlay-save");
	btn.addEventListener("click", async () => {
		const routeVal = document.getElementById("so-route").value.trim();
		if (!routeVal) {
			markSendRouteError();
			return;
		}
		clearSendRouteError();

		btn.disabled = true;
		btn.textContent = "Saving\u2026";
		try {
			await saveSend(closeOverlay);
		} catch (err) {
			console.error("Save send failed:", err);
			alert("Save failed: " + (err.message ?? err));
		} finally {
			btn.disabled = false;
			btn.textContent = "Save Send";
		}
	});
}

function bindSendOverlayDelete(closeOverlay) {
	bindOverlayDeleteHandler({
		deleteBtnId: "send-overlay-delete",
		recordFieldId: "so-record-name",
		routeFieldId: "so-route",
		label: "Send",
		closeOverlay,
	});
}

// ---------- Inline ascent form ----------

/** Adds an ascent from the send overlay's inline ascent form. */
async function submitAscentFromOverlay() {
	const climbRecordName = document.getElementById("so-record-name").value;
	if (!climbRecordName) return;
	try {
		await saveAscent(
			buildAscentInput({
				date: document.getElementById("so-ascent-date").value,
				sendType: document.getElementById("so-ascent-type").value,
				notes: document.getElementById("so-ascent-notes").value,
				climbNoteRecordName: climbRecordName,
			}),
		);
		document.getElementById("so-ascent-date").value = "";
		document.getElementById("so-ascent-notes").value = "";
		document.getElementById("so-ascent-form").classList.add("hidden");
		document.getElementById("so-ascent-toggle").textContent = "+ Add";
		await refreshData();
		await renderAscentsList({ recordName: climbRecordName });
	} catch (err) {
		alert("Add ascent failed: " + (err.message ?? err));
	}
}

// ---------- Ascent list ----------

async function renderAscentsList(climb) {
	const container = document.getElementById("so-ascents-list");
	// Always fresh: the overlay should reflect ascents added elsewhere (e.g.
	// in the iOS app) since the last open.
	const ascents = await fetchAscents(climb.recordName);
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
			await renderAscentsList(climb);
		});
	});
}

function bindAscentForm() {
	document
		.getElementById("so-ascent-toggle")
		.addEventListener("click", function () {
			const form = document.getElementById("so-ascent-form");
			const isHidden = form.classList.toggle("hidden");
			this.textContent = isHidden ? "+ Add" : "\u2715";
		});

	document
		.getElementById("so-ascent-add")
		.addEventListener("click", submitAscentFromOverlay);
}

// ---------- Binding ----------

export function bindSendOverlayHandlers() {
	const closeOverlay = bindOverlayCommon({
		overlayId: "send-overlay",
		fieldPrefix: "so",
		findRouteBtnId: "find-route-btn-send",
	});

	// Route-type / style sync
	document.querySelectorAll("#so-style-tabs .style-tab").forEach((tab) => {
		tab.addEventListener("click", () => setStylePill(tab.dataset.style));
	});
	document
		.getElementById("so-routetype")
		.addEventListener("change", () => syncSendOverlayForRouteType(true));

	bindSendOverlaySubmit(closeOverlay);
	bindSendOverlayDelete(closeOverlay);
	bindAscentForm();

	document
		.getElementById("btn-log-send")
		.addEventListener("click", showAddSendOverlay);
	bindStarPicker();
}
