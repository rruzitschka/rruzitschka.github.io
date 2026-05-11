/**
 * Tests for fetchRouteData() — the merged replacement for
 * fetchCommunityRatings() + fetchRouteGPSData().
 *
 * firebase-routes.js depends on firebase/firestore, so we mock the module
 * entirely and inject controlled Firestore snapshots.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firestore mock ────────────────────────────────────────────────────────────

const mockGetDocs = vi.fn();
const mockQuery = vi.fn((...args) => ({ _args: args }));
const mockCollection = vi.fn((db, path) => ({ _path: path }));
const mockWhere = vi.fn((...args) => ({ _where: args }));
const mockDocumentId = vi.fn(() => "__documentId__");

vi.mock("firebase/firestore", () => ({
	getDocs: (...a) => mockGetDocs(...a),
	query: (...a) => mockQuery(...a),
	collection: (...a) => mockCollection(...a),
	where: (...a) => mockWhere(...a),
	documentId: (...a) => mockDocumentId(...a),
	// other exports used elsewhere in firebase-routes.js
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
	orderBy: vi.fn(),
	limit: vi.fn(),
	startAfter: vi.fn(),
	collectionGroup: vi.fn(),
	writeBatch: vi.fn(),
}));

vi.mock("../app/js/firebase-config.js", () => ({
	db: {},
	auth: { currentUser: { uid: "test-uid" } },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a fake Firestore snapshot from an array of { id, data } objects */
function makeSnap(rows) {
	return {
		docs: rows.map((r) => ({
			id: r.id,
			data: () => r.data,
			exists: () => true,
		})),
	};
}

// ── import SUT after mocks are in place ──────────────────────────────────────

const { fetchRouteData } = await import("../app/js/firebase-routes.js");

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	mockGetDocs.mockReset();
});

describe("fetchRouteData()", () => {
	it("returns empty maps for empty input", async () => {
		const result = await fetchRouteData([]);
		expect(result.ratings).toBeInstanceOf(Map);
		expect(result.gps).toBeInstanceOf(Map);
		expect(result.createdBy).toBeInstanceOf(Map);
		expect(result.ratings.size).toBe(0);
		expect(result.gps.size).toBe(0);
		expect(result.createdBy.size).toBe(0);
		expect(mockGetDocs).not.toHaveBeenCalled();
	});

	it("returns empty maps for null/undefined input", async () => {
		const r1 = await fetchRouteData(null);
		const r2 = await fetchRouteData(undefined);
		expect(r1.ratings.size).toBe(0);
		expect(r2.ratings.size).toBe(0);
	});

	it("populates ratings only for routes with ratingCount > 0", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "r1", data: { ratingSum: 8, ratingCount: 2, createdBy: "uid1" } },
				{ id: "r2", data: { ratingSum: 0, ratingCount: 0, createdBy: "uid2" } },
			]),
		);

		const { ratings } = await fetchRouteData(["r1", "r2"]);
		expect(ratings.get("r1")).toBeCloseTo(4.0);
		expect(ratings.has("r2")).toBe(false); // no ratings
	});

	it("populates gps only for routes with latitude and longitude set", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "r1", data: { latitude: 46.5, longitude: 8.2, country: "CH" } },
				{ id: "r2", data: { latitude: null, longitude: null } },
			]),
		);

		const { gps } = await fetchRouteData(["r1", "r2"]);
		expect(gps.get("r1")).toEqual({
			latitude: 46.5,
			longitude: 8.2,
			country: "CH",
		});
		expect(gps.has("r2")).toBe(false);
	});

	it("populates createdBy for all returned routes", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "r1", data: { createdBy: "alice" } },
				{ id: "r2", data: { createdBy: "bob" } },
				{ id: "r3", data: {} }, // no createdBy field
			]),
		);

		const { createdBy } = await fetchRouteData(["r1", "r2", "r3"]);
		expect(createdBy.get("r1")).toBe("alice");
		expect(createdBy.get("r2")).toBe("bob");
		expect(createdBy.get("r3")).toBeNull();
	});

	it("deduplicates route IDs before querying", async () => {
		mockGetDocs.mockResolvedValue(makeSnap([]));
		await fetchRouteData(["r1", "r1", "r2", "r1"]);
		// Only 1 batch call needed for 2 unique IDs
		expect(mockGetDocs).toHaveBeenCalledTimes(1);
	});

	it("chunks requests into batches of ≤30", async () => {
		const ids = Array.from({ length: 75 }, (_, i) => `r${i}`);
		mockGetDocs.mockResolvedValue(makeSnap([]));
		await fetchRouteData(ids);
		// 75 IDs → 3 batches (30 + 30 + 15)
		expect(mockGetDocs).toHaveBeenCalledTimes(3);
	});

	it("merges results across multiple chunks", async () => {
		const ids = Array.from({ length: 35 }, (_, i) => `r${i}`);
		// First batch of 30
		const batch1 = ids.slice(0, 30).map((id) => ({
			id,
			data: {
				ratingSum: 5,
				ratingCount: 1,
				latitude: 1.0,
				longitude: 2.0,
				country: "AT",
				createdBy: "x",
			},
		}));
		// Second batch of 5
		const batch2 = ids.slice(30).map((id) => ({
			id,
			data: {
				ratingSum: 10,
				ratingCount: 2,
				latitude: 3.0,
				longitude: 4.0,
				country: "DE",
				createdBy: "y",
			},
		}));
		mockGetDocs
			.mockResolvedValueOnce(makeSnap(batch1))
			.mockResolvedValueOnce(makeSnap(batch2));

		const { ratings, gps, createdBy } = await fetchRouteData(ids);
		expect(ratings.size).toBe(35);
		expect(gps.size).toBe(35);
		expect(createdBy.size).toBe(35);
		expect(ratings.get("r0")).toBeCloseTo(5);
		expect(ratings.get("r34")).toBeCloseTo(5);
	});

	it("swallows per-batch errors and returns partial results", async () => {
		mockGetDocs
			.mockRejectedValueOnce(new Error("network error"))
			.mockResolvedValueOnce(
				makeSnap([
					{ id: "r31", data: { ratingSum: 3, ratingCount: 1, createdBy: "z" } },
				]),
			);

		const ids = Array.from({ length: 35 }, (_, i) => `r${i}`);
		const { ratings } = await fetchRouteData(ids);
		// First batch failed, second batch succeeded
		expect(ratings.has("r31")).toBe(true);
	});
});
