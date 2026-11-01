/**
 * Tests for the send-type maps in firebase-climbs.js — in particular the
 * boulder-native send types (Flash / Top) introduced with the iOS 4.0 gym
 * feature. Firestore stores lowercase (iOS-native); the web displays Title
 * Case and canonicalizes before every write.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
	collection: vi.fn(),
	doc: vi.fn(),
	getDocs: vi.fn(),
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
