/**
 * Tests for:
 *   1. fetchClimbs()  — no longer fires ascent sub-queries
 *   2. fetchAscents() — new standalone function, lazy-loaded per note
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firestore mock ────────────────────────────────────────────────────────────

const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args) => ({ _args: args }));
const mockOrderBy = vi.fn((...args) => ({ _orderBy: args }));
const mockCollection = vi.fn((db, path) => ({ _path: path }));

vi.mock("firebase/firestore", () => ({
	getDocs: (...a) => mockGetDocs(...a),
	query: (...a) => mockQuery(...a),
	collection: (...a) => mockCollection(...a),
	orderBy: (...a) => mockOrderBy(...a),
	where: vi.fn(),
	documentId: vi.fn(),
	doc: vi.fn(),
	getDoc: vi.fn(),
	setDoc: vi.fn(),
	updateDoc: vi.fn(),
	addDoc: vi.fn(),
	deleteDoc: vi.fn(),
	serverTimestamp: vi.fn(),
	Timestamp: { fromDate: vi.fn((d) => d), now: vi.fn() },
	increment: vi.fn(),
	arrayUnion: vi.fn(),
	limit: vi.fn(),
	startAfter: vi.fn(),
	collectionGroup: vi.fn(),
	writeBatch: vi.fn(),
}));

vi.mock("../app/js/firebase-config.js", () => ({
	db: {},
	auth: { currentUser: { uid: "u1" } },
}));

vi.mock("../app/js/firebase-auth.js", () => ({
	getCurrentUser: vi.fn(() => ({ uid: "u1" })),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSnap(rows) {
	return {
		docs: rows.map((r) => ({
			id: r.id,
			data: () => r.data,
			exists: () => true,
		})),
	};
}

function makeTimestamp(date) {
	return { toDate: () => new Date(date) };
}

// ── import SUT ────────────────────────────────────────────────────────────────

const { fetchClimbs, fetchAscents } = await import(
	"../app/js/firebase-climbs.js"
);

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => mockGetDocs.mockReset());

// ── fetchClimbs ───────────────────────────────────────────────────────────────

describe("fetchClimbs()", () => {
	it("returns empty array when no docs", async () => {
		mockGetDocs.mockResolvedValue(makeSnap([]));
		const result = await fetchClimbs();
		expect(result).toEqual([]);
	});

	it("fires exactly ONE Firestore query (no ascent sub-queries)", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{
					id: "note1",
					data: {
						route: "Rhapsody",
						date: makeTimestamp("2024-01-01"),
						sendType: "redpoint",
					},
				},
				{
					id: "note2",
					data: {
						route: "Action Directe",
						date: makeTimestamp("2024-02-01"),
						sendType: "onsight",
					},
				},
			]),
		);

		await fetchClimbs();
		expect(mockGetDocs).toHaveBeenCalledTimes(1);
	});

	it("returns ascents as empty array for every note", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "note1", data: { route: "Rhapsody", sendType: "redpoint" } },
			]),
		);

		const [note] = await fetchClimbs();
		expect(note.ascents).toEqual([]);
	});

	it("excludes soft-deleted notes", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "n1", data: { route: "Keep", sendType: "redpoint" } },
				{
					id: "n2",
					data: {
						route: "Gone",
						sendType: "redpoint",
						deletedAt: makeTimestamp("2024-01-01"),
					},
				},
			]),
		);

		const result = await fetchClimbs();
		expect(result).toHaveLength(1);
		expect(result[0].route).toBe("Keep");
	});

	it("normalises sendType to Title Case", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([{ id: "n1", data: { route: "X", sendType: "onsight" } }]),
		);

		const [note] = await fetchClimbs();
		expect(note.sendType).toBe("On Sight");
	});
});

// ── fetchAscents ──────────────────────────────────────────────────────────────

describe("fetchAscents()", () => {
	it("returns empty array when no ascents", async () => {
		mockGetDocs.mockResolvedValue(makeSnap([]));
		const result = await fetchAscents("note1");
		expect(result).toEqual([]);
	});

	it("returns ascents with composite recordName noteId/ascentId", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{
					id: "asc1",
					data: {
						sendType: "redpoint",
						date: makeTimestamp("2024-03-01"),
						notes: "great",
					},
				},
			]),
		);

		const [a] = await fetchAscents("note1");
		expect(a.recordName).toBe("note1/asc1");
		expect(a.sendType).toBe("Redpoint");
		expect(a.notes).toBe("great");
	});

	it("excludes soft-deleted ascents", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "a1", data: { sendType: "redpoint" } },
				{
					id: "a2",
					data: {
						sendType: "redpoint",
						deletedAt: makeTimestamp("2024-01-01"),
					},
				},
			]),
		);

		const result = await fetchAscents("note1");
		expect(result).toHaveLength(1);
		expect(result[0].recordName).toBe("note1/a1");
	});

	it("normalises ascent sendType", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([{ id: "a1", data: { sendType: "toprope" } }]),
		);

		const [a] = await fetchAscents("note1");
		expect(a.sendType).toBe("Top Rope");
	});

	it("returns [] when user is not signed in", async () => {
		const { getCurrentUser } = await import("../app/js/firebase-auth.js");
		getCurrentUser.mockReturnValueOnce(null);
		const result = await fetchAscents("note1");
		expect(result).toEqual([]);
		expect(mockGetDocs).not.toHaveBeenCalled();
	});
});
