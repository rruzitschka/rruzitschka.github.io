/**
 * Tests for route-entries.js — the JSON wire format for warm-up route
 * entries embedded in Gym Session training sessions (iOS TrainingRouteEntry).
 *
 * The wire format must round-trip byte-for-byte with the iOS app's
 * JSONEncoder defaults: array of {id, grade, style, outcome, order} objects
 * in property-declaration key order, no whitespace.
 */
import { describe, it, expect } from "vitest";
import {
	decodeRouteEntries,
	encodeRouteEntries,
	sanitizeRouteEntries,
} from "../app/js/route-entries.js";

const ENTRY = {
	id: "A1B2C3D4-0000-4000-8000-000000000001",
	grade: "6b",
	style: "lead",
	outcome: "sent",
	order: 0,
};

describe("decodeRouteEntries", () => {
	it("decodes a well-formed iOS payload", () => {
		const json = JSON.stringify([ENTRY, { ...ENTRY, id: "x2", order: 1 }]);
		const decoded = decodeRouteEntries(json);
		expect(decoded).toHaveLength(2);
		expect(decoded[0]).toEqual(ENTRY);
		expect(decoded[1]).toEqual({ ...ENTRY, id: "x2", order: 1 });
	});

	it("reads the exact bytes iOS JSONEncoder produces", () => {
		const json =
			'[{"id":"A1B2C3D4-0000-4000-8000-000000000001","grade":"6b","style":"lead","outcome":"sent","order":0}]';
		expect(decodeRouteEntries(json)).toEqual([ENTRY]);
	});

	it("tolerates the not-offered-but-valid 'attempt' outcome", () => {
		const json = JSON.stringify([{ ...ENTRY, outcome: "attempt" }]);
		expect(decodeRouteEntries(json)).toHaveLength(1);
	});

	it("skips malformed entries but keeps well-formed ones", () => {
		const json = JSON.stringify([
			ENTRY,
			null,
			"string",
			42,
			{ grade: "7a" }, // missing id/style/outcome/order
			{ ...ENTRY, id: "" }, // empty id
			{ ...ENTRY, style: "boulder" }, // unknown style
			{ ...ENTRY, outcome: "wired" }, // unknown outcome
			{ ...ENTRY, order: "0" }, // order not an integer
			{ ...ENTRY, id: "ok", order: 1 },
		]);
		const decoded = decodeRouteEntries(json);
		expect(decoded).toHaveLength(2);
		expect(decoded[1]).toEqual({ ...ENTRY, id: "ok", order: 1 });
	});

	it("returns [] for garbage payloads", () => {
		expect(decodeRouteEntries(null)).toEqual([]);
		expect(decodeRouteEntries(undefined)).toEqual([]);
		expect(decodeRouteEntries("")).toEqual([]);
		expect(decodeRouteEntries("not json")).toEqual([]);
		expect(decodeRouteEntries('{"id":"x"}')).toEqual([]); // object, not array
		expect(decodeRouteEntries("[]")).toEqual([]);
	});
});

describe("sanitizeRouteEntries", () => {
	it("drops empty/whitespace grades and renumbers order", () => {
		const sanitized = sanitizeRouteEntries([
			{ id: "a", grade: " 6a ", style: "lead", outcome: "sent", order: 0 },
			{ id: "b", grade: "   ", style: "lead", outcome: "sent", order: 1 },
			{ id: "c", grade: "6b", style: "top-rope", outcome: "failed", order: 2 },
		]);
		expect(sanitized).toEqual([
			{ id: "a", grade: "6a", style: "lead", outcome: "sent", order: 0 },
			{
				id: "c",
				grade: "6b",
				style: "top-rope",
				outcome: "failed",
				order: 1,
			},
		]);
	});

	it("defaults unknown style/outcome and generates missing ids", () => {
		const [entry] = sanitizeRouteEntries([{ grade: "5" }]);
		expect(entry.style).toBe("lead");
		expect(entry.outcome).toBe("attempt");
		expect(entry.id).toMatch(
			/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/,
		);
	});

	it("handles non-array input", () => {
		expect(sanitizeRouteEntries(null)).toEqual([]);
	});
});

describe("encodeRouteEntries", () => {
	it("encodes with iOS key order and no whitespace", () => {
		const json = encodeRouteEntries([ENTRY]);
		expect(json).toBe(
			'[{"id":"A1B2C3D4-0000-4000-8000-000000000001","grade":"6b","style":"lead","outcome":"sent","order":0}]',
		);
	});

	it("round-trips encode → decode", () => {
		const entries = [
			ENTRY,
			{ ...ENTRY, id: "B", grade: " 7a ", style: "top-rope", order: 9 },
		];
		const decoded = decodeRouteEntries(encodeRouteEntries(entries));
		expect(decoded).toEqual([
			ENTRY,
			{ ...ENTRY, id: "B", grade: "7a", style: "top-rope", order: 1 },
		]);
	});

	it("returns null for an empty list (iOS stores nil)", () => {
		expect(encodeRouteEntries([])).toBeNull();
		expect(encodeRouteEntries([{ grade: "  " }])).toBeNull();
		expect(encodeRouteEntries(null)).toBeNull();
	});
});
