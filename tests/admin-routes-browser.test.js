/**
 * Tests for admin-routes-browser.js — pure helpers behind the admin routes
 * browser (paginated list with filters + combined search).
 * The module is Firestore-free, so no mocking is needed.
 */
import { describe, it, expect } from "vitest";

import {
	foldedForSearch,
	SEARCH_FIELD_MAP,
	searchBounds,
	buildRouteQuery,
	routeQueryStreamKeys,
	mapQueryDescriptors,
	mergeRouteStreams,
} from "../app/js/admin-routes-browser.js";

// ── foldedForSearch ──────────────────────────────────────────────────────────

describe("foldedForSearch()", () => {
	it("lowercases and strips diacritics", () => {
		expect(foldedForSearch("Café Mühlbach")).toBe("cafe muhlbach");
	});

	it("returns empty string for null/undefined", () => {
		expect(foldedForSearch(null)).toBe("");
		expect(foldedForSearch(undefined)).toBe("");
	});
});

// ── searchBounds ─────────────────────────────────────────────────────────────

describe("searchBounds()", () => {
	it("returns prefix bounds folded, upper bound uses \\uf8ff", () => {
		expect(searchBounds("Café", "name")).toEqual({
			field: "nameSearch",
			lower: "cafe",
			upper: "cafe\uf8ff",
		});
	});

	it("maps field keys to Firestore fields", () => {
		expect(searchBounds("x", "crag").field).toBe("cragSearch");
		expect(searchBounds("x", "area").field).toBe("areaSearch");
	});

	it("returns null for empty/whitespace terms (browse-all)", () => {
		expect(searchBounds("", "name")).toBeNull();
		expect(searchBounds("   ", "crag")).toBeNull();
	});

	it("returns null for unknown field keys", () => {
		expect(searchBounds("x", "bogus")).toBeNull();
	});

	it("SEARCH_FIELD_MAP covers all three fields", () => {
		expect(Object.keys(SEARCH_FIELD_MAP).sort()).toEqual(["area", "crag", "name"]);
	});
});

// ── buildRouteQuery ──────────────────────────────────────────────────────────

describe("buildRouteQuery()", () => {
	it("browse-all: no filters, no search → nameSearch orderBy + limit only", () => {
		const c = buildRouteQuery({ pageSize: 25 });
		expect(c).toEqual([
			{ kind: "orderBy", field: "nameSearch", direction: "asc" },
			{ kind: "limit", count: 25 },
		]);
	});

	it("orphaned-only browse: isOrphaned equality before orderBy", () => {
		const c = buildRouteQuery({ isOrphaned: true, pageSize: 25 });
		expect(c[0]).toEqual({ kind: "where", field: "isOrphaned", op: "==", value: true });
		expect(c[1]).toEqual({ kind: "orderBy", field: "nameSearch", direction: "asc" });
	});

	it("equality filters in index order isOrphaned → routeType → country", () => {
		const c = buildRouteQuery({
			isOrphaned: false,
			routeType: "Sport",
			country: "AT",
			pageSize: 25,
		});
		const fields = c.filter((d) => d.kind === "where").map((d) => d.field);
		expect(fields).toEqual(["isOrphaned", "routeType", "country"]);
	});

	it("search text adds folded prefix range wheres on the right field", () => {
		const c = buildRouteQuery({ searchText: "Café", searchField: "crag", pageSize: 25 });
		const wheres = c.filter((d) => d.kind === "where");
		expect(wheres).toContainEqual({
			kind: "where",
			field: "cragSearch",
			op: ">=",
			value: "cafe",
		});
		expect(wheres).toContainEqual({
			kind: "where",
			field: "cragSearch",
			op: "<",
			value: "cafe\uf8ff",
		});
		// range wheres come after equality filters, before orderBy
		const kinds = c.map((d) => d.kind);
		expect(kinds.indexOf("orderBy")).toBeGreaterThan(kinds.lastIndexOf("where"));
	});

	it("explicit field search without bounds still orders on that field", () => {
		const c = buildRouteQuery({ searchText: "", searchField: "area", pageSize: 25 });
		expect(c.find((d) => d.kind === "orderBy").field).toBe("nameSearch");
	});

	it("cursor doc appends startAfter last", () => {
		const cursor = { id: "abc" };
		const c = buildRouteQuery({ pageSize: 25 }, cursor);
		expect(c[c.length - 1]).toEqual({ kind: "startAfter", doc: cursor });
	});

	it("default pageSize is 25", () => {
		expect(buildRouteQuery({}).find((d) => d.kind === "limit").count).toBe(25);
	});
});

