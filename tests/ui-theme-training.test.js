/**
 * Tests for the training-session detail card helpers in ui-theme.js —
 * DOM-free string builders moved out of route-line-ui.js.
 */
import { describe, it, expect } from "vitest";
import {
	buildWarmupRoutesHtml,
	buildSessionSendsTableHtml,
	buildIntensityDotsHtml,
	renderTrainingDetailHtml,
} from "../app/js/ui-theme.js";

describe("buildWarmupRoutesHtml", () => {
	it("returns empty string when there are no routes", () => {
		expect(buildWarmupRoutesHtml(null)).toBe("");
		expect(buildWarmupRoutesHtml([])).toBe("");
	});

	it("renders one row per route with style and outcome", () => {
		const html = buildWarmupRoutesHtml([
			{ grade: "5", style: "top-rope", outcome: "sent", order: 0 },
			{ grade: "6b", style: "lead", outcome: "failed", order: 1 },
		]);
		expect(html).toContain("Warm-up Routes");
		expect(html).toContain(">5<");
		expect(html).toContain("Top-rope · Sent");
		expect(html).toContain("Lead · Failed");
	});

	it("escapes grade values", () => {
		const html = buildWarmupRoutesHtml([
			{ grade: "<script>", style: "lead", outcome: "sent", order: 0 },
		]);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});
});

describe("buildSessionSendsTableHtml", () => {
	it("returns empty string when there are no sends", () => {
		expect(buildSessionSendsTableHtml(null)).toBe("");
		expect(buildSessionSendsTableHtml([])).toBe("");
	});

	it("renders one row per attached send", () => {
		const html = buildSessionSendsTableHtml([
			{
				route: "Yellow Rodilla",
				difficulty: "6b",
				sendType: "Flash",
			},
		]);
		expect(html).toContain("Yellow Rodilla");
		expect(html).toContain("6b · Flash");
	});

	it("escapes route names", () => {
		const html = buildSessionSendsTableHtml([
			{ route: "<img>", difficulty: "6b", sendType: "Top" },
		]);
		expect(html).not.toContain("<img>");
	});
});

describe("buildIntensityDotsHtml", () => {
	it("renders 5 dots with the first N filled", () => {
		const html = buildIntensityDotsHtml(3);
		expect(html).toContain("intensity-dots");
		const filled = html.match(/intensity-dot filled/g);
		const empty = html.match(/intensity-dot"/g);
		expect(filled.length).toBe(3);
		expect(empty.length).toBe(2);
	});

	it("falls back to level 3 for non-numeric intensity", () => {
		const html = buildIntensityDotsHtml(undefined);
		const filled = html.match(/intensity-dot filled/g);
		expect(filled.length).toBe(3);
	});
});

describe("renderTrainingDetailHtml", () => {
	it("returns empty-state markup when session is null", () => {
		expect(renderTrainingDetailHtml(null)).toBe(
			'<div class="insp-empty">Select a climb row to inspect route details, ascents, and coordinates.</div>',
		);
	});

	it("renders date, duration, intensity dots and Edit Session button", () => {
		const html = renderTrainingDetailHtml({
			type: "Hangboard",
			date: new Date("2026-11-06"),
			duration: 60,
			intensity: 4,
			notes: "Finger strength block",
		});
		expect(html).toContain("Hangboard");
		expect(html).toContain("60 min");
		expect(html).toContain("intensity-dot filled");
		expect(html).toContain("Finger strength block");
		expect(html).toContain("training-detail-edit-btn");
		expect(html).toContain("Edit Session");
	});

	it("renders gym info and warm-up routes for gym sessions", () => {
		const html = renderTrainingDetailHtml({
			type: "Gym Session",
			date: new Date("2026-11-06"),
			gym: "Kletterhalle Wien",
			routes: [{ grade: "6a", style: "lead", outcome: "sent" }],
		});
		expect(html).toContain("Kletterhalle Wien");
		expect(html).toContain("Warm-up Routes");
		expect(html).toContain("session-sends-section");
	});

	it("omits the attached-sends placeholder for non-gym sessions", () => {
		const html = renderTrainingDetailHtml({
			type: "Campus",
			date: new Date("2026-11-06"),
		});
		expect(html).not.toContain("session-sends-section");
	});
});
