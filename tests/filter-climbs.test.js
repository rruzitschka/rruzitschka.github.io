// tests/filter-climbs.test.js — filterClimbs grouping rules. The Gym filter
// covers gym routes AND gym boulders (one chip, iOS gym feature); every
// other route type is a strict match.

import { describe, it, expect, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
	collection: vi.fn(),
	doc: vi.fn(),
	getDocs: vi.fn(),
	setDoc: vi.fn(),
	updateDoc: vi.fn(),
	query: vi.fn(),
	orderBy: vi.fn(),
	where: vi.fn(),
	serverTimestamp: vi.fn(),
	Timestamp: { fromDate: vi.fn((d) => d) },
}));
vi.mock("../app/js/firebase-config.js", () => ({ db: {} }));
vi.mock("../app/js/firebase-auth.js", () => ({
	getCurrentUser: () => ({ uid: "test-uid" }),
}));

import {
	filterClimbs,
	matchesRouteTypeFilter,
} from "../app/js/firebase-climbs.js";

const CLIMBS = [
	{ route: "Gym Route", routeType: "Gym", date: new Date("2026-01-01") },
	{ route: "Gym Boulder", routeType: "Gym Boulder", date: new Date("2026-02-01") },
	{ route: "Crag Route", routeType: "Sport", date: new Date("2026-03-01") },
	{ route: "Big Wall", routeType: "Multi-Pitch", date: new Date("2026-04-01") },
];

describe("filterClimbs — Gym groups Gym + Gym Boulder", () => {
	it("returns gym routes and gym boulders for the Gym filter", () => {
		const routes = filterClimbs(CLIMBS, { routeType: "Gym" }).map(
			(c) => c.route,
		);
		expect(routes).toEqual(["Gym Boulder", "Gym Route"]); // date desc
	});

	it("matches every other route type strictly", () => {
		expect(
			filterClimbs(CLIMBS, { routeType: "Sport" }).map((c) => c.route),
		).toEqual(["Crag Route"]);
		expect(
			filterClimbs(CLIMBS, { routeType: "Multi-Pitch" }).map((c) => c.route),
		).toEqual(["Big Wall"]);
		expect(
			filterClimbs(CLIMBS, { routeType: "Gym Boulder" }).map((c) => c.route),
		).toEqual(["Gym Boulder"]);
	});

	it("returns everything without a route-type filter", () => {
		expect(filterClimbs(CLIMBS, {})).toHaveLength(4);
	});
});

describe("matchesRouteTypeFilter (pure)", () => {
	it("no filter matches everything", () => {
		expect(matchesRouteTypeFilter("Sport", "")).toBe(true);
		expect(matchesRouteTypeFilter("Sport", undefined)).toBe(true);
	});

	it("Gym matches both gym variants, everything else strictly", () => {
		expect(matchesRouteTypeFilter("Gym", "Gym")).toBe(true);
		expect(matchesRouteTypeFilter("Gym Boulder", "Gym")).toBe(true);
		expect(matchesRouteTypeFilter("Sport", "Gym")).toBe(false);
		expect(matchesRouteTypeFilter("Gym Boulder", "Gym Boulder")).toBe(true);
		expect(matchesRouteTypeFilter("Gym", "Boulder")).toBe(false);
	});
});
