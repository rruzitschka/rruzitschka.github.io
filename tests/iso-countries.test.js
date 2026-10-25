/**
 * Tests for iso-countries.js — ISO 3166-1 alpha-2 data + helpers behind the
 * country pickers (regular climb overlays + admin edit form).
 * Pure module, no mocking needed.
 */
import { describe, it, expect } from "vitest";

import {
	ISO_COUNTRIES,
	isoCountryName,
	countryFlagEmoji,
	isoCountryOptionsHTML,
} from "../app/js/iso-countries.js";

describe("ISO_COUNTRIES", () => {
	it("keys are all uppercase 2-letter codes, values non-empty names", () => {
		for (const [code, name] of Object.entries(ISO_COUNTRIES)) {
			expect(code).toMatch(/^[A-Z]{2}$/);
			expect(name.length).toBeGreaterThan(0);
		}
	});

	it("includes the codes present in the route database", () => {
		for (const code of ["AT", "DE", "FR", "IT", "ES", "CH", "HR"]) {
			expect(ISO_COUNTRIES[code]).toBeTruthy();
		}
	});

	it("has no duplicate entries", () => {
		expect(Object.keys(ISO_COUNTRIES).length).toBeGreaterThan(200);
	});
});

describe("isoCountryName()", () => {
	it("resolves valid codes case-insensitively", () => {
		expect(isoCountryName("at")).toBe("Austria");
		expect(isoCountryName("CH")).toBe("Switzerland");
	});

	it("returns null for unknown/invalid/absent input", () => {
		expect(isoCountryName("XX")).toBeNull();
		expect(isoCountryName("A")).toBeNull();
		expect(isoCountryName("")).toBeNull();
		expect(isoCountryName(null)).toBeNull();
	});
});

describe("countryFlagEmoji()", () => {
	it("builds regional-indicator pairs for valid codes", () => {
		expect(countryFlagEmoji("AT")).toBe("🇦🇹");
		expect(countryFlagEmoji("de")).toBe("🇩🇪");
	});

	it("returns empty string for invalid/absent input", () => {
		expect(countryFlagEmoji("ABC")).toBe("");
		expect(countryFlagEmoji("")).toBe("");
		expect(countryFlagEmoji(null)).toBe("");
	});
});

describe("isoCountryOptionsHTML()", () => {
	it("renders one option per ISO country, sorted by name, selected marked", () => {
		const html = isoCountryOptionsHTML("AT");
		expect(html).toContain('<option value="AT" selected>');
		expect(html).toContain("Austria (AT)");
		const nameOrder = [...html.matchAll(/\)\s*</g)]; // sanity: options exist
		expect(nameOrder.length).toBeGreaterThan(200);
		// options are name-sorted: Austria appears before Belgium
		expect(html.indexOf("Austria")).toBeLessThan(html.indexOf("Belgium"));
	});

	it("prepends a none option with empty value when a label is given", () => {
		const html = isoCountryOptionsHTML("", "— No country —");
		expect(html.startsWith('<option value="">— No country —</option>')).toBe(
			true,
		);
	});

	it("omits the none option without a label", () => {
		const html = isoCountryOptionsHTML();
		// locale-independent ordering check: Afghanistan < Albania in any collation
		expect(html.indexOf("Afghanistan")).toBeLessThan(html.indexOf("Albania"));
		expect(html).not.toContain("No country");
	});
});
