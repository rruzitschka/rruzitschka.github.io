// firebase-climbs.js — Firestore implementation (modular SDK)
// Exposes same interface as the original
// Depends on: firebase-config.js, firebase-auth.js

import {
	collection,
	doc,
	getDocs,
	setDoc,
	updateDoc,
	query,
	orderBy,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import { db } from "./firebase-config.js";
import { getCurrentUser } from "./firebase-auth.js";

// recordName for ascents is encoded as "noteId/ascentId" so deleteAscent
// can reconstruct the Firestore sub-collection path without a noteId parameter.

// iOS stores sendType as lowercase; web UI expects Title Case.
// Firestore canonical format is lowercase (iOS-native). The web normalises
// Title Case → lowercase before every write so both clients stay consistent.
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
};
function normalizeSendType(raw) {
	return SEND_TYPE_NORMALIZE[raw?.toLowerCase()] ?? raw ?? "Redpoint";
}

// Canonical Firestore format (lowercase, iOS-native).
const SEND_TYPE_CANONICAL = {
	Redpoint: "redpoint",
	"On Sight": "on sight",
	"Top Rope": "top rope",
	"All Free": "all free",
	Project: "project",
	Pinkpoint: "pinkpoint",
};
/** Convert a display-facing Title Case sendType to the lowercase value stored in Firestore. */
function canonicalizeSendType(raw) {
	return SEND_TYPE_CANONICAL[raw] ?? raw?.toLowerCase() ?? "redpoint";
}

export async function fetchClimbs() {
	const user = getCurrentUser();
	if (!user) return [];
	const snapshot = await getDocs(
		query(
			collection(db, `users/${user.uid}/climbNotes`),
			orderBy("date", "desc"),
		),
	);

	return snapshot.docs
		.filter((noteDoc) => !noteDoc.data().deletedAt)
		.map((noteDoc) => {
			const d = noteDoc.data();
			const sendType = normalizeSendType(d.sendType);
			const isProject = sendType === "Project";
			return {
				recordName: noteDoc.id,
				id: d.id ?? noteDoc.id,
				route: d.route ?? "",
				climbingArea: d.climbingArea ?? "",
				crag: d.crag ?? "",
				difficulty: d.difficulty ?? "",
				sendType,
				isProject,
				routeType: d.routeType ?? "Sport",
				noteText: d.noteText ?? "",
				rating: d.rating ?? 0,
				attemptCount: d.attemptCount ?? 0,
				date: d.date?.toDate() ?? null,
				lastAttemptDate: d.lastAttemptDate?.toDate() ?? null,
				projectStatus: d.projectStatus ?? null,
				projectNotes: d.projectNotes ?? null,
				highPoint: d.highPoint ?? null,
				centralRouteID: d.centralRouteID ?? null,
				reportedRating: d.reportedRating ?? 0,
				ascents: [], // loaded lazily via fetchAscents() when detail modal opens
			};
		});
}

/**
 * Fetch ascents for a single climb note.
 * Called lazily when the detail modal opens — not on every page load.
 */
export async function fetchAscents(noteId) {
	const user = getCurrentUser();
	if (!user) return [];
	const snap = await getDocs(
		query(
			collection(db, `users/${user.uid}/climbNotes/${noteId}/ascents`),
			orderBy("date", "desc"),
		),
	);
	return snap.docs
		.filter((a) => !a.data().deletedAt)
		.map((a) => {
			const ad = a.data();
			return {
				recordName: `${noteId}/${a.id}`,
				id: ad.id ?? a.id,
				date: ad.date?.toDate() ?? null,
				sendType: normalizeSendType(ad.sendType),
				notes: ad.notes ?? null,
			};
		});
}

/**
 * Bulk-fetch ascents for every climb in parallel.
 * Mutates each climb object's `ascents` array in place.
 * Called once in loadData() so stats, heatmap, and other
 * views always have complete ascent data.
 */
export async function fetchAllClimbAscents(climbs) {
	const user = getCurrentUser();
	if (!user || !climbs.length) return;
	await Promise.all(
		climbs.map(async (climb) => {
			const snap = await getDocs(
				query(
					collection(
						db,
						`users/${user.uid}/climbNotes/${climb.recordName}/ascents`,
					),
					orderBy("date", "desc"),
				),
			);
			climb.ascents = snap.docs
				.filter((d) => !d.data().deletedAt)
				.map((d) => {
					const ad = d.data();
					return {
						recordName: `${climb.recordName}/${d.id}`,
						id: ad.id ?? d.id,
						date: ad.date?.toDate() ?? null,
						sendType: normalizeSendType(ad.sendType),
						notes: ad.notes ?? null,
						climbNoteRecordName: climb.recordName,
					};
				});
		}),
	);
}

