/**
 * Unit tests for app/js/ui-theme.js — Chalk & Sky / Classic UI theme switch,
 * iOS route-type filter chips, and Route Detail Inspector HTML rendering.
 */
import { describe, it, expect } from "vitest";

import {
	THEME_STORAGE_KEY,
	THEME_CHALK_SKY,
	THEME_CLASSIC,
	resolveTheme,
	nextTheme,
	themeToggleMeta,
	ROUTE_TYPE_DOT_MAP,
	routeTypeDotClass,
	escapeInspectorHtml,
	buildRouteTypeChips,
	renderRouteTypeChipsHtml,
	styleAbbreviation,
	formatShortNumericDate,
	STYLE_ABBREVIATIONS,
	buildCompactClimbRowCellsHtml,
	renderRouteCellIndicatorsHtml,
	renderCommunityOwnerIndicatorHtml,
	renderInspectorEmptyHtml,
	renderInspectorAscentsHtml,
	combineAscentsWithOriginalSend,
	renderInspectorGpsHtml,
	renderInspectorPhotosHtml,
	renderInspectorHtml,
} from "../app/js/ui-theme.js";

describe("theme resolution & toggle helpers", () => {
	it("defaults to chalk-sky when stored value is missing or unknown", () => {
		expect(THEME_STORAGE_KEY).toBe("sendlog_ui_theme");
		expect(resolveTheme(null)).toBe(THEME_CHALK_SKY);
		expect(resolveTheme(undefined)).toBe(THEME_CHALK_SKY);
		expect(resolveTheme("")).toBe(THEME_CHALK_SKY);
		expect(resolveTheme("bogus")).toBe(THEME_CHALK_SKY);
		expect(resolveTheme(THEME_CHALK_SKY)).toBe(THEME_CHALK_SKY);
	});

	it("returns classic when stored value is classic", () => {
		expect(resolveTheme(THEME_CLASSIC)).toBe(THEME_CLASSIC);
	});

	it("nextTheme flips between chalk-sky and classic", () => {
		expect(nextTheme(THEME_CHALK_SKY)).toBe(THEME_CLASSIC);
		expect(nextTheme(THEME_CLASSIC)).toBe(THEME_CHALK_SKY);
		expect(nextTheme(null)).toBe(THEME_CLASSIC);
	});

	it("themeToggleMeta returns label and tooltip for each theme", () => {
		expect(themeToggleMeta(THEME_CHALK_SKY)).toEqual({
			text: "Classic UI",
			title: "Switch to the classic light interface",
			isChalkSky: true,
		});
		expect(themeToggleMeta(THEME_CLASSIC)).toEqual({
			text: "New UI",
			title: "Switch to the Chalk & Sky interface",
			isChalkSky: false,
		});
	});
});

describe("route-type dots & filter chips", () => {
	it("maps iOS route types to dot classes with fallback", () => {
		expect(routeTypeDotClass("Sport")).toBe("rt-sport");
		expect(routeTypeDotClass("Boulder")).toBe("rt-boulder");
		expect(routeTypeDotClass("Multi-Pitch")).toBe("rt-multipitch");
		expect(routeTypeDotClass("Trad")).toBe("rt-trad");
		expect(routeTypeDotClass("Gym")).toBe("rt-gym");
		expect(routeTypeDotClass("Gym Boulder")).toBe("rt-gymboulder");
		expect(routeTypeDotClass("Unknown")).toBe("rt-default");
		expect(routeTypeDotClass(null)).toBe("rt-default");
		expect(Object.keys(ROUTE_TYPE_DOT_MAP)).toHaveLength(6);
	});

	it("buildRouteTypeChips prepends All Types and marks active chip", () => {
		const chips = buildRouteTypeChips(["Sport", "", "Boulder"], "Boulder");
		expect(chips).toEqual([
			{ value: "", label: "All Types", dotClass: null, active: false },
			{ value: "Sport", label: "Sport", dotClass: "rt-sport", active: false },
			{ value: "Boulder", label: "Boulder", dotClass: "rt-boulder", active: true },
		]);
		expect(buildRouteTypeChips(null)[0].active).toBe(true);
	});

	it("renderRouteTypeChipsHtml renders buttons with active state and dot spans", () => {
		const html = renderRouteTypeChipsHtml(["Sport", "Trad"], "Sport");
		expect(html).toContain('data-routetype=""');
		expect(html).toContain('class="rt-chip active" data-routetype="Sport"');
		expect(html).toContain('class="rt-dot rt-sport"');
		expect(html).toContain('data-routetype="Trad"');
	});

	it("renderCommunityOwnerIndicatorHtml shows cloud + Owner only for owned routes", () => {
		expect(renderCommunityOwnerIndicatorHtml(false)).toBe("");
		const html = renderCommunityOwnerIndicatorHtml(true);
		expect(html).toContain("cs-owner-indicator");
		expect(html).toContain(">Owner</span>");
		expect(html).toContain("classic-only");
	});

	it("renderRouteCellIndicatorsHtml renders cloud SVG and ISO country pill for community routes", () => {
		const linked = renderRouteCellIndicatorsHtml({
			centralRouteID: "r1",
			hasGps: true,
			countryCode: "AT",
			countryName: "Austria",
			flagEmoji: "🇦🇹",
		});
		expect(linked).toContain("cs-route-cloud");
		expect(linked).toContain("In community database");
		expect(linked).toContain('class="cs-route-iso" title="Austria">AT</span>');
		expect(linked).toContain("📍");

		const linkedNoCountry = renderRouteCellIndicatorsHtml({
			centralRouteID: "r2",
			hasGps: false,
			countryCode: null,
		});
		expect(linkedNoCountry).toContain("cs-route-cloud");
		expect(linkedNoCountry).not.toContain("cs-route-iso");

		const unlinked = renderRouteCellIndicatorsHtml({});
		expect(unlinked).not.toContain("cs-route-cloud");
		expect(unlinked).toContain("🌐");
	});
});

