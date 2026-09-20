// admin-routes-browser.js — Pure helpers for the admin routes browser.
//
// Deliberately Firestore-free so everything here is unit-testable with vitest.
// firebase-routes.js consumes these to assemble real queries; the descriptor
// shapes ({ kind: "where" | "orderBy" | "limit" | "startAfter", ... }) are
// mapped onto Firestore constraints by mapQueryDescriptors() there.
//
// Sort order is nameSearch asc (folded, locale-stable) — fixed for v1.

"use strict";

// ── Search folding ─────────────────────────────────────────────────────────
// Must stay identical to the iOS CentralRoute nameSearch/cragSearch folding
// (lowercased, diacritics stripped). Previously duplicated here and in
// firebase-routes.js; now exported once and reused.

export function foldedForSearch(str) {
	return (str || "")
		.toLowerCase()
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036f]/g, "");
}

// ── Search fields ────────────────────────────────────────────────────────────

/** UI field key → Firestore field. */
export const SEARCH_FIELD_MAP = {
	name: "nameSearch",
	crag: "cragSearch",
	area: "areaSearch",
};

/**
 * Firestore prefix-range bounds for a search term on a given field key.
 * Returns null when the term is empty (browse-all — no range constraints).
 *
 * @param {string} term raw search text
 * @param {string} field "name" | "crag" | "area"
 * @returns {{ field: string, lower: string, upper: string } | null}
 */
export function searchBounds(term, field) {
	const folded = foldedForSearch(term).trim();
	if (!folded) return null;
	const firestoreField = SEARCH_FIELD_MAP[field];
	if (!firestoreField) return null;
	return {
		field: firestoreField,
		lower: folded,
		upper: folded + "\uf8ff",
	};
}

// ── Query assembly ───────────────────────────────────────────────────────────

/**
 * Build the constraint descriptor list for a single route-list query.
 *
 * Equality filters appear in the fixed order isOrphaned → routeType → country,
 * matching the composite index declarations in firestore.indexes.json.
 * `isOrphaned` is always sent explicitly (true/false) so it is always part of
 * the query — set it to null only for count-free internal use.
 *
 * @param {{
 *   searchText?: string,
 *   searchField?: "name"|"crag"|"area",   // required when searchText is set
 *   routeType?: string|null,
 *   country?: string|null,
 *   isOrphaned?: boolean|null,
 *   pageSize?: number,
 * }} filters
 * @param {object|null} [cursorDoc] Firestore document snapshot to start after
 * @returns {Array<object>} constraint descriptors for mapQueryDescriptors()
 */
export function buildRouteQuery(filters, cursorDoc = null) {
	const {
		searchText = "",
		searchField,
		routeType = null,
		country = null,
		isOrphaned = null,
		pageSize = 25,
	} = filters;

	const bounds = searchBounds(searchText, searchField ?? "name");
	const firestoreField = bounds?.field ?? "nameSearch";

	const constraints = [];

	if (isOrphaned !== null && isOrphaned !== undefined) {
		constraints.push({
			kind: "where",
			field: "isOrphaned",
			op: "==",
			value: isOrphaned,
		});
	}
	if (routeType) {
		constraints.push({ kind: "where", field: "routeType", op: "==", value: routeType });
	}
	if (country) {
		constraints.push({ kind: "where", field: "country", op: "==", value: country });
	}
	if (bounds) {
		constraints.push(
			{ kind: "where", field: bounds.field, op: ">=", value: bounds.lower },
			{ kind: "where", field: bounds.field, op: "<", value: bounds.upper },
		);
	}

	constraints.push(
		{ kind: "orderBy", field: firestoreField, direction: "asc" },
		{ kind: "limit", count: pageSize },
	);
	if (cursorDoc) {
		constraints.push({ kind: "startAfter", doc: cursorDoc });
	}
	return constraints;
}

/**
 * Expand the "any" search field into the individual stream field keys.
 * Browse-all / no search text always sorts on nameSearch.
 *
 * @param {string} searchText
 * @param {string} searchField "any"|"name"|"crag"|"area"
 * @returns {string[]} stream keys ("name"|"crag"|"area")
 */
export function routeQueryStreamKeys(searchText, searchField) {
	const folded = foldedForSearch(searchText).trim();
	if (!folded) return ["name"];
	if (searchField && searchField !== "any" && SEARCH_FIELD_MAP[searchField]) {
		return [searchField];
	}
	return ["name", "crag", "area"];
}

/**
 * Map constraint descriptors onto real Firestore constraints.
 *
 * @param {Array<object>} descriptors from buildRouteQuery()
 * @param {object} fns Firestore constraint factories
 *   { where, orderBy, limit, startAfter }
 * @returns {Array} Firestore constraint instances
 */
export function mapQueryDescriptors(descriptors, fns) {
	return descriptors.map((d) => {
		switch (d.kind) {
			case "where":
				return fns.where(d.field, d.op, d.value);
			case "orderBy":
				return fns.orderBy(d.field, d.direction);
			case "limit":
				return fns.limit(d.count);
			case "startAfter":
				return fns.startAfter(d.doc);
			default:
				throw new Error(`Unknown constraint kind: ${d.kind}`);
		}
	});
}

// ── Stream merge ─────────────────────────────────────────────────────────────

/**
 * Merge parallel search-stream results: dedupe by id, sort by nameSearch
 * (folded asc, id tie-break), slice to one page.
 * Exhausted (empty) streams are simply contributions of zero rows.
 *
 * @param {Array<Array<object>>} streams arrays of route-shaped docs
 * @param {number} pageSize
 * @returns {object[]} merged page
 */
export function mergeRouteStreams(streams, pageSize = 25) {
	const seen = new Set();
	const merged = [];
	for (const stream of streams) {
		for (const route of stream ?? []) {
			if (seen.has(route.id)) continue;
			seen.add(route.id);
			merged.push(route);
		}
	}
	merged.sort(
		(a, b) =>
			(a.nameSearch ?? "").localeCompare(b.nameSearch ?? "") ||
			(a.id ?? "").localeCompare(b.id ?? ""),
	);
	return merged.slice(0, pageSize);
}
