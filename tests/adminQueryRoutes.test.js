/**
 * Tests for the admin browser data layer in firebase-routes.js:
 * adminQueryRoutes(), adminBackfillAreaSearch(), adminApplyCountryToTargets().
 *
 * firebase/firestore and firebase-config are fully mocked (same pattern as
 * fetchRouteData.test.js / adminScanCountryTargets.test.js).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetDocs = vi.fn();
const mockGetCountFromServer = vi.fn();
const mockWriteBatch = vi.fn();

vi.mock("firebase/firestore", () => ({
	getDocs: (...a) => mockGetDocs(...a),
	getCountFromServer: (...a) => mockGetCountFromServer(...a),
	writeBatch: (...a) => mockWriteBatch(...a),
	query: (...a) => ({ _args: a }),
	collection: (db, path) => ({ _path: path }),
	where: (...a) => ({ _where: a }),
	orderBy: (...a) => ({ _orderBy: a }),
	limit: (n) => ({ _limit: n }),
	startAfter: (...a) => ({ _startAfter: a }),
	documentId: () => "__documentId__",
	doc: vi.fn(),
	getDoc: vi.fn(),
	setDoc: vi.fn(),
	updateDoc: vi.fn(),
	deleteDoc: vi.fn(),
	runTransaction: vi.fn(),
	serverTimestamp: vi.fn(() => "__serverTimestamp__"),
	increment: vi.fn(),
}));

vi.mock("../app/js/firebase-config.js", () => ({
	db: {},
	auth: { currentUser: { uid: "admin-uid" } },
}));

const {
	adminQueryRoutes,
	adminBackfillAreaSearch,
	adminApplyCountryToTargets,
	adminApplyCountryToMatching,
} = await import("../app/js/firebase-routes.js");

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDoc(id, data) {
	return { id, ref: { id }, data: () => data };
}

function makeSnap(rows) {
	return { docs: rows.map((r) => makeDoc(r.id, r.data)) };
}

function routeData(id, nameSearch, extra = {}) {
	return { id, name: id, nameSearch, ...extra };
}

/** Controllable writeBatch mock: records batch.update payloads per commit. */
function makeBatchMock() {
	const batches = [];
	let current = null;
	mockWriteBatch.mockImplementation(() => {
		current = { ops: [], update: vi.fn((ref, fields) => current.ops.push({ ref, fields })), commit: vi.fn(async () => batches.push(current)) };
		return current;
	});
	return batches;
}

beforeEach(() => {
	mockGetDocs.mockReset();
	mockGetCountFromServer.mockReset();
	mockWriteBatch.mockReset();
});

// ── adminQueryRoutes ─────────────────────────────────────────────────────────

