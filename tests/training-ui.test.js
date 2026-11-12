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

/** Relative to the current date so the tests never go stale. */
function d(yearOffset, month, day) {
	const now = new Date();
	return new Date(now.getFullYear() + yearOffset, month, day);
}

describe("filterSessionsByPeriod", () => {
	it("returns all sessions for allTime", () => {
		const sessions = [{ date: d(2020, 0, 1) }, { date: null }];
		expect(filterSessionsByPeriod(sessions, "allTime")).toHaveLength(2);
	});

	it("week filter keeps sessions from the last 7 days only", () => {
		const now = new Date();
		const daysAgo = (n) => {
			const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			d.setDate(d.getDate() - n);
			return d;
		};
		const sessions = [
			{ date: daysAgo(0) }, // today
			{ date: daysAgo(6) }, // 6 days ago
			{ date: daysAgo(8) }, // 8 days ago → outside
			{ date: daysAgo(400) },
		];
		const filtered = filterSessionsByPeriod(sessions, "week");
		expect(filtered).toHaveLength(2);
		expect(filtered[0].date).toEqual(daysAgo(0));
	});

	it("month filter keeps sessions in the current calendar month", () => {
		const now = new Date();
		const sessions = [
			{ date: new Date(now.getFullYear(), now.getMonth(), 1) },
			{ date: d(0, 0, 1) }, // some January date
		];
		const inMonth = sessions.filter(
			(s) =>
				s.date.getFullYear() === now.getFullYear() &&
				s.date.getMonth() === now.getMonth(),
		);
		expect(filterSessionsByPeriod(sessions, "month")).toHaveLength(inMonth.length);
	});

	it("year filter keeps sessions in the current year", () => {
		const now = new Date();
		const sessions = [
			{ date: new Date(now.getFullYear(), 0, 1) },
			{ date: new Date(now.getFullYear(), 11, 31) },
			{ date: new Date(now.getFullYear() - 1, 5, 1) },
		];
		expect(filterSessionsByPeriod(sessions, "year")).toHaveLength(2);
	});

	it("drops sessions without a date in period filters", () => {
		const sessions = [{ date: null }, { date: new Date() }];
		expect(filterSessionsByPeriod(sessions, "month")).toHaveLength(1);
	});

	it("returns all sessions for unknown periods", () => {
		const sessions = [{ date: d(2020, 0, 1) }];
		expect(filterSessionsByPeriod(sessions, "quux")).toHaveLength(1);
	});
});
