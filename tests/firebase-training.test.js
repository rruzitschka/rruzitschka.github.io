/**
 * Tests for firebase-training.js gym-session fields (iOS 4.0 wire format):
 * `gym` and `routes` (JSON array of TrainingRouteEntry) survive a
 * save → fetch round-trip, malformed entries are ignored on read, and the
 * iOS save semantics (skip empty grades, renumber order) hold on write.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firestore mock ────────────────────────────────────────────────────────

const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockQuery = vi.fn((...args) => ({ _args: args }));
const mockCollection = vi.fn((db, path) => ({ _path: path }));
const mockDoc = vi.fn((db, path) => ({ _path: path }));
const mockServerTimestamp = vi.fn(() => ({ _serverTimestamp: true }));
const mockTimestamp = { fromDate: vi.fn((d) => d) };

vi.mock("firebase/firestore", () => ({
	getDocs: (...a) => mockGetDocs(...a),
	setDoc: (...a) => mockSetDoc(...a),
	query: (...a) => mockQuery(...a),
	collection: (...a) => mockCollection(...a),
	doc: (...a) => mockDoc(...a),
	updateDoc: vi.fn(),
	serverTimestamp: (...a) => mockServerTimestamp(...a),
	Timestamp: { fromDate: (d) => mockTimestamp.fromDate(d) },
	orderBy: vi.fn(),
	where: vi.fn(),
}));

vi.mock("../app/js/firebase-config.js", () => ({ db: {} }));
vi.mock("../app/js/firebase-auth.js", () => ({
	getCurrentUser: () => ({ uid: "test-uid" }),
}));

// ── import SUT after mocks are in place ───────────────────────────────────
import {
	fetchTrainingSessions,
	saveTrainingSession,
	computeTrainingStats,
} from "../app/js/firebase-training.js";

function makeSnap(rows) {
	return {
		docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
	};
}

const DATE = new Date("2025-01-15T10:00:00Z");
const SESSION_DOC = {
	id: "SESSION-1",
	type: "Gym Session",
	date: { toDate: () => DATE },
	duration: 90,
	intensity: 4,
	notes: "felt strong",
	gym: "Kletterhalle Wien",
	routes:
		'[{"id":"A1","grade":"5","style":"lead","outcome":"sent","order":0},{"id":"A2","grade":"6b","style":"top-rope","outcome":"failed","order":1}]',
	updatedAt: { toDate: () => DATE },
};

describe("fetchTrainingSessions — gym fields", () => {
	beforeEach(() => {
		mockGetDocs.mockReset();
	});

	it("maps gym and decodes the routes JSON string", async () => {
		mockGetDocs.mockResolvedValue(makeSnap([{ id: "S1", data: SESSION_DOC }]));
		const sessions = await fetchTrainingSessions();
		expect(sessions[0].gym).toBe("Kletterhalle Wien");
		expect(sessions[0].routes).toEqual([
			{ id: "A1", grade: "5", style: "lead", outcome: "sent", order: 0 },
			{
				id: "A2",
				grade: "6b",
				style: "top-rope",
				outcome: "failed",
				order: 1,
			},
		]);
	});

	it("ignores malformed route entries but keeps well-formed ones", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{
					id: "S1",
					data: {
						...SESSION_DOC,
						routes: JSON.stringify([
							{ id: "A1", grade: "5", style: "lead", outcome: "sent", order: 0 },
							{ broken: true },
							"junk",
							{ id: "A9", grade: "7a", style: "lead", outcome: "sent", order: 1 },
						]),
					},
				},
			]),
		);
		const sessions = await fetchTrainingSessions();
		expect(sessions[0].routes).toHaveLength(2);
		expect(sessions[0].routes[1].grade).toBe("7a");
	});

	it("defaults gym/routes on legacy sessions without the fields", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{
					id: "S1",
					data: { id: "S1", type: "Hangboard", date: { toDate: () => DATE } },
				},
			]),
		);
		const sessions = await fetchTrainingSessions();
		expect(sessions[0].gym).toBeNull();
		expect(sessions[0].routes).toEqual([]);
	});
});

describe("saveTrainingSession — gym fields", () => {
	beforeEach(() => {
		mockSetDoc.mockReset();
	});

	it("writes gym and the routes JSON string with renumbered order", async () => {
		await saveTrainingSession({
			id: "NEW-UUID",
			type: "Gym Session",
			date: DATE,
			gym: "  Kletterhalle Wien  ",
			routes: [
				{ id: "A1", grade: "5", style: "lead", outcome: "sent", order: 5 },
				{ id: "A2", grade: "   ", style: "lead", outcome: "sent", order: 6 },
				{ id: "A3", grade: "6b", style: "top-rope", outcome: "failed", order: 7 },
			],
		});
		const docData = mockSetDoc.mock.calls[0][1];
		expect(docData.gym).toBe("Kletterhalle Wien");
		expect(docData.routes).toBe(
			'[{"id":"A1","grade":"5","style":"lead","outcome":"sent","order":0},{"id":"A3","grade":"6b","style":"top-rope","outcome":"failed","order":1}]',
		);
	});

	it("writes null routes and null gym for an empty gym session", async () => {
		await saveTrainingSession({
			id: "NEW-UUID",
			type: "Gym Session",
			date: DATE,
			gym: "",
			routes: [],
		});
		const docData = mockSetDoc.mock.calls[0][1];
		expect(docData.gym).toBeNull();
		expect(docData.routes).toBeNull();
	});

	it("does not touch gym fields for other session types", async () => {
		await saveTrainingSession({
			id: "NEW-UUID",
			type: "Hangboard",
			date: DATE,
		});
		const docData = mockSetDoc.mock.calls[0][1];
		expect(docData.gym).toBeUndefined();
		expect(docData.routes).toBeUndefined();
	});
});

describe("computeTrainingStats — period windows", () => {
	const DAY = 24 * 60 * 60 * 1000;
	const session = (daysAgo, type = "Gym Session") => ({
		type,
		duration: 60,
		intensity: 3,
		date: new Date(Date.now() - daysAgo * DAY),
	});

	it("counts all sessions for allTime", () => {
		const s = computeTrainingStats([session(400), session(2)], "allTime");
		expect(s.totalSessions).toBe(2);
	});

	it("week window: only the last 7 days", () => {
		const sessions = [session(2), session(8)];
		expect(computeTrainingStats(sessions, "week").totalSessions).toBe(1);
	});

	it("month window: current calendar month", () => {
		const now = new Date();
		const sessions = [
			{ ...session(0), date: new Date(now.getFullYear(), now.getMonth(), 1, 12) },
			{
				...session(0),
				date: new Date(now.getFullYear(), now.getMonth() - 1, 15, 12),
			},
		];
		expect(computeTrainingStats(sessions, "month").totalSessions).toBe(1);
	});

	it("year window: current calendar year", () => {
		const now = new Date();
		const sessions = [
			{ ...session(0), date: new Date(now.getFullYear(), 0, 2, 12) },
			{ ...session(0), date: new Date(now.getFullYear() - 1, 6, 15, 12) },
		];
		expect(computeTrainingStats(sessions, "year").totalSessions).toBe(1);
	});

	it("derives totals, days and per-week average", () => {
		const s = computeTrainingStats(
			[session(0), session(0), session(1)],
			"week",
		);
		expect(s.totalSessions).toBe(3);
		expect(s.totalMinutes).toBe(180);
		expect(s.trainingDays).toBe(2);
		expect(s.avgPerWeek).toBe(3);
		expect(s.formattedTotalTime(180)).toBe("3 h");
		expect(s.formattedTotalTime(45)).toBe("45 min");
		expect(s.formattedTotalTime(90)).toBe("1 h 30 min");
	});

	it("counts sessions without dates in totals (documented behaviour)", () => {
		const s = computeTrainingStats([{ type: "Yoga", duration: 30 }], "week");
		expect(s.totalSessions).toBe(1);
		expect(s.trainingDays).toBe(0);
	});
});
