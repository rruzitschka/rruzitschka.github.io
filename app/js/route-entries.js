// route-entries.js — Warm-up route entries embedded in a "Gym Session"
// TrainingSession as a JSON-encoded array (Firestore string field `routes`).
//
// Wire format mirrors the iOS app's TrainingRouteEntry (see
// ClimbingNotes/TrainingRouteEntry.swift): an array of
// {id, grade, style, outcome, order} objects encoded with Swift's
// JSONEncoder defaults (no whitespace, no key transforms). Key order here
// matches the iOS property declaration order so payloads are byte-for-byte
// comparable.
//
// Decoding is tolerant: malformed entries are skipped instead of failing the
// whole array, so a corrupted or partially-changed document never loses the
// well-formed entries.
//
// Firestore-free and DOM-free so it stays vitest-testable.

/** Style raw values as stored by iOS (hyphenated "top-rope"). */
export const ROUTE_STYLES = ["lead", "top-rope"];
/** Outcome raw values. "attempt" exists in the data model (and iOS decode)
 * but is not offered in either UI. */
export const ROUTE_OUTCOMES = ["sent", "failed", "attempt"];

/** Build a normalized entry object with iOS wire-format key order. */
function normalizeEntry(entry) {
	return {
		id: entry.id,
		grade: entry.grade,
		style: entry.style,
		outcome: entry.outcome,
		order: entry.order,
	};
}

function isPlainObject(e) {
	return e !== null && typeof e === "object" && !Array.isArray(e);
}

/** An entry decodes iff it matches the iOS TrainingRouteEntry shape. */
function isDecodableEntry(e) {
	return (
		isPlainObject(e) &&
		typeof e.id === "string" &&
		e.id.length > 0 &&
		typeof e.grade === "string" &&
		ROUTE_STYLES.includes(e.style) &&
		ROUTE_OUTCOMES.includes(e.outcome) &&
		Number.isInteger(e.order)
	);
}

/**
 * Decodes a session's `routes` JSON string. Malformed entries are skipped;
 * a completely malformed payload yields an empty array.
 */
export function decodeRouteEntries(json) {
	if (typeof json !== "string" || !json) return [];
	let raw;
	try {
		raw = JSON.parse(json);
	} catch {
		return [];
	}
	if (!Array.isArray(raw)) return [];
	return raw.filter(isDecodableEntry).map(normalizeEntry);
}

/**
 * Applies the iOS GymSessionWizard save semantics: drop entries with
 * empty/whitespace grades and renumber `order` by final insertion order.
 */
export function sanitizeRouteEntries(entries) {
	if (!Array.isArray(entries)) return [];
	return entries
		.filter((e) => e !== null && typeof e === "object")
		.map((e) => ({
			id: e.id ?? crypto.randomUUID().toUpperCase(),
			grade: typeof e.grade === "string" ? e.grade.trim() : "",
			style: ROUTE_STYLES.includes(e.style) ? e.style : "lead",
			outcome: ROUTE_OUTCOMES.includes(e.outcome) ? e.outcome : "attempt",
			order: 0,
		}))
		.filter((e) => e.grade.length > 0)
		.map((e, index) => ({ ...e, order: index }));
}

/**
 * Encodes route entries to the `routes` JSON string. Returns null for an
 * empty list (iOS stores nil when there are no warm-up routes).
 */
export function encodeRouteEntries(entries) {
	const sanitized = sanitizeRouteEntries(entries);
	if (!sanitized.length) return null;
	return JSON.stringify(sanitized.map(normalizeEntry));
}
