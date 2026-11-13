// attempt-form-model.js — Pure, DOM-free helpers for the "Add Attempt" flow
// in the project overlay (iOS parity with AttemptLogView.swift; item #8 of
// docs/plan-new-ui-gui-followups.md).
//
// The DOM wiring lives in project-overlay-ui.js; everything here is testable
// without a document.

"use strict";

import { parseLocalDate, coercePitchCount } from "./ui-theme.js";

/**
 * Formats a duration in minutes as "2h 15m", "15m", or "0m".
 * Mirrors iOS DurationFormatter.label(forMinutes:).
 *
 * @param {number} minutes
 * @returns {string}
 */
export function durationLabel(minutes) {
	const mins = Math.max(0, Math.floor(Number(minutes) || 0));
	const hours = Math.floor(mins / 60);
	const rest = mins % 60;
	return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

/** Trim an optional string; "" / whitespace → null (matches the form-model
 * builders so a cleared plan field is stored as null, not ""). */
function emptyToNull(value) {
	return value?.trim() || null;
}

/** Attempt duration in minutes: clamped to 0–999 (iOS Stepper limit). */
function durationMinutesOf(value) {
	const n = Math.floor(Number(value) || 0);
	return Math.min(999, Math.max(0, n));
}

/** Attempt date as a Date; date-only strings parse as a LOCAL calendar date
 * (see parseLocalDate), falling back to now (iOS defaults to today). */
function attemptDateAsDate(value) {
	return parseLocalDate(value) ?? new Date();
}

/**
 * "Attempt #N - Nov 12, 2026 (2h 15m)" header + notes, mirroring the iOS
 * prepend: the duration suffix is only appended for failed tries with a
 * recorded duration.
 */
function buildAttemptEntry({ attemptNumber, date, durationMinutes, wasSuccessful, notes }) {
	let header = `Attempt #${attemptNumber} - ${date.toLocaleDateString("en-US", { dateStyle: "medium" })}`;
	if (durationMinutes > 0 && !wasSuccessful) {
		header += ` (${durationLabel(durationMinutes)})`;
	}
	return `${header}\n${notes ?? ""}\n\n`;
}

/**
 * Whether iOS prepends an attempt entry to the project notes: notes given,
 * or a failed try with a recorded duration (duration-only failed attempts
 * are logged too — that is what the header's duration suffix is for).
 */
function shouldPrependNotes({ notes, durationMinutes, wasSuccessful }) {
	return Boolean(notes) || (durationMinutes > 0 && !wasSuccessful);
}

/** Status after the attempt: success completes; nil status → "active". */
function projectStatusAfter(project, wasSuccessful) {
	return wasSuccessful ? "completed" : (project.projectStatus ?? "active");
}

/** Multi-Pitch plan fields only exist for Multi-Pitch routes. */
function isMultiPitch(project) {
	return project.routeType === "Multi-Pitch";
}

/** Plan fields pass through for Multi-Pitch routes (overlay edits must not
 * be lost when the attempt save rebuilds the doc); omitted otherwise so the
 * merge keeps the stored values. */
function multiPitchPassthrough(project) {
	if (!isMultiPitch(project)) return {};
	return {
		numberOfPitches: coercePitchCount(project.pitches),
		approachNotes: emptyToNull(project.approachNotes),
		descentNotes: emptyToNull(project.descentNotes),
		gearNotes: emptyToNull(project.gearNotes),
	};
}

/** On success the send date replaces the project's date; otherwise unchanged. */
function sendDateAfter(project, attemptDate, wasSuccessful) {
	return wasSuccessful ? attemptDate : (project.date ?? null);
}

/** On success with a recorded duration the send's climb duration is stored;
 * otherwise the previous value is kept (never cleared — iOS parity). */
function climbDurationAfter(project, durationMinutes, wasSuccessful) {
	if (wasSuccessful && durationMinutes > 0) {
		return durationMinutes;
	}
	return project.climbDuration ?? 0;
}

/**
 * Builds the saveClimbNote payload for logging one attempt against a project
 * (pure). Mirrors AttemptLogView.saveAttempt():
 *
 * - attemptCount += 1, lastAttemptDate = attempt date
 * - highPoint updated only when provided (otherwise preserved)
 * - "Attempt #N" entry prepended to the project notes
 * - status set to "active" if unset; on success "completed"
 * - on success: sendType "redpoint", send date = attempt date,
 *   climbDuration = duration when > 0 (fire-and-forget route counter is
 *   applied by the caller, not here)
 *
 * @param {object} project current project state (overlay fields + loaded
 *   climb): attempts, projectNotes, projectStatus, highPoint, date,
 *   centralRouteID, plus route/climbingArea/crag/difficulty/routeType
 *   passed through so the merged save does not clear them.
 * @param {object} attempt attempt input: attemptDate, durationMinutes,
 *   wasSuccessful, highPoint, notes
 */
export function buildAttemptFields(project, attempt) {
	const attemptCount = (Number(project.attempts) || 0) + 1;
	const date = attemptDateAsDate(attempt.attemptDate);
	const durationMinutes = durationMinutesOf(attempt.durationMinutes);
	const wasSuccessful = attempt.wasSuccessful === true;

	let projectNotes = project.projectNotes ?? null;
	if (shouldPrependNotes({ notes: attempt.notes, durationMinutes, wasSuccessful })) {
		const entry = buildAttemptEntry({
			attemptNumber: attemptCount,
			date,
			durationMinutes,
			wasSuccessful,
			notes: attempt.notes,
		});
		projectNotes = project.projectNotes ? entry + project.projectNotes : entry;
	}

	return {
		recordName: project.recordName || undefined,
		id: project.recordName ? undefined : crypto.randomUUID().toUpperCase(),
		route: project.route,
		climbingArea: project.climbingArea ?? null,
		crag: project.crag ?? null,
		difficulty: project.difficulty ?? null,
		routeType: project.routeType,
		noteText: emptyToNull(project.noteText) ?? "",
		centralRouteID: project.centralRouteID ?? null,
		reportedRating: 0, // projects never contribute to community rating

		attemptCount,
		lastAttemptDate: date,
		highPoint: emptyToNull(attempt.highPoint) ?? project.highPoint ?? null,
		projectNotes,
		...multiPitchPassthrough(project),
		projectStatus: projectStatusAfter(project, wasSuccessful),
		sendType: wasSuccessful ? "redpoint" : "Project",
		date: sendDateAfter(project, date, wasSuccessful),
		climbDuration: climbDurationAfter(project, durationMinutes, wasSuccessful),
	};
}

/**
 * Maps a loaded project climb (firebase-climbs fetch shape) to the project
 * state that buildAttemptFields expects — the Route Inspector pane's input
 * (item #10). The overlay assembles the same shape from its form fields
 * (attemptProjectStateFromOverlay in project-overlay-ui.js); Multi-Pitch plan
 * fields pass through via `pitches` (the multiPitchPassthrough contract).
 *
 * @param {object} climb
 * @returns {object}
 */
export function attemptProjectStateFromClimb(climb) {
	return {
		recordName: climb.recordName ?? null,
		route: climb.route ?? "",
		climbingArea: climb.climbingArea ?? null,
		crag: climb.crag ?? null,
		difficulty: climb.difficulty ?? null,
		routeType: climb.routeType ?? "Sport",
		centralRouteID: climb.centralRouteID ?? null,
		attempts: climb.attemptCount ?? 0,
		projectNotes: climb.projectNotes ?? null,
		projectStatus: climb.projectStatus ?? "active",
		highPoint: climb.highPoint ?? null,
		climbDuration: climb.climbDuration ?? 0,
		noteText: climb.noteText ?? "",
		pitches: climb.numberOfPitches,
		approachNotes: climb.approachNotes ?? null,
		descentNotes: climb.descentNotes ?? null,
		gearNotes: climb.gearNotes ?? null,
		date: climb.date ?? null,
	};
}

/**
 * Shared "log attempt" save pipeline (item #10): the project overlay's Log
 * Attempt section and the Route Inspector pane both build the payload with
 * buildAttemptFields, save it, fire-and-forget the central-route attempt
 * counter, and trigger the full data refresh — the two surfaces stay in sync
 * by construction. Services are injected so this stays DOM- and
 * Firebase-free and mockable.
 *
 * @param {object} projectState see buildAttemptFields
 * @param {object} attempt see buildAttemptFields
 * @param {{
 *   saveClimbNote: (payload: object) => Promise<void>,
 *   incrementAttemptCount?: (routeID: string) => void,
 *   refreshData: () => Promise<void>,
 * }} services
 * @returns {Promise<object>} the saved payload
 */
export async function saveAttempt(projectState, attempt, services) {
	const payload = buildAttemptFields(projectState, attempt);
	await services.saveClimbNote(payload);
	// Fire-and-forget: bump the central route's attempt counter (iOS parity).
	if (payload.centralRouteID && typeof services.incrementAttemptCount === "function") {
		services.incrementAttemptCount(payload.centralRouteID);
	}
	await services.refreshData();
	return payload;
}
