// send-form-model.js — Pure, DOM-free helpers for the send overlay form
// (unit-tested; docs/plan-uijs-refactor.md Chunk 2).
//
// The DOM wiring lives in send-overlay-ui.js; everything here is testable
// without a document.

"use strict";

import { parseLocalDate, coercePitchCount } from "./ui-theme.js";

/** Trim and collapse an optional string to null when empty. */
function emptyToNull(value) {
	return value?.trim() || null;
}

/** The community rating this note reports: only linked + rated notes count. */
function reportedRatingFor(centralRouteID, rating) {
	return centralRouteID && rating > 0 ? rating : 0;
}

/** Pitch count tolerance lives in ui-theme.js (coercePitchCount) — shared
 * with project-form-model.js and the attempt flow. */

/** style → CSS class for the send-overlay style tabs. */
export function stylePillClass(value) {
	const styleMap = {
		Redpoint: "active-rp",
		"On Sight": "active-os",
		"Top Rope": "active-tr",
		"All Free": "active-af",
		Pinkpoint: "active-pk",
		Flash: "active-fl",
		Top: "active-tp",
	};
	return styleMap[value] ?? "";
}

/**
 * Builds the saveClimbNote payload for the send overlay (pure).
 * Mirrors the iOS field semantics: optional fields collapse to null,
 * the date is parsed, and the reported community rating only counts
 * when the note is linked to a central route and actually rated.
 */
export function buildSendSavePayload(fields) {
	const { recordName, route, rating, centralRouteID } = fields;
	return {
		recordName: recordName || undefined,
		id: recordName ? undefined : crypto.randomUUID().toUpperCase(),
		route,
		climbingArea: emptyToNull(fields.climbingArea),
		crag: emptyToNull(fields.crag),
		difficulty: fields.difficulty || null,
		date: parseLocalDate(fields.date),
		sendType: fields.sendType,
		routeType: fields.routeType,
		// undefined → not written → a merge save keeps the stored value (the
		// caller omits the plan fields for non-Multi-Pitch types; iOS keeps
		// the plan data when the type flips back and forth).
		numberOfPitches:
			fields.pitches === undefined ? undefined : coercePitchCount(fields.pitches),
		approachNotes:
			fields.approachNotes === undefined
				? undefined
				: emptyToNull(fields.approachNotes),
		descentNotes:
			fields.descentNotes === undefined
				? undefined
				: emptyToNull(fields.descentNotes),
		gearNotes:
			fields.gearNotes === undefined ? undefined : emptyToNull(fields.gearNotes),
		rating,
		reportedRating: reportedRatingFor(centralRouteID, rating),
		noteText: emptyToNull(fields.noteText),
		centralRouteID: centralRouteID ?? null,
	};
}

/** Rating-retraction call for a route that previously reported a rating. */
function retractCall(routeID, previousRating) {
	return { routeID, rating: 0, previousRating };
}

/** New or changed link: retract the old route's rating (if any), then
 * report on the newly linked route. */
function relinkCalls({ centralID, originalCentralRouteID, previousRating, rating }) {
	const calls = [];
	if (originalCentralRouteID && previousRating > 0) {
		calls.push(retractCall(originalCentralRouteID, previousRating));
	}
	calls.push({ routeID: centralID, rating, previousRating: 0 });
	return calls;
}

/**
 * Community-rating delta for an edited send (pure). Returns the
 * reportRating calls to make: [{ routeID, rating, previousRating }].
 *
 * Mirrors iOS: same-route edits report a delta; clearing the link
 * retracts the previously reported rating; relinking retracts the old
 * route's rating and reports on the new one. New sends (no recordName)
 * carry their rating in the save payload's reportedRating instead.
 */
export function sendRatingReportCalls({
	centralID,
	originalCentralRouteID,
	previousReportedRating,
	rating,
}) {
	// Unchanged link: report the delta on that route.
	if (centralID && centralID === originalCentralRouteID) {
		return [{ routeID: centralID, rating, previousRating: previousReportedRating }];
	}
	// Link cleared: retract the previously reported rating, if any.
	if (!centralID) {
		if (originalCentralRouteID && previousReportedRating > 0) {
			return [retractCall(originalCentralRouteID, previousReportedRating)];
		}
		return [];
	}
	// New or changed link.
	return relinkCalls({
		centralID,
		originalCentralRouteID,
		previousRating: previousReportedRating,
		rating,
	});
}

/**
 * Builds the saveAscent input for the send overlay's inline ascent form
 * (pure). Default date = today; notes collapse to null when empty.
 */
export function buildAscentInput({
	id,
	date,
	sendType,
	notes,
	climbNoteRecordName,
}) {
	return {
		id: id ?? crypto.randomUUID(),
		date: parseLocalDate(date) ?? new Date(),
		sendType,
		notes: notes?.trim() || null,
		climbNoteRecordName,
	};
}
