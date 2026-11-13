// tests/send-form-model.test.js — Pure send-overlay form helpers
// (docs/plan-uijs-refactor.md Chunk 2).

import { describe, it, expect } from "vitest";
import {
	stylePillClass,
	buildSendSavePayload,
	sendRatingReportCalls,
	buildAscentInput,
} from "../app/js/send-form-model.js";

describe("stylePillClass", () => {
	it("maps every send style to its active-* class", () => {
		expect(stylePillClass("Redpoint")).toBe("active-rp");
		expect(stylePillClass("On Sight")).toBe("active-os");
		expect(stylePillClass("Top Rope")).toBe("active-tr");
		expect(stylePillClass("All Free")).toBe("active-af");
		expect(stylePillClass("Pinkpoint")).toBe("active-pk");
		expect(stylePillClass("Flash")).toBe("active-fl");
		expect(stylePillClass("Top")).toBe("active-tp");
	});

	it("returns an empty string for unknown styles (legacy types)", () => {
		expect(stylePillClass("Project")).toBe("");
		expect(stylePillClass(undefined)).toBe("");
	});
});

describe("buildSendSavePayload", () => {
	it("builds a new-send payload with generated id and null optionals", () => {
		const payload = buildSendSavePayload({
			recordName: "",
			route: "Biographie",
			climbingArea: "  Ceüse  ",
			crag: "",
			difficulty: "9a",
			date: "2026-03-01",
			sendType: "Redpoint",
			routeType: "Sport",
			rating: 0,
			noteText: "  ",
			centralRouteID: "r-1",
		});
		expect(payload.recordName).toBeUndefined();
		expect(payload.id).toEqual(expect.any(String));
		expect(payload.id).toHaveLength(36);
		expect(payload.route).toBe("Biographie");
		expect(payload.climbingArea).toBe("Ceüse");
		expect(payload.crag).toBeNull();
		expect(payload.date).toEqual(new Date(2026, 2, 1)); // local calendar date
		expect(payload.noteText).toBeNull();
		expect(payload.centralRouteID).toBe("r-1");
		// unrated → reportedRating 0
		expect(payload.reportedRating).toBe(0);
	});

	it("reports a rating only when linked and rated", () => {
		const linked = buildSendSavePayload({
			recordName: "rn",
			route: "x",
			rating: 4,
			centralRouteID: "r-1",
		});
		expect(linked.reportedRating).toBe(4);
		expect(linked.id).toBeUndefined();

		const unlinked = buildSendSavePayload({
			recordName: "rn",
			route: "x",
			rating: 4,
			centralRouteID: null,
		});
		expect(unlinked.reportedRating).toBe(0);
	});

	it("converts an empty date to null", () => {
		const payload = buildSendSavePayload({
			recordName: "rn",
			route: "x",
			rating: 0,
			date: "",
		});
		expect(payload.date).toBeNull();
	});
});

describe("sendRatingReportCalls", () => {
	const cases = [
		{
			name: "same-route edit reports a delta on that route",
			input: {
				centralID: "r-1",
				originalCentralRouteID: "r-1",
				previousReportedRating: 3,
				rating: 5,
			},
			expected: [{ routeID: "r-1", rating: 5, previousRating: 3 }],
		},
		{
			name: "cleared link retracts the old route's rating",
			input: {
				centralID: null,
				originalCentralRouteID: "r-1",
				previousReportedRating: 3,
				rating: 5,
			},
			expected: [{ routeID: "r-1", rating: 0, previousRating: 3 }],
		},
		{
			name: "cleared link with nothing previously reported is a no-op",
			input: {
				centralID: null,
				originalCentralRouteID: "r-1",
				previousReportedRating: 0,
				rating: 5,
			},
			expected: [],
		},
		{
			name: "relink retracts the old route and reports on the new one",
			input: {
				centralID: "r-2",
				originalCentralRouteID: "r-1",
				previousReportedRating: 3,
				rating: 5,
			},
			expected: [
				{ routeID: "r-1", rating: 0, previousRating: 3 },
				{ routeID: "r-2", rating: 5, previousRating: 0 },
			],
		},
		{
			name: "new link without previous rating only reports on the new route",
			input: {
				centralID: "r-2",
				originalCentralRouteID: null,
				previousReportedRating: 0,
				rating: 5,
			},
			expected: [{ routeID: "r-2", rating: 5, previousRating: 0 }],
		},
	];

	for (const { name, input, expected } of cases) {
		it(name, () => {
			expect(sendRatingReportCalls(input)).toEqual(expected);
		});
	}
});

describe("buildAscentInput", () => {
	it("defaults the date to today and trims notes", () => {
		const input = buildAscentInput({
			sendType: "Redpoint",
			notes: "  nice one  ",
			climbNoteRecordName: "rn",
		});
		expect(input.date).toBeInstanceOf(Date);
		expect(input.notes).toBe("nice one");
		expect(input.sendType).toBe("Redpoint");
		expect(input.climbNoteRecordName).toBe("rn");
	});

	it("collapses empty notes to null and parses the given date", () => {
		const input = buildAscentInput({
			id: "a-1",
			date: "2026-01-05",
			sendType: "Flash",
			notes: "",
			climbNoteRecordName: "rn",
		});
		expect(input.id).toBe("a-1");
		expect(input.date).toEqual(new Date(2026, 0, 5)); // local calendar date
		expect(input.notes).toBeNull();
	});

	it("generates an id when none is given", () => {
		const input = buildAscentInput({ sendType: "Top" });
		expect(typeof input.id).toBe("string");
		expect(input.id).toHaveLength(36);
	});
});

// coercePitchCount itself is unit-tested in tests/ui-theme.test.js.
describe("multi-pitch payload fields", () => {
	it("omits the plan fields when the caller passes undefined (non-Multi-Pitch type)", () => {
		const payload = buildSendSavePayload({
			route: "R",
			routeType: "Sport",
			sendType: "Redpoint",
			rating: 0,
			pitches: undefined,
			approachNotes: undefined,
		});
		expect(payload.numberOfPitches).toBeUndefined();
		expect(payload.approachNotes).toBeUndefined();
	});

	it("normalizes the plan fields when present", () => {
		const payload = buildSendSavePayload({
			route: "R",
			routeType: "Multi-Pitch",
			sendType: "Redpoint",
			rating: 0,
			pitches: "300",
			approachNotes: "  hike  ",
		});
		expect(payload.numberOfPitches).toBe(99);
		expect(payload.approachNotes).toBe("hike");
	});
});