export async function saveClimbNote(note) {
	const user = getCurrentUser();
	if (!user) throw new Error("Not signed in");
	const id = (note.id ?? note.recordName ?? crypto.randomUUID()).toUpperCase();
	const docData = {
		id,
		route: note.route ?? "",
		climbingArea: note.climbingArea ?? "",
		crag: note.crag ?? "",
		difficulty: note.difficulty ?? "",
		sendType: canonicalizeSendType(note.sendType ?? "redpoint"),
		routeType: note.routeType ?? "Sport",
		noteText: note.noteText ?? "",
		rating: note.rating ?? 0,
		reportedRating: note.reportedRating ?? 0,
		attemptCount: note.attemptCount ?? 0,
		updatedAt: serverTimestamp(),
	};
	if (note.date) docData.date = Timestamp.fromDate(new Date(note.date));
	if (note.lastAttemptDate)
		docData.lastAttemptDate = Timestamp.fromDate(
			new Date(note.lastAttemptDate),
		);
	if (note.projectStatus) docData.projectStatus = note.projectStatus;
	if (note.projectNotes) docData.projectNotes = note.projectNotes;
	if (note.highPoint) docData.highPoint = note.highPoint;
	if (note.centralRouteID) docData.centralRouteID = note.centralRouteID;
	await setDoc(doc(db, `users/${user.uid}/climbNotes/${id}`), docData, {
		merge: true,
	});
	return id;
}

export async function deleteClimbNote(id) {
	const user = getCurrentUser();
	if (!user) return;
	const ts = serverTimestamp();
	await updateDoc(doc(db, `users/${user.uid}/climbNotes/${id}`), {
		deletedAt: ts,
		updatedAt: ts,
	});
}

export async function saveAscent(ascent) {
	const user = getCurrentUser();
	if (!user) throw new Error("Not signed in");
	const noteId = ascent.climbNoteRecordName ?? ascent.noteId;
	const id = (ascent.id ?? crypto.randomUUID()).toUpperCase();
	await setDoc(
		doc(db, `users/${user.uid}/climbNotes/${noteId}/ascents/${id}`),
		{
			id,
			sendType: canonicalizeSendType(ascent.sendType ?? "redpoint"),
			notes: ascent.notes ?? "",
			date: ascent.date
				? Timestamp.fromDate(new Date(ascent.date))
				: Timestamp.now(),
			updatedAt: serverTimestamp(),
		},
		{ merge: true },
	);
	return id;
}

export async function deleteAscent(compositeId) {
	// compositeId is "noteId/ascentId" — encoded in fetchClimbs recordName
	const user = getCurrentUser();
	if (!user) return;
	const [noteId, ascentId] = compositeId.split("/");
	if (!noteId || !ascentId) {
		console.warn("deleteAscent: bad compositeId", compositeId);
		return;
	}
	const ts = serverTimestamp();
	await updateDoc(
		doc(db, `users/${user.uid}/climbNotes/${noteId}/ascents/${ascentId}`),
		{ deletedAt: ts, updatedAt: ts },
	);
}

export async function fetchPhotos(noteId) {
	const user = getCurrentUser();
	if (!user) return [];
	try {
		const snap = await getDocs(
			query(
				collection(db, `users/${user.uid}/climbNotes/${noteId}/photos`),
				orderBy("updatedAt", "asc"),
			),
		);
		return snap.docs
			.filter((d) => !d.data().deletedAt)
			.map((d) => ({
				id: d.id,
				storageURL: d.data().storageURL,
				fileName: d.data().fileName,
			}))
			.filter((p) => p.storageURL);
	} catch (err) {
		console.warn("fetchPhotos error:", err);
		return [];
	}
}

export function computeStats(climbs) {
	const now = new Date();
	const thisYear = now.getFullYear();
	const byType = {};
	climbs
		.filter((c) => !c.isProject)
		.forEach((c) => {
			byType[c.sendType] = (byType[c.sendType] || 0) + 1;
		});

	// Find hardest grade sent this year (excluding projects)
	const thisYearSends = climbs.filter(
		(c) =>
			!c.isProject &&
			c.date &&
			c.date.getFullYear() === thisYear &&
			c.difficulty,
	);
	let hardestThisYear = null;
	let hardestIndex = -1;
	const GRADES = window.GRADES;
	const detectGradeSystem = window.detectGradeSystem;
	for (const c of thisYearSends) {
		const system = detectGradeSystem(c.difficulty);
		const idx = GRADES[system]?.indexOf(c.difficulty) ?? -1;
		if (idx > hardestIndex) {
			hardestIndex = idx;
			hardestThisYear = c.difficulty;
		}
	}

	return {
		total: climbs.filter((c) => !c.isProject).length,
		thisYear: climbs.filter((c) => c.date && c.date.getFullYear() === thisYear)
			.length,
		byType,
		projects: climbs.filter((c) => c.isProject).length,
		hardestThisYear,
	};
}

export function filterClimbs(
	climbs,
	{ area, year, sendType, routeType, search, sort } = {},
) {
	let result = [...climbs];
	if (area) result = result.filter((c) => c.climbingArea === area);
	if (year)
		result = result.filter(
			(c) => c.date && c.date.getFullYear() === parseInt(year),
		);
	if (sendType) result = result.filter((c) => c.sendType === sendType);
	if (routeType) result = result.filter((c) => c.routeType === routeType);
	if (search) {
		const q = search.toLowerCase();
		result = result.filter(
			(c) =>
				c.route?.toLowerCase().includes(q) ||
				c.climbingArea?.toLowerCase().includes(q) ||
				c.crag?.toLowerCase().includes(q),
		);
	}
	if (sort === "grade")
		result.sort((a, b) =>
			(b.difficulty || "").localeCompare(a.difficulty || ""),
		);
	else result.sort((a, b) => (b.date || 0) - (a.date || 0));
	return result;
}
