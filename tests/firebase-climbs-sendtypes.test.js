/**
 * Tests for the send-type maps in firebase-climbs.js — in particular the
 * boulder-native send types (Flash / Top) introduced with the iOS 4.0 gym
 * feature. Firestore stores lowercase (iOS-native); the web displays Title
 * Case and canonicalizes before every write.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetDocs = vi.fn();

vi.mock("firebase/firestore", () => ({
	collection: vi.fn(),
	doc: vi.fn(),
	getDocs: (...a) => mockGetDocs(...a),
	setDoc: vi.fn(),
	updateDoc: vi.fn(),
	query: vi.fn(),
	orderBy: vi.fn(),
	where: vi.fn(),
	serverTimestamp: vi.fn(),
	Timestamp: { fromDate: vi.fn((d) => d) },
}));
vi.mock("../app/js/firebase-config.js", () => ({ db: {} }));
vi.mock("../app/js/firebase-auth.js", () => ({
	getCurrentUser: () => ({ uid: "test-uid" }),
}));

import {
	normalizeSendType,
	canonicalizeSendType,
	fetchSessionSends,
	BOULDER_ROUTE_TYPES,
	BOULDER_SEND_TYPES,
} from "../app/js/firebase-climbs.js";

describe("normalizeSendType (Firestore → display)", () => {
	it("maps the boulder-native types", () => {
		expect(normalizeSendType("flash")).toBe("Flash");
		expect(normalizeSendType("top")).toBe("Top");
	});

	it("keeps the rope types", () => {
		expect(normalizeSendType("redpoint")).toBe("Redpoint");
		expect(normalizeSendType("top rope")).toBe("Top Rope");
		expect(normalizeSendType("on sight")).toBe("On Sight");
		expect(normalizeSendType("all free")).toBe("All Free");
		expect(normalizeSendType("pinkpoint")).toBe("Pinkpoint");
		expect(normalizeSendType("project")).toBe("Project");
	});

	it("passes unknown values through unchanged", () => {
		expect(normalizeSendType("weird value")).toBe("weird value");
		expect(normalizeSendType(null)).toBe("Redpoint");
	});
});

describe("canonicalizeSendType (display → Firestore)", () => {
	it("maps the boulder-native types", () => {
		expect(canonicalizeSendType("Flash")).toBe("flash");
		expect(canonicalizeSendType("Top")).toBe("top");
	});

	it("round-trips with normalizeSendType", () => {
		for (const display of [
			"Redpoint",
			"On Sight",
			"Top Rope",
			"All Free",
			"Pinkpoint",
			"Project",
			"Flash",
			"Top",
		]) {
			expect(normalizeSendType(canonicalizeSendType(display))).toBe(display);
		}
	});
});

describe("boulder route types", () => {
	it("lists exactly the boulder contexts (iOS parity)", () => {
		expect(BOULDER_ROUTE_TYPES).toEqual(["Boulder", "Gym Boulder"]);
		expect(BOULDER_SEND_TYPES).toEqual(["flash", "top"]);
	});
});

describe("fetchSessionSends", () => {
	beforeEach(() => {
		mockGetDocs.mockReset();
	});

	function makeSnap(rows) {
		return {
			docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
		};
	}

	it("maps climb notes linked via sessionID", async () => {
		mockGetDocs.mockResolvedValue(
			makeSnap([
				{
					id: "CN1",
					data: {
						sessionID: "TS-1",
						route: "Yellow Rodilla",
						crag: "Boulderhalle Wien",
						difficulty: "6b",
						sendType: "flash",
						routeType: "Gym Boulder",
						date: { toDate: () => new Date("2026-03-18") },
					},
				},
				{ id: "CN2", data: { sessionID: "TS-1", deletedAt: {} } },
				{
					id: "CN4",
					data: { sessionID: "TS-1", sendType: "top", route: "y" },
				},
			]),
		);
		const sends = await fetchSessionSends("TS-1");
		expect(sends).toHaveLength(2);
		expect(sends[0]).toMatchObject({
			route: "Yellow Rodilla",
			sendType: "Flash",
			routeType: "Gym Boulder",
		});
		expect(sends[1].sendType).toBe("Top");
		expect(sends[1].route).toBe("y");
	});

	it("returns [] without a session id or user", async () => {
		expect(await fetchSessionSends(null)).toEqual([]);
		expect(mockGetDocs).not.toHaveBeenCalled();
	});
});
