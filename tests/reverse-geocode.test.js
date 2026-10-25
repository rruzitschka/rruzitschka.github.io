/**
 * Tests for reverse-geocode.js — client-side reverse geocoding behind the
 * admin "Save GPS Pin" flow. fetch is stubbed; the ISO list is real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { reverseGeocodeCountry } from "../app/js/reverse-geocode.js";

const fetchMock = vi.fn();

function jsonResponse(body, ok = true) {
	return { ok, json: async () => body };
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock); // re-stubbed each test; no real network
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("reverseGeocodeCountry()", () => {
	it("returns an uppercase ISO code on success", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ countryCode: "at" }));
		expect(await reverseGeocodeCountry(47.5, 14.1)).toBe("AT");
		const [url] = fetchMock.mock.calls[0];
		expect(url).toContain("latitude=47.5");
		expect(url).toContain("longitude=14.1");
	});

	it("returns null for unknown/empty country codes (oceans etc.)", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ countryCode: "" }));
		expect(await reverseGeocodeCountry(0, 0)).toBeNull();
		fetchMock.mockResolvedValue(jsonResponse({ countryCode: "ZZ" }));
		expect(await reverseGeocodeCountry(0, 0)).toBeNull();
	});

	it("returns null on HTTP errors", async () => {
		fetchMock.mockResolvedValue(jsonResponse({}, false));
		expect(await reverseGeocodeCountry(47.5, 14.1)).toBeNull();
	});

	it("returns null when fetch throws (network/timeout)", async () => {
		fetchMock.mockRejectedValue(new Error("offline"));
		expect(await reverseGeocodeCountry(47.5, 14.1)).toBeNull();
	});
});
