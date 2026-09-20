// firebase-routes.js — Central route database service (modular SDK)
// Depends on: firebase-config.js, firebase-auth.js

"use strict";

import {
	collection,
	collectionGroup,
	doc,
	documentId,
	getDoc,
	getDocs,
	setDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	limit,
	runTransaction,
	serverTimestamp,
	increment,
	writeBatch,
	startAfter,
	getCountFromServer,
} from "firebase/firestore";
import {
	foldedForSearch,
	buildRouteQuery,
	routeQueryStreamKeys,
	mapQueryDescriptors,
	mergeRouteStreams,
} from "./admin-routes-browser.js";
import { db, auth } from "./firebase-config.js";

// ── Grade normalization ────────────────────────────────────────────────────
// Must match GradeSystem.swift and grades.js exactly (36 grades each)
const FRENCH = [
	"3b",
	"3c",
	"4a",
	"4b",
	"4c",
	"5a",
	"5b",
	"5b+",
	"5c",
	"5c+",
	"6a",
	"6a+",
	"6b",
	"6b+",
	"6c",
	"6c+",
	"7a",
	"7a+",
	"7b",
	"7b+",
	"7c",
	"7c+",
	"8a",
	"8a+",
	"8b",
	"8b+",
	"8c",
	"8c+",
	"9a",
	"9a+",
	"9b",
	"9b+",
	"9c",
	"9c+",
	"10a",
	"10b",
];
const YDS = [
	"5.3",
	"5.4",
	"5.5",
	"5.6",
	"5.7",
	"5.8",
	"5.9",
	"5.9+",
	"5.10a",
	"5.10a+",
	"5.10b",
	"5.10c",
	"5.10d",
	"5.11a",
	"5.11b",
	"5.11c",
	"5.11d",
	"5.12a",
	"5.12b",
	"5.12c",
	"5.12d",
	"5.13a",
	"5.13b",
	"5.13c",
	"5.13d",
	"5.14a",
	"5.14b",
	"5.14c",
	"5.14d",
	"5.15a",
	"5.15b",
	"5.15c",
	"5.15d",
	"5.16a",
	"5.16b",
	"5.16c",
];
const UIAA = [
	"3",
	"3+",
	"4-",
	"4",
	"4+",
	"5",
	"6-",
	"6-/6",
	"6",
	"6/6+",
	"6+",
	"7-",
	"7",
	"7+",
	"8-",
	"8",
	"8+",
	"9-",
	"9",
	"9+",
	"10-",
	"10",
	"10+",
	"11-",
	"11",
	"11+",
	"12-",
	"12",
	"12+",
	"13-",
	"13",
	"13+",
	"14-",
	"14",
	"14+",
	"15-",
];
const SYSTEM_ARRAYS = { French: FRENCH, YDS, UIAA };

function detectRouteGradeSystem(grade) {
	if (!grade) return "French";
	for (const [system, arr] of Object.entries(SYSTEM_ARRAYS)) {
		if (arr.includes(grade)) return system;
	}
	return "French";
}

function normalizeToFrench(grade) {
	const system = detectRouteGradeSystem(grade);
	if (system === "French") return grade;
	const source = SYSTEM_ARRAYS[system];
	const idx = source.indexOf(grade);
	if (idx === -1) return FRENCH[0];
	return FRENCH[Math.min(idx, FRENCH.length - 1)];
}

export function convertFromFrench(frenchGrade, targetSystem) {
	if (!targetSystem || targetSystem === "French") return frenchGrade;
	const target = SYSTEM_ARRAYS[targetSystem];
	if (!target) return frenchGrade;
	const idx = FRENCH.indexOf(frenchGrade);
	if (idx === -1) return frenchGrade;
	return target[Math.min(idx, target.length - 1)];
}

// ── Firestore search ───────────────────────────────────────────────────────
// foldedForSearch() lives in admin-routes-browser.js (pure, unit-tested) and
// is imported above.