describe("escapeInspectorHtml()", () => {
	it("escapes HTML special characters and handles nullish values", () => {
		expect(escapeInspectorHtml('<a href="x">&\'</a>')).toBe(
			"&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
		);
		expect(escapeInspectorHtml(null)).toBe("");
	});
});

describe("compact climb-row helpers (Chalk & Sky list layout)", () => {
	it("styleAbbreviation maps all iOS send styles and falls back for unknowns", () => {
		expect(styleAbbreviation("Redpoint")).toBe("RP");
		expect(styleAbbreviation("On Sight")).toBe("OS");
		expect(styleAbbreviation("Top Rope")).toBe("TR");
		expect(styleAbbreviation("All Free")).toBe("AF");
		expect(styleAbbreviation("Pinkpoint")).toBe("PP");
		expect(styleAbbreviation("Project")).toBe("PJ");
		expect(styleAbbreviation("Flash")).toBe("FL");
		expect(styleAbbreviation("Top")).toBe("TP");
		expect(styleAbbreviation("Unknown")).toBe("UN");
		expect(styleAbbreviation(null)).toBe("—");
		expect(Object.keys(STYLE_ABBREVIATIONS)).toHaveLength(8);
	});

	it("formatShortNumericDate renders locale-aware numeric dates", () => {
		const d = new Date(2025, 9, 12);
		const out = formatShortNumericDate(d);
		expect(out).toMatch(/^\d{2}[./]\d{2}[./]\d{4}$/);
		expect(out).toContain("2025");
		expect(out).toContain("10");
		expect(out).toContain("12");
		expect(formatShortNumericDate("2025-10-12T00:00:00Z")).toMatch(/2025$/);
		expect(formatShortNumericDate(null)).toBe("—");
		expect(formatShortNumericDate("not-a-date")).toBe("—");
	});

	it("buildCompactClimbRowCellsHtml renders 6 cells: no rating, short date, shorthand style with tooltips", () => {
		const climb = {
			route: "Poundingertools",
			difficulty: "7b+",
			climbingArea: "Zillertal",
			crag: "Ewige Jagdgründe",
			routeType: "Sport",
			sendType: "Redpoint",
			date: new Date(2025, 9, 12),
			centralRouteID: "r1",
		};
		const html = buildCompactClimbRowCellsHtml(
			climb,
			{ gradeClass: "grade-normal", sendClass: "send-rp" },
			{
				gpsData: new Map([["r1", {}]]),
				routeCountries: new Map([["r1", "AT"]]),
				countryName: () => "Austria",
				flagEmoji: () => "🇦🇹",
				longDateText: "Oct 12, 2025",
			},
		);
		const tds = html.match(/<td[ >]/g) ?? [];
		expect(tds).toHaveLength(6); // Route, Area, Type, Grade, Date, Style
		expect(html).toContain('title="Oct 12, 2025"');
		expect(html).toContain('title="Redpoint"');
		expect(html).toContain(">RP</span>");
		expect(html).toContain("cs-date-cell");
		expect(html).toContain("cs-route-cloud");
		expect(html).toContain("cs-route-iso");
	});
});

