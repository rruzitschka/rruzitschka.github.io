// overlay-country.js — Country select wiring for the Send/Project climb
// overlays. Country is an attribute of the central route (not the climb
// note), so the selects are populated from the ISO 3166-1 alpha-2 list and
// only enabled when a route is linked AND the current user owns it.
//
// Deliberately Firestore-free: the caller (ui.js) passes overlay link state
// in, keeping this module DOM-only and unit-testable.

"use strict";

import { isoCountryOptionsHTML } from "./iso-countries.js";

const SELECT_IDS = ["so-country", "po-country"];

/**
 * Owner rule: the country of a route about to be created is editable (the
 * current user will own it); otherwise only when the route is linked, its
 * owner is known, and the current user is that owner.
 */
function isOwnerState({ uid, centralRouteID, pendingNewCentralRoute, createdBy, country }) {
	if (pendingNewCentralRoute) return true;
	return Boolean(centralRouteID) && createdBy === uid && country !== undefined;
}

/** Tooltip explaining why the select is (dis)abled. */
function selectTooltip(hasRoute, isOwner) {
	if (!hasRoute) return "Link a route first — the country belongs to the route";
	return isOwner ? "" : "Only the route owner can change the country";
}

/**
 * Fill both overlay country selects once per session.
 * Options come from the ISO 3166-1 alpha-2 list (see iso-countries.js).
 */
function populateSelects() {
	SELECT_IDS.forEach((id) => {
		const el = document.getElementById(id);
		if (el && el.options.length <= 1) {
			el.innerHTML = isoCountryOptionsHTML("", "— No country —");
		}
	});
}

/**
 * Sync value + enabled state of the overlay country selects with the
 * current soft-link state.
 *
 * @param {{
 *   uid: string|null,
 *   centralRouteID: string|null,
 *   pendingNewCentralRoute: object|null,   // route about to be created
 *   createdBy: string|null,                // route createdBy (null = unknown)
 *   country: string|null|undefined,        // undefined = not yet fetched
 * }} state
 */
function refreshSelects({
	uid,
	centralRouteID,
	pendingNewCentralRoute,
	createdBy,
	country,
}) {
	const hasRoute = Boolean(centralRouteID || pendingNewCentralRoute);
	const owner = isOwnerState({ uid, centralRouteID, pendingNewCentralRoute, createdBy, country });
	const title = selectTooltip(hasRoute, owner);
	SELECT_IDS.forEach((id) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.disabled = !owner;
		el.title = title;
		if (country !== undefined) el.value = country ?? "";
	});
}

/**
 * Single entry point for ui.js: (re-)populate and sync both selects with the
 * given overlay soft-link state. Cheap + idempotent — safe to call on every
 * overlay open, link change, and async route fetch.
 *
 * @param {{
 *   uid: string|null,
 *   centralRouteID: string|null,
 *   pendingNewCentralRoute: object|null,
 *   createdBy: string|null,
 *   country: string|null|undefined,
 * }} state
 */
export function syncCountrySelects(state) {
	populateSelects();
	refreshSelects(state);
}

/**
 * Fields to spread into the central-route update on save. Returns {} while
 * the linked route's current country is not yet known — otherwise a fast
 * save before the route fetch resolved could silently wipe the country.
 * Select value "" maps to null (= "clear country") in updateCentralRoute.
 *
 * @param {string} fieldPrefix "so"|"po"
 * @param {string|null|undefined} knownCountry current route country (undefined = unknown)
 * @returns {{ country?: string|null }}
 */
export function overlayCountryChange(fieldPrefix, knownCountry) {
	if (knownCountry === undefined) return {};
	const el = document.getElementById(`${fieldPrefix}-country`);
	return { country: el ? el.value.trim().toUpperCase() : "" };
}