export async function searchRoutes(
	namePrefix,
	cragFilter = null,
	displaySystem = "French",
	maxResults = 20,
) {
	const normalized = foldedForSearch(namePrefix);
	const normalizedCrag = foldedForSearch(cragFilter);

	// Mirror iOS RouteRepository.search(): require >= 2 chars in name OR crag
	if (normalized.length < 2 && normalizedCrag.length < 2) return [];

	let snapshot;

	if (normalized.length < 2) {
		// Crag-only: Firestore can't do substring (contains) search natively,
		// so fetch a broad ordered batch and filter client-side with includes().
		// This matches the UX intent: typing "gou" finds "Les Gours Noirs",
		// "pal" finds "Sector Pal", "face" finds "La Face", etc.
		snapshot = await getDocs(
			query(collection(db, "routes"), orderBy("cragSearch"), limit(200)),
		);
	} else {
		// Name prefix path: Firestore prefix query on nameSearch
		snapshot = await getDocs(
			query(
				collection(db, "routes"),
				where("nameSearch", ">=", normalized),
				where("nameSearch", "<", normalized + "\uf8ff"),
				limit(maxResults),
			),
		);
	}

	let routes = snapshot.docs.map((routeDoc) => {
		const d = routeDoc.data();
		return {
			id: d.id ?? routeDoc.id,
			name: d.name ?? "",
			climbingArea: d.climbingArea ?? "",
			crag: d.crag ?? "",
			grade: d.grade ?? "",
			displayGrade: convertFromFrench(d.grade ?? "", displaySystem),
			createdGrade: d.createdGrade ?? d.grade ?? "",
			routeType: d.routeType ?? "Sport",
			sendCount: d.sendCount ?? 0,
			projectCount: d.projectCount ?? 0,
			attemptCount: d.attemptCount ?? 0,
			isOrphaned: d.isOrphaned ?? false,
			createdBy: d.createdBy ?? null,
			ratingSum: d.ratingSum ?? 0,
			ratingCount: d.ratingCount ?? 0,
			communityRating:
				(d.ratingCount ?? 0) > 0
					? (d.ratingSum ?? 0) / (d.ratingCount ?? 0)
					: null,
			latitude: d.latitude ?? null,
			longitude: d.longitude ?? null,
			country: d.country ?? null,
		};
	});

	// Apply client-side crag contains filter in both paths:
	// - crag-only: the Firestore fetch is unfiltered, so this does all the work
	// - combined:  Firestore filtered by name prefix, crag narrows further
	if (normalizedCrag.length >= 2) {
		routes = routes.filter((r) =>
			foldedForSearch(r.crag).includes(normalizedCrag),
		);
	}

	return routes.slice(0, maxResults);
}

// ── Admin routes browser (paginated list + server-side filters) ─────────────

/**
 * Map a Firestore route doc snapshot to the plain object shape used by the
 * admin browser (list rows + edit form entry point).
 */
function routeFromDocSnap(d) {
	const data = d.data();
	return {
		id: data.id ?? d.id,
		name: data.name ?? "",
		nameSearch: data.nameSearch ?? "",
		climbingArea: data.climbingArea ?? "",
		crag: data.crag ?? "",
		grade: data.grade ?? "",
		createdGrade: data.createdGrade ?? data.grade ?? "",
		routeType: data.routeType ?? "Sport",
		sendCount: data.sendCount ?? 0,
		projectCount: data.projectCount ?? 0,
		attemptCount: data.attemptCount ?? 0,
		isOrphaned: data.isOrphaned ?? false,
		createdBy: data.createdBy ?? null,
		updatedBy: data.updatedBy ?? null,
		updatedAt: data.updatedAt?.toDate?.() ?? null,
		latitude: data.latitude ?? null,
		longitude: data.longitude ?? null,
		country: data.country ?? null,
	};
}

/** Cache key for the per-filter-set count cache. */
function adminCountCacheKey(filters) {
	const folded = foldedForSearch(filters.searchText ?? "").trim();
	return JSON.stringify([
		folded,
		filters.searchField ?? "any",
		filters.routeType ?? null,
		filters.country ?? null,
		filters.isOrphaned ?? null,
	]);
}

// Per-filter-set total count cache — one set of count reads per filter combo.
// Entries expire after 60s so backfills / batch applies show up promptly.
const _adminRouteCountCache = new Map();
const _COUNT_TTL_MS = 60_000;

