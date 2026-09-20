/**
 * Tests for adminScanCountryTargets() — the classification pass behind the
 * admin batch country apply (docs/plan-admin-routes-browser.md Phase 6).
 *
 * Key invariants under test:
 *  - GPS-backed routes (latitude != null) are NEVER targets — hard invariant
 *  - fillEmptyOnly=true classifies docs with a non-empty country as skipped
 *  - docs are deduped across the three "any" search streams
 *  - the scanner paginates via cursors until a stream is exhausted
 *
 * firebase-routes.js depends on firebase/firestore + firebase-config, so both
 * modules are mocked (same pattern as fetchRouteData.test.js).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetDocs = vi.fn();

vi.mock("firebase/firestore", () => ({
	getDocs: (...a) => mockGetDocs(...a),
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
	serverTimestamp: vi.fn(),
	increment: vi.fn(),
	writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn() })),
	getCountFromServer: vi.fn(),
}));

vi.mock("../app/js/firebase-config.js", () => ({
	db: {},
	auth: { currentUser: { uid: "admin-uid" } },
}));

const { adminScanCountryTargets } = await import(
	"../app/js/firebase-routes.js"
);

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDoc(id, data) {
	return { id, ref: { id }, data: () => data };
}

/** Build a fake snapshot whose length drives the cursor loop. */
function makeSnap(rows) {
	return { docs: rows.map((r) => makeDoc(r.id, r.data)) };
}

const FILTERS = {
	searchText: "wand",
	searchField: "name", // single stream → deterministic getDocs call order
};

beforeEach(() => {
	mockGetDocs.mockReset();
});

describe("adminScanCountryTargets()", () => {
	it("classifies GPS-backed routes as skipped, never as targets", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "gps1", data: { latitude: 47.8, longitude: 13.0, country: "DE" } },
				{ id: "gps2", data: { latitude: 47.8, longitude: 13.0, country: null } },
			]),
		);
		// Even in overwrite mode GPS-backed routes stay untouched
		const overwrite = await adminScanCountryTargets(FILTERS, false);
		expect(overwrite.targets.map((t) => t.id)).toEqual([]);
		expect(overwrite.skippedGPS).toBe(2);

		mockGetDocs.mockResolvedValueOnce(
			makeSnap([{ id: "gps1", data: { latitude: 47.8, longitude: 13.0, country: "DE" } }]),
		);
		const fill = await adminScanCountryTargets(FILTERS, true);
		expect(fill.targets).toEqual([]);
		expect(fill.skippedGPS).toBe(1);
	});

	it("fillEmptyOnly=true skips GPS-less docs that already have a country", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "set", data: { country: "IT" } },
				{ id: "empty", data: { country: null } },
			]),
		);
		const fill = await adminScanCountryTargets(FILTERS, true);
		expect(fill.targets.map((t) => t.id)).toEqual(["empty"]);
		expect(fill.skippedAlreadySet).toBe(1);

		const overwrite = await adminScanCountryTargets(FILTERS, false);
		expect(overwrite.targets.map((t) => t.id)).toEqual(["set", "empty"]);
		expect(overwrite.skippedAlreadySet).toBe(0);
	});

	it("dedupes docs seen in multiple streams", async () => {
		const anyFilters = { searchText: "wand", searchField: "any" };
		// three "any" streams (name, crag, area) — one getDocs call each
		mockGetDocs
			.mockResolvedValueOnce(makeSnap([{ id: "r1", data: { country: null } }]))
			.mockResolvedValueOnce(
				makeSnap([
					{ id: "r1", data: { country: null } },
					{ id: "r2", data: { country: null } },
				]),
			)
			.mockResolvedValueOnce(makeSnap([{ id: "r2", data: { country: null } }]));
		const { targets, scanned } = await adminScanCountryTargets(anyFilters, true);
		expect(targets.map((t) => t.id)).toEqual(["r1", "r2"]);
		expect(scanned).toBe(2); // raw 4 doc hits, deduped to 2 unique
	});

	it("paginates via cursors until the stream is exhausted", async () => {
		const page1 = Array.from({ length: 500 }, (_, i) => ({
			id: `p1_${i}`,
			data: { country: null },
		}));
		const page2 = [{ id: "p2_last", data: { country: null } }];
		mockGetDocs
			.mockResolvedValueOnce(makeSnap(page1)) // full page → cursor loop continues
			.mockResolvedValueOnce(makeSnap(page2)); // short page → exhausted
		const { targets } = await adminScanCountryTargets(FILTERS, true);
		expect(targets.map((t) => t.id)).toContain("p1_0");
		expect(targets.map((t) => t.id)).toContain("p2_last");
		expect(targets).toHaveLength(501);
		expect(mockGetDocs).toHaveBeenCalledTimes(2);
		// second call must carry a startAfter cursor on the last doc of page 1
		const secondQuery = mockGetDocs.mock.calls[1][0];
		const startAfterArg = secondQuery._args.find((c) => c && c._startAfter);
		expect(startAfterArg._startAfter[0].id).toBe("p1_499");
	});

	it("reports scanned count via onProgress", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{ id: "a", data: {} },
				{ id: "b", data: {} },
			]),
		);
		const progress = [];
		await adminScanCountryTargets(FILTERS, true, ({ scanned }) =>
			progress.push(scanned),
		);
		expect(progress[progress.length - 1]).toBe(2);
	});
});