describe("adminQueryRoutes()", () => {
	it("browse-all: single stream query + single count", async () => {
		mockGetDocs.mockResolvedValueOnce(
			makeSnap([{ id: "r1", data: routeData("r1", "alps") }]),
		);
		mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 42 }) });

		const res = await adminQueryRoutes({ searchText: "", isOrphaned: false });

		expect(mockGetDocs).toHaveBeenCalledTimes(1);
		expect(mockGetCountFromServer).toHaveBeenCalledTimes(1);
		expect(res.routes.map((r) => r.id)).toEqual(["r1"]);
		expect(res.total).toBe(42);
		expect(res.nextCursors.exhausted).toContain("name"); // 1 < pageSize 25
	});

	it('Field "any": three parallel streams, deduped, total = sum of counts', async () => {
		mockGetDocs
			.mockResolvedValueOnce(
				makeSnap([{ id: "r1", data: routeData("r1", "hohe") }]),
			)
			.mockResolvedValueOnce(
				makeSnap([
					{ id: "r1", data: routeData("r1", "hohe") },
					{ id: "r2", data: routeData("r2", "hohe wand") },
				]),
			)
			.mockResolvedValueOnce(
				makeSnap([{ id: "r2", data: routeData("r2", "hohe wand") }]),
			);
		mockGetCountFromServer
			.mockResolvedValueOnce({ data: () => ({ count: 1 }) })
			.mockResolvedValueOnce({ data: () => ({ count: 2 }) })
			.mockResolvedValueOnce({ data: () => ({ count: 1 }) });

		const res = await adminQueryRoutes({ searchText: "Hohe", searchField: "any", isOrphaned: false });

		expect(mockGetDocs).toHaveBeenCalledTimes(3);
		expect(res.routes.map((r) => r.id)).toEqual(["r1", "r2"]); // deduped
		expect(res.total).toBe(4); // upper bound (sum of stream counts)
	});

	it("full page sets per-stream cursor and does not mark exhausted", async () => {
		const page = Array.from({ length: 25 }, (_, i) => ({
			id: `r${i}`,
			data: routeData(`r${i}`, `n${i}`),
		}));
		mockGetDocs.mockResolvedValueOnce(makeSnap(page));
		mockGetCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 100 }) });

		const res = await adminQueryRoutes({ searchText: "", isOrphaned: false });
		expect(res.nextCursors.exhausted).toEqual([]);
		expect(res.nextCursors.docs.name.id).toBe("r24");
	});

	it("exhausted streams from cursors are skipped on the next call", async () => {
		mockGetDocs
			.mockResolvedValueOnce(makeSnap([{ id: "r1", data: routeData("r1", "hohe") }]))
			.mockResolvedValueOnce(makeSnap([]))
			.mockResolvedValueOnce(makeSnap([]));
		mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });

		await adminQueryRoutes({ searchText: "x", searchField: "any", isOrphaned: false });
		expect(mockGetDocs).toHaveBeenCalledTimes(3);

		mockGetDocs.mockClear();
		mockGetDocs.mockResolvedValueOnce(makeSnap([]));
		// name + crag exhausted → only area stream queried
		const res = await adminQueryRoutes({
			searchText: "x",
			searchField: "any",
			isOrphaned: false,
			cursors: { docs: {}, exhausted: ["name", "crag"] },
		});
		expect(mockGetDocs).toHaveBeenCalledTimes(1);
		expect(res.nextCursors.exhausted).toEqual(["name", "crag", "area"]);
	});

	it("count is cached per filter-set (no second count read)", async () => {
		mockGetDocs.mockResolvedValue(makeSnap([]));
		mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 7 }) });

		const filters = { searchText: "cache-test", searchField: "name", routeType: null, country: null, isOrphaned: false };
		await adminQueryRoutes({ ...filters });
		await adminQueryRoutes({ ...filters });

		expect(mockGetCountFromServer).toHaveBeenCalledTimes(1);
	});
});

// ── adminBackfillAreaSearch ──────────────────────────────────────────────────

describe("adminBackfillAreaSearch()", () => {
	it("writes areaSearch only for docs missing it, in batches of ≤500", async () => {
		const page = Array.from({ length: 500 }, (_, i) => ({
			id: `r${i}`,
			data: i < 3 ? { climbingArea: "Hohe Wand" } : { climbingArea: "X", areaSearch: "x" },
		}));
		mockGetDocs
			.mockResolvedValueOnce(makeSnap(page)) // full page → cursor loop
			.mockResolvedValueOnce(makeSnap([{ id: "last", data: { climbingArea: "Café Wand" } }]));
		const batches = makeBatchMock();

		const result = await adminBackfillAreaSearch();

		expect(result).toEqual({ scanned: 501, updated: 4, batches: 2 });
		expect(batches).toHaveLength(2);
		const written = batches.flat().map((b) => b.ops).flat();
		expect(written).toHaveLength(4);
		expect(written[0].fields).toEqual({ areaSearch: "hohe wand" });
		// 4th write (the last page) is diacritics-folded
		expect(written[3].fields).toEqual({ areaSearch: "cafe wand" });
	});

	it("is idempotent — a second run with all fields present updates nothing", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([{ id: "r1", data: { climbingArea: "X", areaSearch: "x" } }]),
		);
		const batches = makeBatchMock();

		const result = await adminBackfillAreaSearch();

		expect(result.updated).toBe(0);
		expect(batches).toHaveLength(0);
	});

	it("clears the admin count cache after the run", async () => {
		mockGetDocs.mockResolvedValue(makeSnap([]));
		mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });

		const filters = { searchText: "backfill-cache-test", searchField: "name", isOrphaned: false };
		await adminQueryRoutes({ ...filters });
		expect(mockGetCountFromServer).toHaveBeenCalledTimes(1);
		await adminBackfillAreaSearch();
		await adminQueryRoutes({ ...filters });
		expect(mockGetCountFromServer).toHaveBeenCalledTimes(2); // re-counted
	});
});