async function adminRouteCount(filters) {
	const cacheKey = adminCountCacheKey(filters);
	const cached = _adminRouteCountCache.get(cacheKey);
	if (cached && Date.now() - cached.at < _COUNT_TTL_MS) return cached.total;
	if (_adminRouteCountCache.size > 100) _adminRouteCountCache.clear();

	const fieldKeys = routeQueryStreamKeys(filters.searchText, filters.searchField);
	const counts = await Promise.all(
		fieldKeys.map(async (k) => {
			// Count ignores pagination: strip limit/startAfter, keep filters + bounds.
			const descriptors = buildRouteQuery({ ...filters, searchField: k, pageSize: 1 }).filter(
				(d) => d.kind !== "limit" && d.kind !== "startAfter",
			);
			const q = query(
				collection(db, "routes"),
				...mapQueryDescriptors(descriptors, { where, orderBy, limit, startAfter }),
			);
			const snap = await getCountFromServer(q);
			return snap.data().count ?? 0;
		}),
	);
	const total = counts.reduce((sum, n) => sum + n, 0);
	// Per-stream counts for the merged "any" case can double-count docs that
	// match more than one field; the merged page dedupes, so report the raw sum
	// as an upper bound ("N routes" header).
	_adminRouteCountCache.set(cacheKey, { total, at: Date.now() });
	return total;
}

/**
 * Paginated admin route list with server-side filters and combined prefix
 * search (name / crag / area). Companion to admin.js — see
 * docs/plan-admin-routes-browser.md.
 *
 * - No search text: single stream ordered by nameSearch (browse-all).
 * - Search text + searchField "any": three parallel prefix streams merged
 *   client-side (dedupe by id, sort by nameSearch, slice to pageSize).
 * - Search text + explicit searchField: single stream, clean cursors.
 *
 * Cursors: pass the previous response's `nextCursors` to advance one page.
 * Exhausted streams are skipped automatically and stay skipped.
 *
 * @param {{
 *   searchText?: string,
 *   searchField?: "any"|"name"|"crag"|"area",
 *   routeType?: string|null,
 *   country?: string|null,
 *   isOrphaned?: boolean|null,   // always pass true/false from the UI
 *   pageSize?: number,
 *   cursors?: {{ docs: Object<string, object>, exhausted: string[] }} | null,
 * }} [options]
 * @returns {Promise<{ routes: object[], nextCursors: object, total: number }>}
 */
export async function adminQueryRoutes({
	searchText = "",
	searchField = "any",
	routeType = null,
	country = null,
	isOrphaned = null,
	pageSize = 25,
	cursors = null,
} = {}) {
	const filters = { searchText, searchField, routeType, country, isOrphaned, pageSize };
	const fieldKeys = routeQueryStreamKeys(searchText, searchField);
	const exhausted = new Set(cursors?.exhausted ?? []);
	const active = fieldKeys.filter((k) => !exhausted.has(k));

	const streamSnaps = await Promise.all(
		active.map(async (k) => {
			const descriptors = buildRouteQuery(
				{ ...filters, searchField: k },
				cursors?.docs?.[k] ?? null,
			);
			const q = query(
				collection(db, "routes"),
				...mapQueryDescriptors(descriptors, { where, orderBy, limit, startAfter }),
			);
			return { field: k, snap: await getDocs(q) };
		}),
	);

	const streams = [];
	const nextDocs = { ...(cursors?.docs ?? {}) };
	const nextExhausted = new Set(exhausted);
	for (const { field, snap } of streamSnaps) {
		streams.push(snap.docs.map(routeFromDocSnap));
		if (snap.docs.length < pageSize) {
			nextExhausted.add(field);
		} else {
			nextDocs[field] = snap.docs[snap.docs.length - 1];
		}
	}

	const total = await adminRouteCount(filters);

	return {
		routes: mergeRouteStreams(streams, pageSize),
		nextCursors: { docs: nextDocs, exhausted: [...nextExhausted] },
		total,
	};
}

/**
 * Scan every route matching the given browser filters (same semantics as
 * adminQueryRoutes — the batch applies to exactly what the search shows) and
 * classify each doc for a country batch apply.
 *
 * HARD INVARIANT: routes with a GPS pin (latitude != null) are NEVER touched
 * by the batch — their country is GPS-derived (reverse geocoded) and is the
 * authoritative source. The per-route edit form is the designated tool for
 * correcting GPS-derived countries.
 *
 * @param {{ searchText?, searchField?, routeType?, country?, isOrphaned? }} filters
 * @param {boolean} fillEmptyOnly  true → classify docs with a non-empty
 *   country as skippedAlreadySet (fill mode); false → they are apply targets
 * @param {({ scanned: number }) => void} [onProgress]
 * @returns {Promise<{ targets: Array<{id, ref, data}>, skippedAlreadySet: number,
 *                     skippedGPS: number, scanned: number }>}
 */
