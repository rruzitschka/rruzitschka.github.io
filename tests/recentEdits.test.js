/**
 * Tests for the recentEdits audit helpers in firebase-routes.js:
 * routeFieldChanges() + pushRecentEdit() + getRoute()'s entry mapping.
 *
 * firestore + firebase-config mocked (established pattern).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
	getDoc: (...a) => mockGetDoc(...a),
	runTransaction: (...a) => mockRunTransaction(...a),
	getDocs: vi.fn(async () => ({ docs: [] })),
	query: (...a) => ({ _args: a }),
	collection: (db, path) => ({ _path: path }),
	where: (...a) => ({ _where: a }),
	orderBy: (...a) => ({ _orderBy: a }),
	limit: (n) => ({ _limit: n }),
	startAfter: (...a) => ({ _startAfter: a }),
	documentId: () => "__documentId__",
	doc: (db, path, id) => ({ _path: path, id }),
	setDoc: vi.fn(),
	updateDoc: vi.fn(),
	deleteDoc: vi.fn(),
	runTransaction: (...a) => mockRunTransaction(...a),
	serverTimestamp: vi.fn(),
	increment: vi.fn(),
	writeBatch: vi.fn(),
	getCountFromServer: vi.fn(),
	Timestamp: {
		fromDate: vi.fn((d) => d),
		now: vi.fn(),
		toDate: undefined,
	},
}));

vi.mock("../app/js/firebase-config.js", () => ({
	db: {},
	auth: { currentUser: { uid: "admin-uid" } },
}));

const { getRoute, adminSaveRoute } = await import("../app/js/firebase-routes.js");

// routeFieldChanges / pushRecentEdit are module-private; tested through
// runTransaction-driven adminSaveRoute by capturing the tx.update payload.
const mockRunTransaction = vi.fn();

beforeEach(() => {
	mockGetDoc.mockReset();
	mockRunTransaction.mockReset();
});

function makeTx(docData) {
	const updatePayloads = [];
	const tx = {
		get: vi.fn(async () => ({
			exists: () => docData !== null,
			data: () => docData ?? {},
		})),
		update: vi.fn((_ref, payload) => updatePayloads.push(payload)),
	};
	mockRunTransaction.mockImplementation(async (_db, fn) => {
		await fn(tx);
		return updatePayloads[0] ?? null;
	});
	return { tx, updatePayloads };
}

function iso(date) {
	return { toDate: () => date };
}

describe("route audit trail (via adminSaveRoute)", () => {
	const baseDoc = {
		name: "Old Name",
		climbingArea: "Area",
		crag: "Crag",
		grade: "7a",
		createdGrade: "7a",
		createdGradeSystem: "French",
		routeType: "Sport",
		country: "AT",
		createdBy: "user-1",
		isOrphaned: false,
		recentEdits: [{ editedAt: iso(new Date("2026-01-01")), editedBy: "x" }],
	};

	it("records a diff for changed fields only", async () => {
		const { updatePayloads } = makeTx({ ...baseDoc });
		await adminSaveRoute("r1", {
			name: "New Name",
			climbingArea: "Area",
			crag: "Crag",
			grade: "7b",
			gradeSystem: "French",
			routeType: "Sport",
			createdBy: "user-1",
			isOrphaned: false,
		});

		const entry = updatePayloads[0].recentEdits[0];
		expect(entry.action).toBe("update");
		expect(entry.editedBy).toBe("admin-uid");
		expect(entry.changes).toEqual([
			{ field: "name", from: "Old Name", to: "New Name" },
			{ field: "grade", from: "7a", to: "7b" },
			{ field: "createdGrade", from: "7a", to: "7b" },
		]);
		// cap of 3 preserved, old entry kept
		expect(updatePayloads[0].recentEdits).toHaveLength(2);
	});

	it("does not write recentEdits on no-op edits", async () => {
		const { updatePayloads } = makeTx({ ...baseDoc });
		await adminSaveRoute("r1", {
			name: "Old Name", // unchanged
			climbingArea: "Area",
			crag: "Crag",
			grade: "7a",
			gradeSystem: "French",
			routeType: "Sport",
			createdBy: "user-1",
			isOrphaned: false,
		});
		expect(updatePayloads[0].recentEdits).toBeUndefined();
	});

	it("treats whitespace-only changes as no-ops", async () => {
		const { updatePayloads } = makeTx({ ...baseDoc, name: "Old Name  " });
		await adminSaveRoute("r1", {
			name: "Old Name", // same after trimming outer whitespace
			climbingArea: "Area",
			crag: "Crag",
			grade: "7a",
			gradeSystem: "French",
			routeType: "Sport",
			createdBy: "user-1",
			isOrphaned: false,
		});
		expect(updatePayloads[0].recentEdits).toBeUndefined();
	});

	it("records null→value and value→null transitions", async () => {
		const { updatePayloads } = makeTx({ ...baseDoc, country: null });
		await adminSaveRoute("r1", {
			name: "Old Name",
			climbingArea: "Area",
			crag: "Crag",
			grade: "7a",
			gradeSystem: "French",
			routeType: "Sport",
			createdBy: "user-1",
			isOrphaned: false,
			country: "DE",
		});
		const changes = updatePayloads[0].recentEdits[0].changes;
		expect(changes).toContainEqual({ field: "country", from: null, to: "DE" });
	});

	it("notes ownership transfers even when no tracked field changed", async () => {
		const { updatePayloads } = makeTx({ ...baseDoc });
		await adminSaveRoute("r1", {
			name: "Old Name",
			climbingArea: "Area",
			crag: "Crag",
			grade: "7a",
			gradeSystem: "French",
			routeType: "Sport",
			createdBy: "user-2", // changed
			isOrphaned: false,
		});
		const entry = updatePayloads[0].recentEdits[0];
		expect(entry.note).toBe("ownership transfer");
		expect(entry.changes).toContainEqual({
			field: "createdBy",
			from: "user-1",
			to: "user-2",
		});
	});

	it("caps recentEdits at 3 entries, newest first", async () => {
		const prev = ["a", "b", "c"].map((tag) => ({
			editedAt: iso(new Date("2026-01-01")),
			editedBy: tag,
		}));
		const { updatePayloads } = makeTx({ ...baseDoc, recentEdits: prev });
		await adminSaveRoute("r1", {
			name: "New",
			climbingArea: "Area",
			crag: "Crag",
			grade: "7a",
			gradeSystem: "French",
			routeType: "Sport",
			createdBy: "user-1",
			isOrphaned: false,
		});
		const edits = updatePayloads[0].recentEdits;
		expect(edits).toHaveLength(3);
		expect(edits[0].changes[0].field).toBe("name"); // newest first
		expect(edits.map((e) => e.editedBy)).toEqual(["admin-uid", "a", "b"]);
	});
});

describe("getRoute() recentEdits mapping", () => {
	it("maps action, note, and changes through; null when absent", async () => {
		mockGetDoc.mockResolvedValue({
			exists: () => true,
			id: "r1",
			data: () => ({
				id: "r1",
				name: "N",
				grade: "7a",
				createdBy: "u",
				recentEdits: [
					{
						editedAt: iso(new Date("2026-02-03")),
						editedBy: "admin",
						action: "country-batch",
						note: "admin country batch update",
						changes: [{ field: "country", from: null, to: "AT" }],
					},
					{ editedAt: iso(new Date("2026-01-01")), editedBy: "old" }, // legacy
				],
			}),
		});

		const route = await getRoute("r1");
		expect(route.recentEdits[0]).toEqual({
			editedAt: new Date("2026-02-03"),
			editedBy: "admin",
			action: "country-batch",
			note: "admin country batch update",
			changes: [{ field: "country", from: null, to: "AT" }],
		});
		// legacy entry: valid subset, no changes
		expect(route.recentEdits[1]).toEqual({
			editedAt: new Date("2026-01-01"),
			editedBy: "old",
			action: null,
			note: null,
			changes: null,
		});
	});

	it("defaults recentEdits to empty array", async () => {
		mockGetDoc.mockResolvedValue({
			exists: () => true,
			id: "r2",
			data: () => ({ id: "r2", name: "N", grade: "7a", createdBy: "u" }),
		});
		const route = await getRoute("r2");
		expect(route.recentEdits).toEqual([]);
	});
});
