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
	where,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import { db, storage } from "./firebase-config.js";
import { getCurrentUser } from "./firebase-auth.js";
import {
	ref as storageRef,
	uploadBytes,
	getDownloadURL,
	deleteObject,
} from "firebase/storage";
import { photoStoragePath } from "./photo-form-model.js";

// recordName for ascents is encoded as "noteId/ascentId" so deleteAscent
// can reconstruct the Firestore sub-collection path without a noteId parameter.

// Send-type vocabulary and route-type compatibility rules live in the pure
// send-style.js module (unit-tested); re-exported here for compatibility.
import { normalizeSendType, canonicalizeSendType } from "./send-style.js";
import { parseLocalDate, normalizeLegacyUtcMidnight } from "./ui-theme.js";
export {
	normalizeSendType,
	canonicalizeSendType,
	BOULDER_ROUTE_TYPES,
	BOULDER_SEND_TYPES,
	isBoulderRouteType,
	isGymRouteType,
} from "./send-style.js";

// Canonical Firestore format for projectStatus (lowercase, iOS-native).
// Web uses different vocabulary (Working/Close/Abandoned); this maps to iOS values.
const PROJECT_STATUS_CANONICAL = {
	Working: "active",
	Close: "active", // "Close to send" has no iOS equivalent — treat as still active
	Abandoned: "abandoned",
	// Pass through iOS-native values unchanged
	active: "active",
	completed: "completed",
	abandoned: "abandoned",
};
/** Convert a display-facing projectStatus to the canonical value stored in Firestore. */
export function canonicalizeProjectStatus(raw) {
	return PROJECT_STATUS_CANONICAL[raw] ?? raw?.toLowerCase() ?? null;
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
				date: normalizeLegacyUtcMidnight(d.date?.toDate()) ?? null,
				lastAttemptDate: normalizeLegacyUtcMidnight(d.lastAttemptDate?.toDate()) ?? null,
				projectStatus: d.projectStatus ?? null,
				projectNotes: d.projectNotes ?? null,
				highPoint: d.highPoint ?? null,
				climbDuration: d.climbDuration ?? 0,
				numberOfPitches: d.numberOfPitches ?? 0,
				approachNotes: d.approachNotes ?? null,
				descentNotes: d.descentNotes ?? null,
				gearNotes: d.gearNotes ?? null,
				centralRouteID: d.centralRouteID ?? null,
				reportedRating: d.reportedRating ?? 0,
				ascents: [], // loaded lazily via fetchAscents() when detail modal opens
			};
		});
}

/**
 * Fetch climb notes soft-linked to a training session (iOS 4.0 gym feature:
 * `sessionID` on climbNotes docs). The link itself is authoritative — any
 * same-day check is iOS-only at attach time.
 */
export async function fetchSessionSends(sessionId) {
	if (!sessionId) return [];
	const user = getCurrentUser();
	if (!user) return [];
	const snap = await getDocs(
		query(
			collection(db, `users/${user.uid}/climbNotes`),
			where("sessionID", "==", sessionId),
		),
	);
	return snap.docs
		.filter((noteDoc) => !noteDoc.data().deletedAt)
		.map((noteDoc) => {
			const d = noteDoc.data();
			return {
				recordName: noteDoc.id,
				id: d.id ?? noteDoc.id,
				route: d.route ?? "",
				crag: d.crag ?? "",
				difficulty: d.difficulty ?? "",
				sendType: normalizeSendType(d.sendType),
				routeType: d.routeType ?? "Sport",
				date: normalizeLegacyUtcMidnight(d.date?.toDate()) ?? null,
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
				date: normalizeLegacyUtcMidnight(ad.date?.toDate()) ?? null,
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
						date: normalizeLegacyUtcMidnight(ad.date?.toDate()) ?? null,
						sendType: normalizeSendType(ad.sendType),
						notes: ad.notes ?? null,
						climbNoteRecordName: climb.recordName,
					};
				});
		}),
	);
}

/** Builds the Firestore doc for a climb note save. Pure — testable without
 * Firestore. Date handling: present → Timestamp; explicitly cleared (null/
 * empty string) → null so date-sorted queries keep including the note. */
function buildClimbNoteDoc(id, note) {
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
	if (note.date) docData.date = Timestamp.fromDate(parseLocalDate(note.date));
	else if (note.date !== undefined) docData.date = null;
	applyOptionalNoteFields(docData, note);
	return docData;
}

/** Project/planning fields — written only when set, so a merge-style save
 * keeps the stored value otherwise. */
function applyProjectNoteFields(docData, note) {
	if (note.projectStatus)
		docData.projectStatus = canonicalizeProjectStatus(note.projectStatus);
	if (note.projectNotes) docData.projectNotes = note.projectNotes;
	if (note.highPoint) docData.highPoint = note.highPoint;
	if (note.climbDuration != null) docData.climbDuration = note.climbDuration;
	if (note.centralRouteID) docData.centralRouteID = note.centralRouteID;
}

/** Multi-Pitch plan fields (iOS MultiPitchPlanFormFields). undefined = not
 * part of this save (merge keeps the stored value); null = explicitly cleared
 * (written as null so the field can be cleared). */
function applyMultiPitchNoteFields(docData, note) {
	if (note.numberOfPitches !== undefined) {
		docData.numberOfPitches = note.numberOfPitches;
	}
	if (note.approachNotes !== undefined) {
		docData.approachNotes = note.approachNotes;
	}
	if (note.descentNotes !== undefined) {
		docData.descentNotes = note.descentNotes;
	}
	if (note.gearNotes !== undefined) {
		docData.gearNotes = note.gearNotes;
	}
}

/** Optional note fields — written only when set, so a merge-style save
 * keeps the stored value otherwise. Dates convert to Firestore Timestamps. */