export async function adminScanCountryTargets(
	filters,
	fillEmptyOnly = true,
	onProgress,
) {
	const fieldKeys = routeQueryStreamKeys(filters.searchText, filters.searchField);
	const BATCH_SCAN = 500;
	const seen = new Set();
	const targets = [];
	let skippedAlreadySet = 0;
	let skippedGPS = 0;
	let scanned = 0;

	for (const k of fieldKeys) {
		let cursor = null;
		for (;;) {
			const descriptors = buildRouteQuery(
				{ ...filters, searchField: k, pageSize: BATCH_SCAN },
				cursor,
			);
			const q = query(
				collection(db, "routes"),
				...mapQueryDescriptors(descriptors, { where, orderBy, limit, startAfter }),
			);
			const snap = await getDocs(q);
			for (const d of snap.docs) {
				if (seen.has(d.id)) continue;
				seen.add(d.id);
				scanned += 1;
				const data = d.data();
				if (data.latitude != null) {
					skippedGPS += 1; // hard invariant — never modified by the batch
				} else if (fillEmptyOnly && (data.country ?? "") !== "") {
					skippedAlreadySet += 1;
				} else {
					targets.push({ id: d.id, ref: d.ref, data });
				}
			}
			onProgress?.({ scanned });
			if (snap.docs.length < BATCH_SCAN) break;
			cursor = snap.docs[snap.docs.length - 1];
		}
	}
	return { targets, skippedAlreadySet, skippedGPS, scanned };
}

/**
 * Write the country field onto pre-scanned target docs (from
 * adminScanCountryTargets) in writeBatch groups of ≤500. Never touches GPS
 * fields, never touches docs outside `targets`.
 *
 * @param {Array<{id, ref, data}>} targets
 * @param {string} country ISO country code
 * @param {({ updated: number, total: number }) => void} [onProgress]
 * @returns {Promise<number>} number of docs written
 */
export async function adminApplyCountryToTargets(
	targets,
	country,
	onProgress,
) {
	if (!country) throw new Error("country is required");
	const uid = auth.currentUser?.uid ?? "unknown";
	const BATCH_WRITE = 500;
	let updated = 0;

	for (let i = 0; i < targets.length; i += BATCH_WRITE) {
		const batch = writeBatch(db);
		for (const t of targets.slice(i, i + BATCH_WRITE)) {
			batch.update(t.ref, {
				country,
				updatedBy: uid,
				updatedAt: serverTimestamp(),
				recentEdits: [
					{
						editedAt: new Date(),
						editedBy: uid,
						note: "admin country batch update",
					},
					...(t.data.recentEdits ?? []),
				].slice(0, 3),
			});
		}
		await batch.commit();
		updated += Math.min(BATCH_WRITE, targets.length - i);
		onProgress?.({ updated, total: targets.length });
	}
	_adminRouteCountCache.clear(); // country filter/count may have changed
	return updated;
}

/**
 * One-shot helper: scan + write in sequence (see adminScanCountryTargets and
 * adminApplyCountryToTargets). The admin UI uses the split flow so the
 * confirmation dialog can show exact counts before any write happens.
 *
 * @param {{ filters: { searchText?, searchField?, routeType?, country?, isOrphaned? },
 *           country: string, fillEmptyOnly?: boolean,
 *           onProgress?: ({ scanned, updated }) => void }} options
 */
export async function adminApplyCountryToMatching({
	filters,
	country: applyCountry,
	fillEmptyOnly = true,
	onProgress,
}) {
	if (!applyCountry) throw new Error("country is required");
	const { targets, skippedAlreadySet, skippedGPS } = await adminScanCountryTargets(
		filters,
		fillEmptyOnly,
		onProgress ? ({ scanned }) => onProgress({ scanned, updated: 0 }) : undefined,
	);
	const updatedCount = await adminApplyCountryToTargets(
		targets,
		applyCountry,
		onProgress ? ({ updated, total }) => onProgress({ scanned: targets.length, updated, total }) : undefined,
	);
	return { updated: updatedCount, skippedAlreadySet, skippedGPS };
}

