// training-ui.js — Training view: session detail modal, log-session overlay,
// session list rendering, and period filter. Moved out of ui.js as part of
// the new-UI refactor (docs/plan-uijs-refactor.md, Chunk 1).
//
// ui.js keeps only the view-switch wiring (showTrainingView) and the
// one-time handler binding (bindTrainingOverlayHandlers).

"use strict";

import {
	fetchTrainingSessions as $fetchTrainingSessions,
	saveTrainingSession as $saveTrainingSession,
	deleteTrainingSession as $deleteTrainingSession,
	fetchSessionSends as $fetchSessionSends,
	computeTrainingStats,
	TYPE_EMOJI,
} from "./firebase-training.js";
import {
	renderTrainingDetailHtml,
	buildSessionSendsTableHtml,
} from "./ui-theme.js";
import {
	setGymFields,
	syncGymFieldVisibility,
	addRouteLine,
	gymSessionFieldsForSave,
} from "./route-line-ui.js";

// ── Mutable service references (can be overridden by setTrainingMockServices) ──

let fetchTrainingSessions = $fetchTrainingSessions;
let saveTrainingSession = $saveTrainingSession;
let deleteTrainingSession = $deleteTrainingSession;
let fetchSessionSends = $fetchSessionSends;

/** Override the training services (mock mode — see ui.js setMockServices). */
export function setTrainingMockServices(mocks) {
	if (mocks.fetchTrainingSessions) fetchTrainingSessions = mocks.fetchTrainingSessions;
	if (mocks.saveTrainingSession) saveTrainingSession = mocks.saveTrainingSession;
	if (mocks.deleteTrainingSession) deleteTrainingSession = mocks.deleteTrainingSession;
	if (mocks.fetchSessionSends) fetchSessionSends = mocks.fetchSessionSends;
}

// ── Shims (ui.js exposes these on window; keeps the dependency one-way) ──

const escapeHtml = (...args) => window.escapeHtml(...args);
const showConfirmDialog = (...args) => window.showConfirmDialog(...args);
const hideDetailModal = () => window.hideDetailModal();

// ── Pure helpers ──

const GYM_SESSION_TYPE = "Gym Session";

/** Sessions belonging to a reporting period ("allTime" | "week" | "month" | "year"). */
export function filterSessionsByPeriod(sessions, period) {
	if (period === "allTime") return sessions;
	const now = new Date();
	if (period === "week") return sessions.filter((s) => withinLastWeek(s.date, now));
	if (period === "month") return sessions.filter((s) => withinMonth(s.date, now));
	if (period === "year") return sessions.filter((s) => withinYear(s.date, now));
	return sessions;
}

function withinLastWeek(date, now) {
	if (!date) return false;
	const weekStart = new Date(now);
	weekStart.setDate(now.getDate() - 7);
	return date >= weekStart;
}

function withinMonth(date, now) {
	return Boolean(date) &&
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth();
}

function withinYear(date, now) {
	return Boolean(date) && date.getFullYear() === now.getFullYear();
}

/** One session-row for the Training view list. */
export function sessionRowHtml(session) {
	const emoji = TYPE_EMOJI[session.type] || "🏋️";
	const dateStr = session.date
		? session.date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "—";
	const dots = [1, 2, 3, 4, 5]
		.map(
			(i) =>
				`<div class="intensity-dot${i <= (session.intensity ?? 0) ? " filled" : ""}"></div>`,
		)
		.join("");
	let meta = dateStr;
	if (session.gym) meta += ` · ${escapeHtml(session.gym)}`;
	if (session.notes) {
		const ellipsis = session.notes.length > 40 ? "…" : "";
		meta += ` · ${escapeHtml(session.notes.slice(0, 40))}${ellipsis}`;
	}
	return `<div class="session-row" data-record="${escapeHtml(session.recordName)}">
      <div class="type-icon">${emoji}</div>
      <div class="session-info">
        <div class="session-type">${escapeHtml(session.type)}</div>
        <div class="session-meta">${meta}</div>
      </div>
      <div class="session-right">
        <div class="intensity-dots">${dots}</div>
        <div class="session-duration">${session.duration} min</div>
      </div>
    </div>`;
}

