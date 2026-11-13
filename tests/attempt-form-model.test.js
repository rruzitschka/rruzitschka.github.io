// tests/attempt-form-model.test.js — Pure "Add Attempt" helpers (iOS
// AttemptLogView parity; item #8 of docs/plan-new-ui-gui-followups.md).

import { describe, it, expect } from "vitest";
import {
	durationLabel,
	buildAttemptFields,
} from "../app/js/attempt-form-model.js";

const ACTIVE_PROJECT = {
	recordName: "mock-3",
	route: "La Dura Dura",
	climbingArea: "Oliana",
	crag: "Sector Pal",
	difficulty: "9a+",
	routeType: "Sport",
	centralRouteID: "r-02",
	attempts: 23,
	projectNotes: "Need to work the lower crux more.",
	projectStatus: "active",
	highPoint: "Third bolt clip",
	date: null,
};

const FAILED_ATTEMPT = {
	attemptDate: "2026-11-12",
	durationMinutes: 90,
	wasSuccessful: false,
	highPoint: "Fifth bolt clip",
	notes: "Fell at the final clip.",
};

describe("durationLabel", () => {
	it("formats minutes like iOS DurationFormatter", () => {
		expect(durationLabel(135)).toBe("2h 15m");
		expect(durationLabel(90)).toBe("1h 30m");
		expect(durationLabel(15)).toBe("15m");
		expect(durationLabel(0)).toBe("0m");
	});

	it("tolerates garbage input", () => {
		expect(durationLabel("")).toBe("0m");
		expect(durationLabel(undefined)).toBe("0m");
		expect(durationLabel(-5)).toBe("0m");
	});
});

describe("buildAttemptFields — failed attempt", () => {
	const fields = buildAttemptFields(ACTIVE_PROJECT, FAILED_ATTEMPT);

	const LOCAL_MIDNIGHT = new Date(2026, 10, 12); // attempt date parsed locally

	it("increments the attempt count and sets the last attempt date", () => {
		expect(fields.attemptCount).toBe(24);
		expect(fields.lastAttemptDate).toEqual(LOCAL_MIDNIGHT);
	});

	it("parses the attempt date as a local calendar date, not UTC midnight", () => {
		// In UTC-negative timezones a UTC parse would render the previous day
		// in the attempt-notes header; expect local-midnight components.
		expect(fields.lastAttemptDate.getHours()).toBe(0);
		expect(fields.lastAttemptDate.getFullYear()).toBe(2026);
	});

	it("updates the high point when provided", () => {
		expect(fields.highPoint).toBe("Fifth bolt clip");
	});

	it("keeps the project as an active project", () => {
		expect(fields.projectStatus).toBe("active");
		expect(fields.sendType).toBe("Project");
		expect(fields.date).toBeNull();
	});

	it("prepends the attempt entry with the duration to the project notes", () => {
		expect(fields.projectNotes).toMatch(
			/^Attempt #24 - Nov 12, 2026 \(1h 30m\)\nFell at the final clip\.\n\n/,
		);
		expect(fields.projectNotes.endsWith(ACTIVE_PROJECT.projectNotes)).toBe(
			true,
		);
	});
});

describe("buildAttemptFields — failed attempt without notes or duration", () => {
	it("leaves the project notes untouched", () => {
		const fields = buildAttemptFields(ACTIVE_PROJECT, {
			attemptDate: "2026-11-12",
			durationMinutes: 0,
			wasSuccessful: false,
			highPoint: "",
			notes: "",
		});
		expect(fields.projectNotes).toBe(ACTIVE_PROJECT.projectNotes);
	});

	it("logs a duration-only failed attempt (header without notes)", () => {
		const fields = buildAttemptFields(ACTIVE_PROJECT, {
			attemptDate: "2026-11-12",
			durationMinutes: 30,
			wasSuccessful: false,
			highPoint: "",
			notes: "",
		});
		expect(fields.projectNotes).toMatch(
			/^Attempt #24 - Nov 12, 2026 \(30m\)\n\n/,
		);
	});
});

describe("buildAttemptFields — successful attempt (send)", () => {
	const fields = buildAttemptFields(ACTIVE_PROJECT, {
		attemptDate: "2026-11-12",
		durationMinutes: 45,
		wasSuccessful: true,
		highPoint: "",
		notes: "Sent clean!",
	});

	it("completes the project and flips sendType to redpoint", () => {
		expect(fields.projectStatus).toBe("completed");
		expect(fields.sendType).toBe("redpoint");
	});

	it("moves the send date to the attempt date and records climbDuration", () => {
		expect(fields.date).toEqual(new Date(2026, 10, 12));
		expect(fields.climbDuration).toBe(45);
	});

	it("prepends the attempt entry without a duration suffix", () => {
		expect(fields.projectNotes).toMatch(
			/^Attempt #24 - Nov 12, 2026\nSent clean!\n\n/,
		);
	});
});

describe("buildAttemptFields — edge cases", () => {
	it("sets status to active when the project had none", () => {
		const fields = buildAttemptFields(
			{ ...ACTIVE_PROJECT, projectStatus: null },
			FAILED_ATTEMPT,
		);
		expect(fields.projectStatus).toBe("active");
	});

	it("preserves the existing high point when the attempt has none", () => {
		const fields = buildAttemptFields(ACTIVE_PROJECT, {
			...FAILED_ATTEMPT,
			highPoint: "  ",
		});
		expect(fields.highPoint).toBe("Third bolt clip");
	});

	it("passes the linked route through and never reports a rating", () => {
		const fields = buildAttemptFields(ACTIVE_PROJECT, FAILED_ATTEMPT);
		expect(fields.centralRouteID).toBe("r-02");
		expect(fields.reportedRating).toBe(0);
	});

	it("keeps route identity fields for the merged save", () => {
		const fields = buildAttemptFields(ACTIVE_PROJECT, FAILED_ATTEMPT);
		expect(fields.recordName).toBe("mock-3");
		expect(fields.route).toBe("La Dura Dura");
		expect(fields.id).toBeUndefined();
	});

	it("passes the overlay's beta notes through (merge save must not clear them)", () => {
		const fields = buildAttemptFields(
			{ ...ACTIVE_PROJECT, noteText: "Beta: left side of the crux." },
			FAILED_ATTEMPT,
		);
		expect(fields.noteText).toBe("Beta: left side of the crux.");
	});

	it("preserves a previously recorded climbDuration on failed attempts", () => {
		const fields = buildAttemptFields(
			{ ...ACTIVE_PROJECT, climbDuration: 120 },
			FAILED_ATTEMPT,
		);
		expect(fields.climbDuration).toBe(120);
	});
});