export async function createCentralRoute({
	name,
	climbingArea,
	crag,
	grade,
	gradeSystem,
	routeType,
}) {
	const user = auth.currentUser;
	if (!user) throw new Error("Not signed in");

	const id = doc(collection(db, "routes")).id;
	const french = normalizeToFrench(grade);
	const system = detectRouteGradeSystem(grade);
	const now = serverTimestamp();

	await setDoc(doc(db, "routes", id), {
		id,
		name,
		climbingArea: climbingArea ?? "",
		crag: crag ?? "",
		grade: french,
		createdGrade: grade,
		createdGradeSystem: gradeSystem ?? system,
		routeType: routeType ?? "Sport",
		length: null,
		sendCount: 0,
		attemptCount: 0,
		projectCount: 0,
		ratingSum: 0,
		ratingCount: 0,
		createdAt: now,
		updatedAt: now,
		createdBy: user.uid,
		isOrphaned: false,
		orphanedAt: null,
		nameSearch: foldedForSearch(name),
		cragSearch: foldedForSearch(crag ?? ""),
		areaSearch: foldedForSearch(climbingArea ?? ""),
	});

	return id;
}

// ── Counter updates (fire-and-forget) ─────────────────────────────────────

export function incrementSendCount(routeID) {
	updateDoc(doc(db, "routes", routeID), {
		sendCount: increment(1),
		updatedAt: serverTimestamp(),
	}).catch((err) => console.warn("incrementSendCount failed:", err));
}

export function incrementProjectCount(routeID) {
	updateDoc(doc(db, "routes", routeID), {
		projectCount: increment(1),
		updatedAt: serverTimestamp(),
	}).catch((err) => console.warn("incrementProjectCount failed:", err));
}

export function decrementProjectCount(routeID) {
	updateDoc(doc(db, "routes", routeID), {
		projectCount: increment(-1),
		updatedAt: serverTimestamp(),
	}).catch((err) => console.warn("decrementProjectCount failed:", err));
}

export function completedProject(routeID) {
	updateDoc(doc(db, "routes", routeID), {
		projectCount: increment(-1),
		sendCount: increment(1),
		updatedAt: serverTimestamp(),
	}).catch((err) => console.warn("completedProject counters failed:", err));
}

// ── Community rating ────────────────────────────────────────────────────────

/**
 * Compute the increment deltas needed to update ratingSum / ratingCount.
 * Returns null when no write is needed (no-op case).
 * Mirrors RouteRepository.ratingDeltas(newRating:previousRating:) in iOS.
 */
export function ratingDeltas(newRating, previousRating) {
	const n = newRating ?? 0;
	const p = previousRating ?? 0;
	if (n === p) return null; // unchanged — no-op

	if (p === 0 && n > 0) return { sumDelta: n, countDelta: 1 }; // first rating
	if (n === 0 && p > 0) return { sumDelta: -p, countDelta: -1 }; // rating removed
	return { sumDelta: n - p, countDelta: 0 }; // changed
}

/**
 * Report a rating change to the central route document.
 * Fire-and-forget — never throws or blocks the caller.
 * Mirrors RouteRepository.reportRating(routeID:newRating:previousRating:) in iOS.
 */
export function reportRating(routeID, newRating, previousRating) {
	const deltas = ratingDeltas(newRating, previousRating);
	if (!deltas) return;

	const fields = { updatedAt: serverTimestamp() };
	if (deltas.sumDelta !== 0) fields.ratingSum = increment(deltas.sumDelta);
	if (deltas.countDelta !== 0)
		fields.ratingCount = increment(deltas.countDelta);

	updateDoc(doc(db, "routes", routeID), fields).catch((err) =>
		console.warn("reportRating failed:", err),
	);
}

// ── Owner update ───────────────────────────────────────────────────────────