function applyOptionalNoteFields(docData, note) {
	if (note.lastAttemptDate)
		docData.lastAttemptDate = Timestamp.fromDate(
			new Date(note.lastAttemptDate),
		);
	applyProjectNoteFields(docData, note);
	applyMultiPitchNoteFields(docData, note);
}

export async function saveClimbNote(note) {
	const user = getCurrentUser();
	if (!user) throw new Error("Not signed in");
	const id = (note.id ?? note.recordName ?? crypto.randomUUID()).toUpperCase();
	await setDoc(
		doc(db, `users/${user.uid}/climbNotes/${id}`),
		buildClimbNoteDoc(id, note),
		{ merge: true },
	);
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
					? Timestamp.fromDate(parseLocalDate(ascent.date))
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
				// Topos are area sketch photos (iOS isTopo flag) — the inspector
				// renders them in their own row (TopoViewerSheet parity).
				isTopo: d.data().isTopo === true,
			}))
			.filter((p) => p.storageURL);
	} catch (err) {
		console.warn("fetchPhotos error:", err);
		return [];
	}
}

/**
 * Upload a processed photo blob to Firebase Storage and write the photo doc
 * in the exact shape iOS expects (FirebasePhotoUploader parity: id,
 * storageURL, fileName, isTopo, createdAt, updatedAt — serverTimestamps for
 * conflict resolution; doc id doubles as the photoID iOS reads).
 *
 * @param {string} noteId
 * @param {Blob} blob pre-processed JPEG (downscaled, EXIF-free)
 * @param {{fileName: string, isTopo?: boolean}} meta
 * @returns {Promise<{id: string, storageURL: string, fileName: string, isTopo: boolean}>}
 */
export async function uploadPhoto(noteId, blob, { fileName, isTopo = false } = {}) {
	const user = getCurrentUser();
	if (!user) throw new Error("uploadPhoto: not signed in");
	return uploadProcessedPhoto({ uid: user.uid, noteId, blob, fileName, isTopo });
}

/**
 * Storage upload + Firestore doc write + failure cleanup for an
 * already-processed JPEG blob.
 */
async function uploadProcessedPhoto({ uid, noteId, blob, fileName, isTopo }) {
	if (!noteId || !fileName) {
		throw new Error("uploadPhoto: noteId and fileName required");
	}
	const objectRef = storageRef(storage, photoStoragePath(uid, noteId, fileName));
	await uploadBytes(objectRef, blob, { contentType: "image/jpeg" });
	try {
		return await writePhotoDoc({ uid, noteId, fileName, isTopo, objectRef });
	} catch (err) {
		// Metadata write failed after the bytes landed — clean the object up
		// so no orphaned Storage file lingers without a photo doc.
		console.warn("photo metadata write failed — removing uploaded object:", err);
		await deleteObject(objectRef).catch(() => {});
		throw err;
	}
}

/** Firestore photo-doc write (FirebasePhotoUploader doc shape parity). */
async function writePhotoDoc({ uid, noteId, fileName, isTopo, objectRef }) {
	const url = await getDownloadURL(objectRef);
	const docRef = doc(collection(db, `users/${uid}/climbNotes/${noteId}/photos`));
	await setDoc(docRef, {
		id: docRef.id,
		storageURL: url,
		fileName,
		isTopo,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	return { id: docRef.id, storageURL: url, fileName, isTopo };
}

/** Toggle the topo flag on an existing photo doc (iOS EditOverlayView parity). */
export async function setPhotoIsTopo(noteId, photoId, isTopo) {
	const user = getCurrentUser();
	if (!user) throw new Error("setPhotoIsTopo: not signed in");
	const ts = serverTimestamp();
	await updateDoc(doc(db, `users/${user.uid}/climbNotes/${noteId}/photos/${photoId}`), {
		isTopo,
		updatedAt: ts,
	});
}

/**
 * Best-effort Storage object removal (FirebasePhotoUploader.delete parity):
 * the tombstone written by softDeletePhoto stands even if the object is
 * already gone.
 */
async function deletePhotoStorageObject(uid, noteId, fileName) {
	if (!fileName) return;
	try {
		await deleteObject(storageRef(storage, photoStoragePath(uid, noteId, fileName)));
	} catch (err) {
		console.warn("photo Storage delete failed (tombstone stands):", err);
	}
}

/**
 * Soft-delete a photo doc (deletedAt tombstone — both platforms' remote-apply
 * skips these) and remove its Storage object.
 */
export async function softDeletePhoto(noteId, photo) {
	const user = getCurrentUser();
	if (!user) throw new Error("softDeletePhoto: not signed in");
	if (!noteId || !photo?.id) throw new Error("softDeletePhoto: noteId and photo.id required");
	const ts = serverTimestamp();
	await updateDoc(doc(db, `users/${user.uid}/climbNotes/${noteId}/photos/${photo.id}`), {
		deletedAt: ts,
		updatedAt: ts,
	});
	await deletePhotoStorageObject(user.uid, noteId, photo.fileName);
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

/**
 * Route-type filter match (pure): the Gym filter covers gym routes AND gym
 * boulders (one chip, iOS gym feature); every other type is a strict match.
 *
 * @param {string|undefined} climbRouteType
 * @param {string|undefined} filter selected route type ("" = no filter)
 * @returns {boolean}
 */
export function matchesRouteTypeFilter(climbRouteType, filter) {
	if (!filter) return true;
	if (filter === "Gym") {
		return climbRouteType === "Gym" || climbRouteType === "Gym Boulder";
	}
	return climbRouteType === filter;
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
	if (routeType) {
		result = result.filter((c) => matchesRouteTypeFilter(c.routeType, routeType));
	}
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
