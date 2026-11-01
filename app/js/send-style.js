// send-style.js — send-type vocabulary and route-type compatibility rules.
//
// Pure module: no Firestore, no DOM — vitest-testable. Mirrors the iOS
// behavior (boulderSendTypes, coercion on route-type switch, Project never
// coerced). ui.js keeps only the thin DOM application of these rules.

"use strict";

/** Firestore canonical format (lowercase, iOS-native).
 * Web displays Title Case; normalize before every write. */
const SEND_TYPE_NORMALIZE = {
	redpoint: "Redpoint",
	onsight: "On Sight",
	"on sight": "On Sight",
	"top rope": "Top Rope",
	toprope: "Top Rope",
	"all free": "All Free",
	allfree: "All Free",
	project: "Project",
	pinkpoint: "Pinkpoint",
	flash: "Flash",
	top: "Top",
};

/** Display-facing Title Case → lowercase value stored in Firestore. */
const SEND_TYPE_CANONICAL = {
	Redpoint: "redpoint",
	"On Sight": "on sight",
	"Top Rope": "top rope",
	"All Free": "all free",
	Project: "project",
	Pinkpoint: "pinkpoint",
	Flash: "flash",
	Top: "top",
};

/** Firestore → display-facing Title Case. */
export function normalizeSendType(raw) {
	return SEND_TYPE_NORMALIZE[raw?.toLowerCase()] ?? raw ?? "Redpoint";
}

/** Display-facing Title Case → lowercase Firestore value. */
export function canonicalizeSendType(raw) {
	return SEND_TYPE_CANONICAL[raw] ?? raw?.toLowerCase() ?? "redpoint";
}

/** Route types whose sends use the boulder-native send types (flash / top). */
export const BOULDER_ROUTE_TYPES = ["Boulder", "Gym Boulder"];
/** Send types native to boulder logging (lowercase, iOS-native). */
export const BOULDER_SEND_TYPES = ["flash", "top"];

/** Route types logged inside a gym (gym name lives in `crag`, ADR 0005). */
export const GYM_ROUTE_TYPES = new Set(["Gym", "Gym Boulder"]);

/** Rope send types (lowercase). */
export const ROPE_SEND_TYPES = new Set([
	"redpoint",
	"on sight",
	"top rope",
	"all free",
	"pinkpoint",
]);

/** Send types meaningful for rope climbing in a gym — pinkpoint/all free
 * are outdoor-specific (gear, whole-free ascent). */
export const GYM_ROPE_SEND_TYPES = new Set([
	"redpoint",
	"on sight",
	"top rope",
]);

export function isBoulderRouteType(routeType) {
	return BOULDER_ROUTE_TYPES.includes(routeType);
}

export function isGymRouteType(routeType) {
	return GYM_ROUTE_TYPES.has(routeType);
}

/** iOS GymSessionWizard parity: coerce the send type on a route-type switch
 * (boulder → Flash unless already boulder-native; rope → Redpoint unless
 * already rope-native; gyms additionally drop pinkpoint/all free). Project
 * is never coerced — the caller guards that. */
export function coerceSendTypeForRouteType(current, routeType) {
	if (isBoulderRouteType(routeType))
		return BOULDER_SEND_TYPES.includes(current) ? current : "flash";
	if (isGymRouteType(routeType))
		return GYM_ROPE_SEND_TYPES.has(current) ? current : "redpoint";
	return ROPE_SEND_TYPES.has(current) ? current : "redpoint";
}

/** Should the given style tab be hidden for this route type / send type?
 * Boulder shows Flash/Top, rope shows rope styles (gyms without
 * pinkpoint/all free); a legacy send type that matches no visible tab stays
 * selectable (iOS keeps legacy types selectable on edits). */
export function isStyleTabHidden(style, current, routeType) {
	const isBoulderTab = style === "Flash" || style === "Top";
	const isOutdoorOnly = style === "Pinkpoint" || style === "All Free";
	const allowed = isBoulderRouteType(routeType)
		? isBoulderTab
		: !isBoulderTab && !(isGymRouteType(routeType) && isOutdoorOnly);
	const matchesCurrent = canonicalizeSendType(style) === current;
	return !(allowed || matchesCurrent);
}