export function updateCentralRoute(
	routeID,
	{ name, climbingArea, crag, grade, gradeSystem, routeType },
) {
	const uid = auth.currentUser?.uid ?? "unknown";
	const french = normalizeToFrench(grade);
	const ref = doc(db, "routes", routeID);
	runTransaction(db, async (tx) => {
		const snap = await tx.get(ref);
		if (!snap.exists()) return;
		const prev = snap.data().recentEdits ?? [];
		const next = [{ editedAt: new Date(), editedBy: uid }, ...prev].slice(0, 3);
		tx.update(ref, {
			name,
			climbingArea: climbingArea ?? "",
			crag: crag ?? "",
			grade: french,
			createdGrade: grade,
			createdGradeSystem: gradeSystem ?? detectRouteGradeSystem(grade),
			routeType: routeType ?? "Sport",
			nameSearch: foldedForSearch(name),
			cragSearch: foldedForSearch(crag ?? ""),
			areaSearch: foldedForSearch(climbingArea ?? ""),
			updatedBy: uid,
			updatedAt: serverTimestamp(),
			recentEdits: next,
		});
	}).catch((err) => console.warn("updateCentralRoute failed:", err));
}

// ── Admin ──────────────────────────────────────────────────────────────────

let _adminStatusCache = null; // null = unknown, true/false = resolved

export async function checkAdminStatus() {
	if (_adminStatusCache !== null) return _adminStatusCache;
	const user = auth.currentUser;
	if (!user) {
		_adminStatusCache = false;
		return false;
	}
	try {
		const adminSnap = await getDoc(doc(db, "admins", user.uid));
		_adminStatusCache = adminSnap.exists();
	} catch {
		_adminStatusCache = false;
	}
	return _adminStatusCache;
}

export async function adminSaveRoute(
	routeID,
	{
		name,
		climbingArea,
		crag,
		grade,
		gradeSystem,
		routeType,
		createdBy,
		isOrphaned,
		country,
	},
) {
	const uid = auth.currentUser?.uid ?? "unknown";
	const french = normalizeToFrench(grade);
	const ref = doc(db, "routes", routeID);
	await runTransaction(db, async (tx) => {
		const snap = await tx.get(ref);
		if (!snap.exists()) throw new Error("Route not found");
		const data = snap.data();
		const prev = data.recentEdits ?? [];
		const next = [{ editedAt: new Date(), editedBy: uid }, ...prev].slice(0, 3);

		const fields = {
			name,
			climbingArea: climbingArea ?? "",
			crag: crag ?? "",
			grade: french,
			createdGrade: grade,
			createdGradeSystem: gradeSystem ?? detectRouteGradeSystem(grade),
			routeType: routeType ?? "Sport",
			nameSearch: foldedForSearch(name),
			cragSearch: foldedForSearch(crag ?? ""),
			areaSearch: foldedForSearch(climbingArea ?? ""),
			createdBy,
			isOrphaned: isOrphaned ?? false,
			orphanedAt: isOrphaned ? new Date() : null,
			updatedBy: uid,
			updatedAt: serverTimestamp(),
			recentEdits: next,
		};
		// country: empty string → remove field; null → leave untouched; value → set
		if (country !== null && country !== undefined) {
			fields.country = country.trim() || null;
		}

		if (createdBy && createdBy !== data.createdBy) {
			fields.lastOwnershipTransfer = {
				fromUID: data.createdBy ?? null,
				toUID: createdBy,
				transferredBy: uid,
				transferredAt: new Date(),
			};
		}

		tx.update(ref, fields);
	});
}

export async function adminDeleteRoute(routeID) {
	await deleteDoc(doc(db, "routes", routeID));
}

/**
 * Set (or overwrite) the GPS pin on a route.
 * Admin privilege — bypasses the iOS first-sender/creator permission check.
 * @param {string} routeID
 * @param {number} latitude   WGS-84 latitude
 * @param {number} longitude  WGS-84 longitude
 * @param {string|null} country  ISO 3166-1 alpha-2, or null to leave auto-derived value
 */
export async function adminSetGPS(routeID, latitude, longitude, country) {
	const uid = auth.currentUser?.uid ?? "unknown";
	const fields = {
		latitude,
		longitude,
		updatedBy: uid,
		updatedAt: serverTimestamp(),
	};
	if (country !== null && country !== undefined) {
		fields.country = country.trim() || null;
	}
	await updateDoc(doc(db, "routes", routeID), fields);
}

