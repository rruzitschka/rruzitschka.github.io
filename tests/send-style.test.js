/**
 * Tests for send-style.js — the pure send-type / route-type compatibility
 * rules mirrored from the iOS app (boulder coercion, gym rope trim, legacy
 * tab visibility).
 */
import { describe, it, expect } from "vitest";
import {
	normalizeSendType,
	canonicalizeSendType,
	BOULDER_ROUTE_TYPES,
	BOULDER_SEND_TYPES,
	GYM_ROUTE_TYPES,
	coerceSendTypeForRouteType,
	isStyleTabHidden,
	isBoulderRouteType,
	isGymRouteType,
} from "../app/js/send-style.js";

describe("coerceSendTypeForRouteType", () => {
	it("boulder: rope send types coerce to flash", () => {
		for (const current of ["redpoint", "on sight", "top rope", "all free"]) {
			expect(coerceSendTypeForRouteType(current, "Boulder")).toBe("flash");
			expect(coerceSendTypeForRouteType(current, "Gym Boulder")).toBe("flash");
		}
	});

	it("boulder: boulder-native types are kept", () => {
		expect(coerceSendTypeForRouteType("flash", "Boulder")).toBe("flash");
		expect(coerceSendTypeForRouteType("top", "Gym Boulder")).toBe("top");
	});

	it("gym: outdoor-only rope types coerce to redpoint", () => {
		expect(coerceSendTypeForRouteType("pinkpoint", "Gym")).toBe("redpoint");
		expect(coerceSendTypeForRouteType("all free", "Gym")).toBe("redpoint");
	});

	it("gym: indoor-meaningful rope types are kept", () => {
		for (const current of ["redpoint", "on sight", "top rope"]) {
			expect(coerceSendTypeForRouteType(current, "Gym")).toBe(current);
		}
	});

	it("outdoor rope: boulder-native types coerce to redpoint", () => {
		expect(coerceSendTypeForRouteType("flash", "Sport")).toBe("redpoint");
		expect(coerceSendTypeForRouteType("top", "Trad")).toBe("redpoint");
	});

	it("outdoor rope: rope types are kept", () => {
		expect(coerceSendTypeForRouteType("pinkpoint", "Sport")).toBe("pinkpoint");
		expect(coerceSendTypeForRouteType("all free", "Multi-Pitch")).toBe(
			"all free",
		);
	});
});

describe("isStyleTabHidden", () => {
	it("boulder hides rope tabs and shows Flash/Top", () => {
		for (const routeType of ["Boulder", "Gym Boulder"]) {
			expect(isStyleTabHidden("Flash", "flash", routeType)).toBe(false);
			expect(isStyleTabHidden("Top", "top", routeType)).toBe(false);
			expect(isStyleTabHidden("Redpoint", "flash", routeType)).toBe(true);
			expect(isStyleTabHidden("Pinkpoint", "flash", routeType)).toBe(true);
		}
	});

	it("gym rope hides Flash/Top and outdoor-only styles", () => {
		expect(isStyleTabHidden("Redpoint", "redpoint", "Gym")).toBe(false);
		expect(isStyleTabHidden("On Sight", "redpoint", "Gym")).toBe(false);
		expect(isStyleTabHidden("Top Rope", "redpoint", "Gym")).toBe(false);
		expect(isStyleTabHidden("Flash", "redpoint", "Gym")).toBe(true);
		expect(isStyleTabHidden("Top", "redpoint", "Gym")).toBe(true);
		expect(isStyleTabHidden("Pinkpoint", "redpoint", "Gym")).toBe(true);
		expect(isStyleTabHidden("All Free", "redpoint", "Gym")).toBe(true);
	});

	it("outdoor rope shows all rope styles and hides Flash/Top", () => {
		for (const routeType of ["Sport", "Trad", "Multi-Pitch"]) {
			expect(isStyleTabHidden("Pinkpoint", "redpoint", routeType)).toBe(false);
			expect(isStyleTabHidden("All Free", "redpoint", routeType)).toBe(false);
			expect(isStyleTabHidden("Flash", "redpoint", routeType)).toBe(true);
		}
	});

	it("legacy send types stay visible on their note (matchesCurrent)", () => {
		expect(isStyleTabHidden("Redpoint", "redpoint", "Gym Boulder")).toBe(false);
		expect(isStyleTabHidden("Pinkpoint", "pinkpoint", "Gym")).toBe(false);
	});
});

describe("route-type predicates", () => {
	it("boulder types", () => {
		expect(BOULDER_ROUTE_TYPES).toEqual(["Boulder", "Gym Boulder"]);
		expect(BOULDER_SEND_TYPES).toEqual(["flash", "top"]);
		expect(isBoulderRouteType("Gym Boulder")).toBe(true);
		expect(isBoulderRouteType("Gym")).toBe(false);
	});

	it("gym types (Set)", () => {
		expect(GYM_ROUTE_TYPES.has("Gym")).toBe(true);
		expect(GYM_ROUTE_TYPES.has("Gym Boulder")).toBe(true);
		expect(isGymRouteType("Sport")).toBe(false);
	});
});

describe("normalize/canonicalize round-trip", () => {
	it("all display values round-trip", () => {
		for (const display of [
			"Redpoint",
			"On Sight",
			"Top Rope",
			"All Free",
			"Pinkpoint",
			"Project",
			"Flash",
			"Top",
		]) {
			expect(normalizeSendType(canonicalizeSendType(display))).toBe(display);
		}
	});
});
