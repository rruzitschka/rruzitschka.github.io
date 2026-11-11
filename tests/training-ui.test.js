/**
 * Tests for training-ui.js pure helpers — filterSessionsByPeriod.
 *
 * training-ui.js pulls in firebase-training.js (Firestore), so mock it
 * using the established pattern (see AGENTS.md / recentEdits.test.js).
 */
import { describe, it, expect, vi } from "vitest";

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

import { filterSessionsByPeriod } from "../app/js/training-ui.js";

function d(y, m, day) {
	return new Date(y, m, day);
}

describe("filterSessionsByPeriod", () => {
	it("returns all sessions for allTime", () => {
		const sessions = [{ date: d(2020, 0, 1) }, { date: null }];
		expect(filterSessionsByPeriod(sessions, "allTime")).toHaveLength(2);
	});

	it("week filter keeps sessions from the last 7 days only", () => {
		const sessions = [
			{ date: d(2026, 10, 11) }, // today
			{ date: d(2026, 10, 5) }, // 6 days ago
			{ date: d(2026, 10, 4) }, // 7 days ago → outside
			{ date: d(2025, 0, 1) },
		];
		const filtered = filterSessionsByPeriod(sessions, "week");
		expect(filtered).toHaveLength(2);
		expect(filtered[0].date).toEqual(d(2026, 10, 11));
	});

	it("month filter keeps sessions in the current calendar month", () => {
		const sessions = [
			{ date: d(2026, 10, 1) },
			{ date: d(2026, 9, 30) }, // previous month
			{ date: d(2026, 9, 15) },
		];
		expect(filterSessionsByPeriod(sessions, "month")).toHaveLength(1);
	});

	it("year filter keeps sessions in the current year", () => {
		const sessions = [
			{ date: d(2026, 0, 1) },
			{ date: d(2026, 11, 31) },
			{ date: d(2025, 5, 1) },
		];
		expect(filterSessionsByPeriod(sessions, "year")).toHaveLength(2);
	});

	it("drops sessions without a date in period filters", () => {
		const sessions = [{ date: null }, { date: d(2026, 10, 10) }];
		expect(filterSessionsByPeriod(sessions, "month")).toHaveLength(1);
	});

	it("returns all sessions for unknown periods", () => {
		const sessions = [{ date: d(2020, 0, 1) }];
		expect(filterSessionsByPeriod(sessions, "quux")).toHaveLength(1);
	});
});