/**
 * Remove the GPS pin from a route (sets latitude, longitude, country to null).
 * Admin privilege.
 */
export async function adminClearGPS(routeID) {
	const uid = auth.currentUser?.uid ?? "unknown";
	await updateDoc(doc(db, "routes", routeID), {
		latitude: null,
		longitude: null,
		country: null,
		updatedBy: uid,
		updatedAt: serverTimestamp(),
	});
}

export async function getRoute(routeID) {
	const snap = await getDoc(doc(db, "routes", routeID));
	if (!snap.exists()) return null;
	const d = snap.data();
	return {
		id: d.id ?? snap.id,
		name: d.name ?? "",
		climbingArea: d.climbingArea ?? "",
		crag: d.crag ?? "",
		grade: d.grade ?? "",
		createdGrade: d.createdGrade ?? d.grade ?? "",
		createdGradeSystem: d.createdGradeSystem ?? "French",
		routeType: d.routeType ?? "Sport",
		sendCount: d.sendCount ?? 0,
		projectCount: d.projectCount ?? 0,
		isOrphaned: d.isOrphaned ?? false,
		ratingSum: d.ratingSum ?? 0,
		ratingCount: d.ratingCount ?? 0,
		communityRating:
			(d.ratingCount ?? 0) > 0
				? (d.ratingSum ?? 0) / (d.ratingCount ?? 0)
				: null,
		createdBy: d.createdBy ?? null,
		updatedBy: d.updatedBy ?? null,
		updatedAt: d.updatedAt?.toDate() ?? null,
		latitude: d.latitude ?? null,
		longitude: d.longitude ?? null,
		country: d.country ?? null,
		recentEdits: (d.recentEdits ?? []).map((e) => ({
			editedAt: e.editedAt?.toDate ? e.editedAt.toDate() : new Date(e.editedAt),
			editedBy: e.editedBy,
		})),
		lastOwnershipTransfer: d.lastOwnershipTransfer
			? {
					fromUID: d.lastOwnershipTransfer.fromUID ?? null,
					toUID: d.lastOwnershipTransfer.toUID ?? null,
					transferredBy: d.lastOwnershipTransfer.transferredBy ?? null,
					transferredAt: d.lastOwnershipTransfer.transferredAt?.toDate
						? d.lastOwnershipTransfer.transferredAt.toDate()
						: new Date(d.lastOwnershipTransfer.transferredAt),
				}
			: null,
	};
}

// ── Soft link drift detection ──────────────────────────────────────────────

/**
 * Batch-fetch route metadata (ratings, GPS, createdBy) for a list of route IDs
 * in a single pass over the `routes` collection.
 *
 * Returns:
 *   ratings   — Map<routeID, number>  (only routes with ratingCount > 0)
 *   gps       — Map<routeID, {latitude, longitude, country}>  (only routes with GPS)
 *   createdBy — Map<routeID, string|null>
 *
 * Replaces the separate fetchCommunityRatings() + fetchRouteGPSData() calls,
 * halving the number of Firestore round-trips on every page load.
 * Network errors per-batch are swallowed; callers receive partial maps.
 */
export async function fetchRouteData(routeIDs) {
	const ratings = new Map();
	const gps = new Map();
	const createdBy = new Map();
	const unique = [...new Set((routeIDs ?? []).filter(Boolean))];
	if (unique.length === 0) return { ratings, gps, createdBy };

	const CHUNK = 30;
	for (let i = 0; i < unique.length; i += CHUNK) {
		const batch = unique.slice(i, i + CHUNK);
		try {
			const snap = await getDocs(
				query(collection(db, "routes"), where(documentId(), "in", batch)),
			);
			snap.docs.forEach((d) => {
				const data = d.data();
				// ratings
				const sum = data.ratingSum ?? 0;
				const count = data.ratingCount ?? 0;
				if (count > 0) ratings.set(d.id, sum / count);
				// GPS
				if (data.latitude != null && data.longitude != null) {
					gps.set(d.id, {
						latitude: data.latitude,
						longitude: data.longitude,
						country: data.country ?? null,
					});
				}
				// createdBy
				createdBy.set(d.id, data.createdBy ?? null);
			});
		} catch (err) {
			console.warn("fetchRouteData batch failed:", err);
		}
	}
	return { ratings, gps, createdBy };
}

