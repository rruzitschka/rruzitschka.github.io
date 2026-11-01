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
import { fetchTrainingSessions, saveTrainingSession } from "../app/js/firebase-training.js";

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
