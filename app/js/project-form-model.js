// project-form-model.js — Pure, DOM-free helpers for the project overlay
// form (unit-tested; docs/plan-uijs-refactor.md Chunk 3).
//
// The DOM wiring lives in project-overlay-ui.js; everything here is
// testable without a document.

"use strict";

import { parseLocalDate } from "./ui-theme.js";

/** Trim and collapse an optional string to null when empty. */
export function emptyToNull(value) {
	return value?.trim() || null;
}

/** Attempts field tolerance: "" / garbage → 0, negatives clamp to 0. */
export function coerceAttemptCount(raw) {
	const n = Number(raw);
	if (Number.isNaN(n)) return 0;
	return n < 0 ? 0 : Math.floor(n);
}

/**
 * Project dates must not be inverted: the last attempt cannot be before
 * the first attempt. Empty values are always valid (unknown dates).
 */
export function validateProjectDates(firstAttemptDate, lastAttemptDate) {
	if (!firstAttemptDate || !lastAttemptDate) return true;
	return new Date(lastAttemptDate) >= new Date(firstAttemptDate);
}

/** Route-count bookkeeping for a saved project: new projects increment,
 * edits that flip the status to abandoned decrement; anything else is a
 * no-op (mirrors iOS). Returns "increment" | "decrement" | null. */
export function projectCounterChange({ isNew, projectStatus }) {
	if (isNew) return "increment";
	if (projectStatus === "abandoned") return "decrement";
	return null;
}

/**
 * Builds the saveClimbNote payload for the project overlay (pure).
 * Projects never contribute to the community rating (reportedRating 0).
 */
export function buildProjectSavePayload(fields) {
	const { recordName, route, centralRouteID } = fields;
	return {
		recordName: recordName || undefined,
		id: recordName ? undefined : crypto.randomUUID().toUpperCase(),
		route,
		climbingArea: emptyToNull(fields.climbingArea),
		crag: emptyToNull(fields.crag),
		difficulty: fields.difficulty || null,
		sendType: "Project",
		date: parseLocalDate(fields.date),
		routeType: fields.routeType,
		attemptCount: coerceAttemptCount(fields.attempts),
		lastAttemptDate: parseLocalDate(fields.lastAttemptDate),
		highPoint: emptyToNull(fields.highPoint),
		projectStatus: fields.projectStatus,
		noteText: emptyToNull(fields.noteText),
		centralRouteID: centralRouteID ?? null,
		reportedRating: 0, // projects never contribute to community rating
	};
}