/**
 * @deprecated Use fetchRouteData() instead — kept for compatibility.
 * Batch-fetch communityRating for a list of route IDs.
 * Returns a Map<routeID, number> - only routes with ratingCount > 0 are included.
 */
export async function fetchCommunityRatings(routeIDs) {
	const map = new Map();
	const unique = [...new Set((routeIDs ?? []).filter(Boolean))];
	if (unique.length === 0) return map;

	const CHUNK = 30;
	for (let i = 0; i < unique.length; i += CHUNK) {
		const batch = unique.slice(i, i + CHUNK);
		try {
			const snap = await getDocs(
				query(collection(db, "routes"), where(documentId(), "in", batch)),
			);
			snap.docs.forEach((d) => {
				const data = d.data();
				const sum = data.ratingSum ?? 0;
				const count = data.ratingCount ?? 0;
				if (count > 0) map.set(d.id, sum / count);
			});
		} catch (err) {
			console.warn("fetchCommunityRatings batch failed:", err);
		}
	}
	return map;
}

export function shouldClearSoftLink(original, current) {
	return (
		original.name !== current.name ||
		original.crag !== current.crag ||
		original.area !== current.area
	);
}

// ── Admin stats helpers (used by admin.js) ────────────────────────────────
// Re-export Firestore primitives needed by admin.js for count queries
/**
 * Batch-fetch GPS data (latitude, longitude, country) for a list of route IDs.
 * Returns a Map<routeID, {latitude, longitude, country}> — only routes with GPS set are included.
 * Uses the same chunked in-query pattern as fetchCommunityRatings.
 */
export async function fetchRouteGPSData(routeIDs) {
	const map = new Map();
	const unique = [...new Set((routeIDs ?? []).filter(Boolean))];
	if (unique.length === 0) return map;

	const CHUNK = 30;
	for (let i = 0; i < unique.length; i += CHUNK) {
		const batch = unique.slice(i, i + CHUNK);
		try {
			const snap = await getDocs(
				query(collection(db, "routes"), where(documentId(), "in", batch)),
			);
			snap.docs.forEach((d) => {
				const data = d.data();
				if (data.latitude != null && data.longitude != null) {
					map.set(d.id, {
						latitude: data.latitude,
						longitude: data.longitude,
						country: data.country ?? null,
					});
				}
			});
		} catch (err) {
			console.warn("fetchRouteGPSData batch failed:", err);
		}
	}
	return map;
}

/**
 * Backfill the `areaSearch` field on all route docs where it is missing.
 * Admin privilege — iterates `routes/` in limit(500) batches ordered by document ID,
 * computes `areaSearch = foldedForSearch(climbingArea)` and writes it via writeBatch.
 * Idempotent and safe to re-run (only touches docs missing the field).
 *
 * @param {({scanned: number, updated: number}) => void} [onProgress]
 * @returns {{scanned: number, updated: number, batches: number}} totals
 */
export async function adminBackfillAreaSearch(onProgress) {
	const BATCH_SIZE = 500;
	let scanned = 0;
	let updated = 0;
	let batches = 0;
	let lastID = null;

	for (;;) {
		const constraints = [
			orderBy(documentId()),
			limit(BATCH_SIZE),
		];
		if (lastID !== null) {
			constraints.unshift(where(documentId(), ">", lastID));
		}
		const snap = await getDocs(query(collection(db, "routes"), ...constraints));
		if (snap.empty) break;

		const pending = snap.docs.filter((d) => d.data().areaSearch === undefined);
		if (pending.length > 0) {
			const batch = writeBatch(db);
			for (const d of pending) {
				batch.update(d.ref, {
					areaSearch: foldedForSearch(d.data().climbingArea ?? ""),
				});
			}
			await batch.commit();
			batches += 1;
			updated += pending.length;
		}
		scanned += snap.docs.length;
		onProgress?.({ scanned, updated });

		lastID = snap.docs[snap.docs.length - 1].id;
		if (snap.docs.length < BATCH_SIZE) break;
	}
	_adminRouteCountCache.clear(); // area matches may have changed
	return { scanned, updated, batches };
}

export {
	collection,
	collectionGroup,
	query,
	where,
	getDocs,
	orderBy,
	limit,
	routeQueryStreamKeys,
};