// ── adminApplyCountryToTargets ───────────────────────────────────────────────

describe("adminApplyCountryToTargets()", () => {
	it("writes country + audit trail, never GPS fields, in ≤500 batches", async () => {
		const targets = Array.from({ length: 501 }, (_, i) => ({
			id: `t${i}`,
			ref: { id: `t${i}` },
			data: {
				latitude: null,
				longitude: null,
				recentEdits: [
					{ editedAt: "old1", editedBy: "a" },
					{ editedAt: "old2", editedBy: "b" },
					{ editedAt: "old3", editedBy: "c" },
					{ editedAt: "old4", editedBy: "d" }, // trimmed
				],
			},
		}));
		const batches = makeBatchMock();
		const progress = [];
		mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });

		const updated = await adminApplyCountryToTargets(targets, "DE", (p) =>
			progress.push(p),
		);

		expect(updated).toBe(501);
		expect(batches).toHaveLength(2); // 500 + 1
		const firstOps = batches[0].ops;
		expect(firstOps).toHaveLength(500);
		const fields = firstOps[0].fields;
		expect(fields.country).toBe("DE");
		expect(fields.updatedBy).toBe("admin-uid");
		expect(fields.updatedAt).toBe("__serverTimestamp__");
		// GPS fields are NEVER part of the write
		expect(Object.keys(fields).some((k) => /lat|lng|long/i.test(k))).toBe(false);
		// recentEdits: new entry first, trimmed to 3
		expect(fields.recentEdits).toHaveLength(3);
		expect(fields.recentEdits[0].note).toBe("admin country batch update");
		expect(fields.recentEdits[0].editedBy).toBe("admin-uid");
		expect(progress[progress.length - 1]).toEqual({ updated: 501, total: 501 });
	});

	it("throws without a country", async () => {
		await expect(adminApplyCountryToTargets([], "")).rejects.toThrow(
			/country is required/,
		);
	});

	it("adminApplyCountryToMatching composes scan + write and reports skips", async () => {
		// single stream (explicit field) → deterministic mock order
		mockGetDocs.mockResolvedValueOnce(
			makeSnap([
				{ id: "gps", data: { latitude: 47.8, longitude: 13.0, country: "AT" } },
				{ id: "set", data: { country: "IT" } },
				{ id: "empty", data: {} },
			]),
		);
		mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 3 }) });
		const batches = makeBatchMock();

		const res = await adminApplyCountryToMatching({
			filters: { searchText: "x", searchField: "name", isOrphaned: false },
			country: "DE",
			fillEmptyOnly: true,
			onProgress: () => {}, // exercises both scan and write progress branches
		});

		// hard invariant: GPS-backed doc is scanned, counted, never written
		expect(res).toEqual({ updated: 1, skippedAlreadySet: 1, skippedGPS: 1 });
		const ops = batches.flat().map((b) => b.ops).flat();
		expect(ops.map((o) => o.ref.id)).toEqual(["empty"]);
		expect(ops[0].fields.country).toBe("DE");
		expect(ops[0].fields).not.toHaveProperty("latitude");
	});
});