// ── routeQueryStreamKeys ─────────────────────────────────────────────────────

describe("routeQueryStreamKeys()", () => {
	it("no search text → single name stream (browse-all)", () => {
		expect(routeQueryStreamKeys("", "any")).toEqual(["name"]);
	});

	it("any → three parallel streams", () => {
		expect(routeQueryStreamKeys("wand", "any")).toEqual(["name", "crag", "area"]);
	});

	it("explicit field → single stream", () => {
		expect(routeQueryStreamKeys("wand", "area")).toEqual(["area"]);
	});

	it("unknown field falls back to three streams", () => {
		expect(routeQueryStreamKeys("wand", "bogus")).toEqual(["name", "crag", "area"]);
	});
});

// ── mapQueryDescriptors ──────────────────────────────────────────────────────

describe("mapQueryDescriptors()", () => {
	const fns = {
		where: (...a) => ({ fn: "where", a }),
		orderBy: (...a) => ({ fn: "orderBy", a }),
		limit: (...a) => ({ fn: "limit", a }),
		startAfter: (...a) => ({ fn: "startAfter", a }),
	};

	it("maps every descriptor kind", () => {
		const mapped = mapQueryDescriptors(
			buildRouteQuery({ searchText: "ab", searchField: "name", pageSize: 5 }, { id: "x" }),
			fns,
		);
		expect(mapped[mapped.length - 1].fn).toBe("startAfter");
		expect(mapped.some((m) => m.fn === "where")).toBe(true);
		expect(mapped.some((m) => m.fn === "orderBy")).toBe(true);
		expect(mapped.some((m) => m.fn === "limit")).toBe(true);
	});

	it("throws on unknown kind", () => {
		expect(() => mapQueryDescriptors([{ kind: "bogus" }], fns)).toThrow(/bogus/);
	});
});

// ── mergeRouteStreams ────────────────────────────────────────────────────────

function route(id, nameSearch, extra = {}) {
	return { id, nameSearch, ...extra };
}

describe("mergeRouteStreams()", () => {
	it("returns empty array for empty input", () => {
		expect(mergeRouteStreams([], 25)).toEqual([]);
	});

	it("dedupes by id across streams", () => {
		const merged = mergeRouteStreams(
			[[route("r1", "alps")], [route("r1", "alps"), route("r2", "berg")]],
			25,
		);
		expect(merged.map((r) => r.id)).toEqual(["r1", "r2"]);
	});

	it("sorts merged result by nameSearch regardless of stream order", () => {
		const merged = mergeRouteStreams(
			[[route("b", "berg")], [route("a", "alps"), route("c", "cafe")]],
			25,
		);
		expect(merged.map((r) => r.id)).toEqual(["a", "b", "c"]);
	});

	it("slices to one page", () => {
		const many = Array.from({ length: 40 }, (_, i) => route(`r${i}`, `n${String(i).padStart(3, "0")}`));
		expect(mergeRouteStreams([many], 25)).toHaveLength(25);
		expect(mergeRouteStreams([many], 25)[24].id).toBe("r24");
	});

	it("exhausted (empty) streams contribute nothing", () => {
		const merged = mergeRouteStreams([[], [route("a", "alps")], []], 25);
		expect(merged.map((r) => r.id)).toEqual(["a"]);
	});

	it("uses id as tie-break for equal nameSearch", () => {
		const merged = mergeRouteStreams([[route("zz", "same"), route("aa", "same")]], 25);
		expect(merged.map((r) => r.id)).toEqual(["aa", "zz"]);
	});
});