describe("Route Detail Inspector HTML rendering", () => {
	it("returns empty-state markup when climb is null", () => {
		expect(renderInspectorEmptyHtml()).toContain("insp-empty");
		expect(renderInspectorHtml(null)).toContain("insp-empty");
	});

	it("renders route details, country badge, community rating, and notes", () => {
		const html = renderInspectorHtml(
			{
				route: "Poundingertools",
				difficulty: "7b+",
				climbingArea: "Zillertal",
				crag: "Ewige Jagdgründe",
				routeType: "Sport",
				sendType: "Redpoint",
				noteText: "Crux at bolt 5",
				centralRouteID: "route-123",
			},
			{
				country: "AT",
				dateFormatted: "Oct 12, 2025",
				sendBadgeClass: "send-rp",
				communityRating: 4.6,
			},
		);
		expect(html).toContain("Poundingertools");
		expect(html).toContain("insp-cloud-pill");
		expect(html).toContain("7b+");
		expect(html).toContain("Zillertal · Ewige Jagdgründe");
		expect(html).toContain(">AT<");
		expect(html).toContain("★ 4.6");
		expect(html).toContain("Log Ascent / Edit");
		// noteText now lives in the original-send ascent entry (combined in
		// climb-inspector-ui), not in a standalone Notes section
		expect(html).toContain(">Style</div>");
		expect(html).toContain(">Ascents</div>");
		expect(html).toContain('id="inspector-ascents-count">—</div>');
		expect(html).toContain("Coordinates");
		expect(html).not.toContain(">Date</div>");
	});

	it("renders project details and Edit Project button for projects", () => {
		const html = renderInspectorHtml({
			route: "Wogü",
			difficulty: "7c+",
			climbingArea: "Maltatal",
			routeType: "Sport",
			sendType: "Project",
			isProject: true,
			projectStatus: "working",
			attemptCount: 4,
			projectNotes: "Link to lip",
		});
		expect(html).toContain("Edit Project");
		expect(html).toContain("working · 4 attempts");
		expect(html).toContain("Link to lip");
		expect(html).toContain("insp-iso-pill hidden");
	});

	it("renders default project status when isProject is true without projectStatus", () => {
		const html = renderInspectorHtml({
			route: "Test",
			isProject: true,
		});
		expect(html).toContain("Working");
	});

	it("renderInspectorAscentsHtml handles empty and populated ascents", () => {
		const empty = renderInspectorAscentsHtml([]);
		expect(empty).toContain("0 entries");
		expect(empty).toContain("No ascents logged yet");
		expect(renderInspectorAscentsHtml(null)).toContain(
			"No ascents logged yet",
		);

		const single = renderInspectorAscentsHtml(
			[{ date: "2025-10-12T00:00:00Z", sendType: "Redpoint", notes: "Sent!" }],
			{ Redpoint: "send-rp" },
		);
		expect(single).toContain("1 entry");
		expect(single).toContain('title="Redpoint"');
		expect(single).toContain(">RP</span>");
		expect(single).toContain("send-rp");
		expect(single).toContain("Sent!");

		const multi = renderInspectorAscentsHtml([
			{ date: null, sendType: null },
			{ date: "2025-10-05T00:00:00Z", sendType: "Project" },
		]);
		expect(multi).toContain("2 entries");
	});

	it("combineAscentsWithOriginalSend prepends the original send and keeps repeats", () => {
		const climb = {
			date: new Date("2025-10-12T00:00:00Z"),
			sendType: "Redpoint",
			noteText: "Crux at bolt 5",
		};
		const all = combineAscentsWithOriginalSend(climb, [
			{ date: "2025-11-01T00:00:00Z", sendType: "Redpoint", notes: "Repeat" },
		]);
		expect(all).toHaveLength(2);
		expect(all[0]).toEqual({
			date: climb.date,
			sendType: "Redpoint",
			notes: "Crux at bolt 5",
			original: true,
		});
		expect(all[1].notes).toBe("Repeat");
	});

	it("combineAscentsWithOriginalSend handles projects and missing dates", () => {
		const project = combineAscentsWithOriginalSend(
			{ date: null, sendType: "Project", noteText: null },
			[],
		);
		expect(project).toHaveLength(1);
		expect(project[0].sendType).toBe("Project");
		expect(project[0].original).toBe(true);

		const bare = combineAscentsWithOriginalSend(
			{ date: null, sendType: null },
			[{ date: "2025-01-01", sendType: "Redpoint" }],
		);
		expect(bare).toHaveLength(1); // nothing to prepend
		expect(bare[0].original).toBeUndefined();
	});

	it("renderInspectorGpsHtml handles missing and valid coordinates", () => {
		expect(renderInspectorGpsHtml(null)).toBe("");
		expect(renderInspectorGpsHtml({ latitude: null, longitude: 11.8 })).toBe("");
		const html = renderInspectorGpsHtml(
			{ latitude: 47.09812, longitude: 11.87423 },
			"Poundingertools",
		);
		expect(html).toContain("47.09812°, 11.87423°");
		expect(html).toContain("maps.apple.com");
	});

	it("renderInspectorPhotosHtml handles empty and populated photos", () => {
		expect(renderInspectorPhotosHtml([])).toBe("");
		expect(renderInspectorPhotosHtml(null)).toBe("");
		const html = renderInspectorPhotosHtml([
			{ storageURL: "https://example.com/p1.jpg" },
		]);
		expect(html).toContain("insp-photos-strip");
		expect(html).toContain("https://example.com/p1.jpg");
	});
});
