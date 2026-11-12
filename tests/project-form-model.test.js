// tests/project-form-model.test.js — Pure project-overlay form helpers
// (docs/plan-uijs-refactor.md Chunk 3).

import { describe, it, expect } from "vitest";
import {
	coerceAttemptCount,
	validateProjectDates,
	projectCounterChange,
	buildProjectSavePayload,
} from "../app/js/project-form-model.js";

describe("coerceAttemptCount", () => {
	it("parses numeric strings and floors fractions", () => {
		expect(coerceAttemptCount("23")).toBe(23);
		expect(coerceAttemptCount("7.9")).toBe(7);
		expect(coerceAttemptCount(0)).toBe(0);
	});

	it("collapses garbage and negatives to 0", () => {
		expect(coerceAttemptCount("")).toBe(0);
		expect(coerceAttemptCount("abc")).toBe(0);
		expect(coerceAttemptCount(-3)).toBe(0);
		expect(coerceAttemptCount("-3.5")).toBe(0);
	});
});

describe("validateProjectDates", () => {
	it("accepts when the last attempt is on/after the first attempt", () => {
		expect(
			validateProjectDates("2026-01-01", "2026-03-01"),
		).toBe(true);
		expect(
			validateProjectDates("2026-03-01", "2026-03-01"),
		).toBe(true);
	});

	it("rejects an inverted range", () => {
		expect(
			validateProjectDates("2026-03-01", "2026-01-01"),
		).toBe(false);
	});

	it("empty dates are always valid (unknown)", () => {
		expect(validateProjectDates("", "2026-01-01")).toBe(true);
		expect(validateProjectDates("2026-01-01", "")).toBe(true);
		expect(validateProjectDates("", "")).toBe(true);
	});
});

describe("projectCounterChange", () => {
	it("new projects increment the route's project count", () => {
		expect(projectCounterChange({ isNew: true, projectStatus: "active" })).toBe(
			"increment",
		);
	});

	it("edits flipping the status to abandoned decrement", () => {
		expect(
			projectCounterChange({ isNew: false, projectStatus: "abandoned" }),
		).toBe("decrement");
	});

	it("other edits are a no-op", () => {
		expect(
			projectCounterChange({ isNew: false, projectStatus: "active" }),
		).toBeNull();
		expect(
			projectCounterChange({ isNew: false, projectStatus: "completed" }),
		).toBeNull();
	});
});

describe("buildProjectSavePayload", () => {
	it("builds a new-project payload with generated id and null optionals", () => {
		const payload = buildProjectSavePayload({
			recordName: "",
			route: "La Dura Dura",
			climbingArea: "  Oliana  ",
			crag: "",
			difficulty: "9a+",
			date: "2026-03-01",
			routeType: "Sport",
			attempts: "23",
			lastAttemptDate: "2026-04-01",
			highPoint: "  Third bolt  ",
			projectStatus: "active",
			noteText: "  ",
			centralRouteID: "r-1",
		});
		expect(payload.recordName).toBeUndefined();
		expect(payload.id).toEqual(expect.any(String));
		expect(payload.id).toHaveLength(36);
		expect(payload.route).toBe("La Dura Dura");
		expect(payload.climbingArea).toBe("Oliana");
		expect(payload.crag).toBeNull();
		expect(payload.difficulty).toBe("9a+");
		expect(payload.sendType).toBe("Project");
		expect(payload.date).toEqual(new Date("2026-03-01"));
		expect(payload.routeType).toBe("Sport");
		expect(payload.attemptCount).toBe(23);
		expect(payload.lastAttemptDate).toEqual(new Date("2026-04-01"));
		expect(payload.highPoint).toBe("Third bolt");
		expect(payload.projectStatus).toBe("active");
		expect(payload.noteText).toBeNull();
		expect(payload.centralRouteID).toBe("r-1");
		// projects never contribute to the community rating
		expect(payload.reportedRating).toBe(0);
	});

	it("keeps an existing recordName and omits the generated id", () => {
		const payload = buildProjectSavePayload({
			recordName: "rn",
			route: "x",
			attempts: "abc",
		});
		expect(payload.recordName).toBe("rn");
		expect(payload.id).toBeUndefined();
		expect(payload.attemptCount).toBe(0);
		expect(payload.date).toBeNull();
		expect(payload.lastAttemptDate).toBeNull();
	});

	it("tolerates negative attempt strings via coercion", () => {
		const payload = buildProjectSavePayload({
			recordName: "rn",
			route: "x",
			attempts: "-5",
		});
		expect(payload.attemptCount).toBe(0);
	});
});