// ── View toggle ──

function hideViews(ids) {
	ids.forEach((id) => document.getElementById(id)?.classList.add("hidden"));
}

function clearSidebarActive(ids) {
	ids.forEach((id) => document.getElementById(id)?.classList.remove("active"));
}

export function showTrainingView() {
	document.getElementById("stats-bar").classList.add("hidden");
	document.querySelector(".table-container").classList.add("hidden");
	document.getElementById("training-view").classList.remove("hidden");
	hideViews(["account-view", "stats-view", "admin-view"]);
	// Sidebar active state
	clearSidebarActive(["view-all", "view-projects", "view-sent", "view-account"]);
	document.getElementById("view-stats")?.classList.remove("active");
	document.getElementById("view-admin")?.classList.remove("active");
	document.querySelector('[data-view="training"]')?.classList.add("active");
	hideViews(["btn-log-send", "btn-add-project"]);
	loadTrainingData();
}

// ── Session detail modal ──

/** Fills the attached-sends section in the open session detail modal with
 * the linked climbs. sessionID links are authoritative — any same-day check
 * is iOS-only at attach time. */
async function updateSessionSends(sessionId) {
	const section = document.getElementById("session-sends-section");
	if (!section?.isConnected) return;
	try {
		const sends = await fetchSessionSends(sessionId);
		if (!section.isConnected) return; // modal closed while fetching
		section.classList.remove("train-sends-pending");
		section.innerHTML = sends.length
			? buildSessionSendsTableHtml(sends)
			: `<div class="insp-empty-row">No attached sends yet — link gym sends to this session in the iOS app.</div>`;
	} catch {
		section.innerHTML = `<div class="insp-empty-row">Attached sends: —</div>`;
	}
}

export function showTrainingDetailModal(session) {
	const overlay = document.getElementById("modal-overlay");
	const content = document.getElementById("modal-content");
	content.innerHTML = renderTrainingDetailHtml(session);
	overlay.style.display = "flex";
	document.body.style.overflow = "hidden";

	if (session.type === GYM_SESSION_TYPE) {
		updateSessionSends(session.id);
	}

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
	document.getElementById("to-date").value = new Date().toISOString().slice(0, 10);
	document.getElementById("to-duration").value = "60";
	document.getElementById("to-notes").value = "";
	setGymFields(null, null);
	syncGymFieldVisibility();
	setIntensity(3);
	document.getElementById("training-overlay-delete").classList.add("hidden");
	overlay.classList.remove("hidden");
}

export function showEditTrainingOverlay(session) {
	showAddTrainingOverlay();
	document.getElementById("training-overlay-title").textContent = "Edit Session";
	document.getElementById("to-record-name").value = session.recordName ?? "";
	document.getElementById("to-type").value = session.type ?? "Gym Session";
	document.getElementById("to-date").value = session.date
		? session.date.toISOString().slice(0, 10)
		: "";
	document.getElementById("to-duration").value = session.duration ?? 60;
	document.getElementById("to-notes").value = session.notes ?? "";
	setGymFields(session.gym, session.routes);
	syncGymFieldVisibility();
	setIntensity(session.intensity ?? 3);
	document.getElementById("training-overlay-delete").classList.remove("hidden");
}

/** Reads the current training-overlay form values into a save payload. */
export function sessionFormPayload() {
	const recordName =
		document.getElementById("to-record-name").value || undefined;
	const dateVal = document.getElementById("to-date").value;
	const activeIntensityBtns = document.querySelectorAll(
		".intensity-btn.active",
	);
	const lastActive = activeIntensityBtns.length
		? activeIntensityBtns[activeIntensityBtns.length - 1]
		: null;
	return {
		recordName,
		id: recordName ? undefined : crypto.randomUUID(),
		type: document.getElementById("to-type").value,
		date: dateVal ? new Date(dateVal) : new Date(),
		duration: Number(document.getElementById("to-duration").value),
		intensity: lastActive ? Number(lastActive.dataset.value) : 3,
		notes: document.getElementById("to-notes").value.trim() || null,
	};
}

