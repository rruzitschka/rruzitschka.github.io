// tests/climb-table-ui.test.js — pure helpers extracted from ui.js in the
// Chunk 5 refactor (docs/plan-uijs-refactor.md).

import { describe, it, expect, vi } from "vitest";

// climb-table-ui.js pulls in firebase-climbs/firebase-routes (Firestore), so
// mock them using the established pattern (see training-ui.test.js).
vi.mock("firebase/firestore", () => ({
	collection: vi.fn(),
	collectionGroup: vi.fn(),
	doc: vi.fn(),
	getDoc: vi.fn(),
	getDocs: vi.fn(async () => ({ docs: [] })),
	query: vi.fn(),
	where: vi.fn(),
	orderBy: vi.fn(),
	limit: vi.fn(),
	addDoc: vi.fn(),
	setDoc: vi.fn(),
	updateDoc: vi.fn(),
	deleteDoc: vi.fn(),
	serverTimestamp: vi.fn(),
	Timestamp: { fromDate: vi.fn((x) => x), now: vi.fn() },
}));

vi.mock("../app/js/firebase-config.js", () => ({
	db: {},
	auth: { currentUser: null },
}));

vi.mock("../app/js/firebase-auth.js", () => ({
	getCurrentUser: () => ({ uid: "test-uid" }),
}));

import {
	gradeBadgeClass,
	formatDate,
	setRouteData,
	setClimbTableMockServices,
} from "../app/js/climb-table-ui.js";

// Minimal grade arrays — relative order matters, absolute content doesn't.
const GRADES = {
	French: ["4a", "6a", "7a", "8a", "8b", "8b+", "9a"],
	UIAA: ["4", "6", "7", "10", "11", "11+", "12"],
	YDS: ["5.6", "5.10a", "5.12a", "5.13d", "5.14a", "5.15a"],
};

describe("gradeBadgeClass", () => {
	it("returns grade-normal for empty/unknown difficulties", () => {
		expect(gradeBadgeClass("", GRADES)).toBe("grade-normal");
		expect(gradeBadgeClass(null, GRADES)).toBe("grade-normal");
		expect(gradeBadgeClass(undefined, GRADES)).toBe("grade-normal");
		expect(gradeBadgeClass("7c+", GRADES)).toBe("grade-normal"); // not in test arrays
	});

	it("marks the hard threshold in the French system (≥ 8b+)", () => {
		expect(gradeBadgeClass("8b", GRADES)).toBe("grade-normal");
		expect(gradeBadgeClass("8b+", GRADES)).toBe("grade-hard");
		expect(gradeBadgeClass("9a", GRADES)).toBe("grade-hard");
	});

	it("marks the hard threshold in the UIAA system (≥ 11+)", () => {
		expect(gradeBadgeClass("11", GRADES)).toBe("grade-normal");
		expect(gradeBadgeClass("11+", GRADES)).toBe("grade-hard");
		expect(gradeBadgeClass("12", GRADES)).toBe("grade-hard");
	});

	it("marks the hard threshold in the YDS system (≥ 5.14a)", () => {
		expect(gradeBadgeClass("5.13d", GRADES)).toBe("grade-normal");
		expect(gradeBadgeClass("5.14a", GRADES)).toBe("grade-hard");
		expect(gradeBadgeClass("5.15a", GRADES)).toBe("grade-hard");
	});

	it("matches whichever system contains the difficulty first", () => {
		// A difficulty present in two arrays takes the French match.
		expect(gradeBadgeClass("8a", GRADES)).toBe("grade-normal");
	});
});

describe("formatDate", () => {
	it("renders en-US short month format", () => {
		expect(formatDate(new Date(2026, 0, 5))).toBe("Jan 5, 2026");
	});

	it("returns an em dash for falsy input", () => {
		expect(formatDate(null)).toBe("—");
		expect(formatDate(undefined)).toBe("—");
	});
});

describe("mock/service wiring", () => {
	it("setRouteData replaces the route maps without throwing", () => {
		expect(() =>
			setRouteData({
				ratings: new Map([["r1", 3]]),
				gps: new Map(),
				countries: new Map(),
			}),
		).not.toThrow();
	});

	it("setClimbTableMockServices accepts partial mocks", () => {
		expect(() => setClimbTableMockServices({ fetchPhotos: async () => [] })).not.toThrow();
		expect(() => setClimbTableMockServices({})).not.toThrow();
	});
});
