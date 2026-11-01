/**
 * Tests for buildRoutesSectionHtml in route-line-ui.js — the detail-modal
 * warm-up routes table (DOM-free string builder).
 */
import { describe, it, expect } from "vitest";
import { buildRoutesSectionHtml } from "../app/js/route-line-ui.js";

const escapeHtml = (s) =>
	String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("buildRoutesSectionHtml", () => {
	it("returns empty string when there are no routes", () => {
		expect(buildRoutesSectionHtml(null, escapeHtml)).toBe("");
		expect(buildRoutesSectionHtml([], escapeHtml)).toBe("");
	});

	it("renders one row per route with style and outcome", () => {
		const html = buildRoutesSectionHtml(
			[
				{ grade: "5", style: "top-rope", outcome: "sent", order: 0 },
				{ grade: "6b", style: "lead", outcome: "failed", order: 1 },
			],
			escapeHtml,
		);
		expect(html).toContain("Warm-up Routes");
		expect(html).toContain(">5<");
		expect(html).toContain("Top-rope · Sent");
		expect(html).toContain("Lead · Failed");
	});

	it("escapes grade values", () => {
		const html = buildRoutesSectionHtml(
			[{ grade: "<script>", style: "lead", outcome: "sent", order: 0 }],
			escapeHtml,
		);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});
});