function setIntensity(value) {
	document.querySelectorAll(".intensity-btn").forEach((btn) => {
		btn.classList.toggle("active", Number(btn.dataset.value) <= value);
	});
}

// ── Overlay handlers (one-time binding) ──

export function bindTrainingOverlayHandlers() {
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
		.getElementById("to-type")
		.addEventListener("change", syncGymFieldVisibility);
	document
		.getElementById("to-add-route")
		.addEventListener("click", () => addRouteLine());

	document
		.getElementById("training-overlay-save")
		.addEventListener("click", saveTrainingFromOverlay);
	document
		.getElementById("training-overlay-delete")
		.addEventListener("click", deleteTrainingFromOverlay);

	document
		.getElementById("btn-log-session")
		.addEventListener("click", showAddTrainingOverlay);

	document.getElementById("training-list").addEventListener("click", (e) => {
		const row = e.target.closest(".session-row");
		if (!row) return;
		const session = getSessionByRecordName(row.dataset.record);
		if (session) showTrainingDetailModal(session);
	});
}

async function saveTrainingFromOverlay() {
	const btn = document.getElementById("training-overlay-save");
	btn.disabled = true;
	btn.textContent = "Saving…";
	try {
		const payload = sessionFormPayload();
		await saveTrainingSession({
			...payload,
			...gymSessionFieldsForSave(payload.type),
		});
		document.getElementById("training-overlay").classList.add("hidden");
		trainingLoaded = false;
		await loadTrainingData();
	} catch (err) {
		alert("Save failed: " + (err.message ?? err));
	} finally {
		btn.disabled = false;
		btn.textContent = "Save Session";
	}
}

async function deleteTrainingFromOverlay() {
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
}

function getSessionByRecordName(recordName) {
	return allSessions.find((s) => s.recordName === recordName);
}

// ── Training data + rendering ──

let allSessions = [];
let trainingPeriod = "allTime";
let trainingLoaded = false;

export async function loadTrainingData() {
	if (trainingLoaded) {
		renderTrainingPage(allSessions, trainingPeriod);
		return;
	}
	await ensureTrainingSessionsLoaded();
	renderTrainingPage(allSessions, trainingPeriod);
}

/** Loads the session list once (no render side-effect) — used by showStatsView
 * in ui.js, which needs the session data but must not re-render Training. */
export async function ensureTrainingSessionsLoaded() {
	if (trainingLoaded) return allSessions;
	allSessions = await fetchTrainingSessions();
	window.allSessions = allSessions;
	// Mark loaded only after a successful fetch so a failure can retry on
	// the next Training view open.
	trainingLoaded = true;
	document.getElementById("badge-sessions").textContent = allSessions.length;
	return allSessions;
}

export function renderTrainingPage(sessions, period) {
	const stats = computeTrainingStats(sessions, period);

	document.getElementById("ts-total").textContent = stats.totalSessions;
	document.getElementById("ts-time").textContent = stats.formattedTotalTime(
		stats.totalMinutes,
	);
	document.getElementById("ts-days").textContent = stats.trainingDays;
	document.getElementById("ts-avg").textContent = stats.avgPerWeek.toFixed(1);

	const listEl = document.getElementById("training-list");
	const filtered = filterSessionsByPeriod(sessions, period);
	listEl.innerHTML =
		filtered
			.map((s) => sessionRowHtml(s))
			.join("") ||
		'<p style="color:#94a3b8;font-size:.875rem;padding:.5rem 0">No sessions in this period.</p>';
}

export function bindPeriodTabs() {
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
