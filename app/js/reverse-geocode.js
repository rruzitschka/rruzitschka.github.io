// reverse-geocode.js — client-side reverse geocoding for admin GPS pin saves.
//
// Uses BigDataCloud's free reverse-geocode-client endpoint (no API key,
// intended for client-side use). Returns an ISO 3166-1 alpha-2 code only
// when the response carries a known code; null on any failure so callers
// can leave an existing country untouched.

"use strict";

import { ISO_COUNTRIES } from "./iso-countries.js";

const ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/**
 * Reverse-geocode coordinates into an ISO 3166-1 alpha-2 country code.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string|null>} uppercase ISO code, or null when the
 *   geocoding fails / returns no known country (oceans, remote coordinates).
 *   Null means "leave the route's country untouched" — never null-out.
 */
export async function reverseGeocodeCountry(latitude, longitude) {
	try {
		const url = `${ENDPOINT}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
		const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
		if (!res.ok) return null;
		const data = await res.json();
		const code = (data?.countryCode ?? "").trim().toUpperCase();
		return ISO_COUNTRIES[code] ? code : null;
	} catch {
		return null; // network error / timeout — caller keeps the current country
	}
}
