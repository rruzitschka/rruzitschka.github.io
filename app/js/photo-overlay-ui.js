// photo-overlay-ui.js — photo section for the full edit overlays (send +
// project), plan item #11. iOS EditOverlayView parity: existing photos show
// as thumbnails with a mark-as-topo toggle (mappin) and a delete button
// (with confirmation); new picks are processed (downscale + JPEG 0.85 +
// EXIF/GPS strip, photo-dom.js) and uploaded immediately when the note
// already exists (recordName set), or queued until the save created the
// note (add overlays — flushPendingPhotos is called from the save handlers,
// mirroring the iOS NewLogOverlayView save flow).
//
// Pure helpers (grid HTML, filename/layout constants) live in
// photo-form-model.js; Firestore/Storage calls in firebase-climbs.js.
//
// DOM wiring only here — all services are mutable and mock-overridable via
// setPhotoOverlayMockServices (see ui.js setMockServices).

"use strict";

import {
	fetchPhotos as $fetchPhotos,
	uploadPhoto as $uploadPhoto,
	setPhotoIsTopo as $setPhotoIsTopo,
	softDeletePhoto as $softDeletePhoto,
} from "./firebase-climbs.js";
import { processImageFile } from "./photo-dom.js";
import {
	buildOverlayPhotoGridHtml,
	buildPhotoFileName,
	isImageFile,
} from "./photo-form-model.js";
import { openLightbox } from "./lightbox-ui.js";

// ── Mutable service references (can be overridden by mock mode) ──

let fetchPhotos = $fetchPhotos;
let uploadPhoto = $uploadPhoto;
let setPhotoIsTopo = $setPhotoIsTopo;
let softDeletePhoto = $softDeletePhoto;

const PHOTO_MOCK_SETTERS = {
	fetchPhotos: (fn) => (fetchPhotos = fn),
	uploadPhoto: (fn) => (uploadPhoto = fn),
	setPhotoIsTopo: (fn) => (setPhotoIsTopo = fn),
	softDeletePhoto: (fn) => (softDeletePhoto = fn),
};

/** Override the photo-overlay services (mock mode — see ui.js setMockServices). */
export function setPhotoOverlayMockServices(mocks) {
	for (const [key, set] of Object.entries(PHOTO_MOCK_SETTERS)) {
		if (mocks[key]) set(mocks[key]);
	}
}

// ── Per-overlay state ("so" = send overlay, "po" = project overlay) ──

const STATE = {
	so: { noteId: null, photos: [], pending: [], session: 0 },
	po: { noteId: null, photos: [], pending: [], session: 0 },
};

// globalThis shims (showConfirmDialog / showToast live in account-ui.js /
// ui.js — kept one-way like in overlay-common.js).
const showConfirmDialog = (...args) => globalThis.showConfirmDialog?.(...args);
const showToast = (...args) => globalThis.showToast?.(...args);

/** Combined render list: existing docs first, then pending uploads. */
function combinedItems(prefix) {
	const s = STATE[prefix];
	return [
		...s.photos,
		...s.pending.map((p) => ({ ...p, pending: true })),
	];
}

function gridEl(prefix) {
	return document.getElementById(`${prefix}-photo-grid`);
}

function sectionEl(prefix) {
	return document.getElementById(`${prefix}-photos-section`);
}

function renderGrid(prefix) {
	const grid = gridEl(prefix);
	if (!grid) return;
	grid.innerHTML = buildOverlayPhotoGridHtml(combinedItems(prefix));
}

function showPhotoError(prefix, message) {
	const err = document.getElementById(`${prefix}-photo-error`);
	if (!err) return;
	if (message) {
		err.textContent = message;
		err.classList.remove("hidden");
	} else {
		err.classList.add("hidden");
	}
}

function setBusy(prefix, busy) {
	sectionEl(prefix)?.classList.toggle("ovl-photo-busy", busy);
}

/** Reset one overlay's photo section (add overlay open / overlay close). */
export function resetPhotoOverlay(prefix) {
	const s = STATE[prefix];
	for (const p of s.pending) {
		if (p.previewURL) URL.revokeObjectURL(p.previewURL);
	}
	s.noteId = null;
	s.photos = [];
	s.pending = [];
	s.session += 1; // invalidate in-flight processing from the old session
	renderGrid(prefix);
	showPhotoError(prefix, null);
	setBusy(prefix, false);
}

/**
 * Point the section at an existing note and load its photos (edit overlays).
 *
 * @param {"so"|"po"} prefix
 * @param {string} noteId
 */
export function fillPhotoOverlay(prefix, noteId) {
	const s = STATE[prefix];
	s.session += 1; // invalidate in-flight processing from the old note
	s.noteId = noteId ?? null;
	s.photos = [];
	renderGrid(prefix);
	if (!noteId) return;
	fetchPhotos(noteId)
		.then((photos) => {
			// Ignore stale responses (overlay was reset or pointed elsewhere).
			if (STATE[prefix].noteId !== noteId) return;
			s.photos = photos;
			renderGrid(prefix);
		})
		.catch((err) => console.warn("fillPhotoOverlay:", err));
}

/**
 * Upload everything queued while the note did not exist yet (add overlays).
 * Called from the save handlers once saveClimbNote returned the recordName.
 * Failed items stay queued (state stays consistent — nothing is silently
 * lost); the save itself is not blocked by an upload failure.
 *
 * @param {"so"|"po"} prefix
 * @param {string} noteId freshly created recordName
 */
export async function flushPendingPhotos(prefix, noteId) {
	const s = STATE[prefix];
	if (!noteId || s.pending.length === 0) return;
	const items = s.pending;
	s.pending = [];
	setBusy(prefix, true);
	let failures = 0;
	try {
		for (const p of items) {
			try {
				await uploadPhoto(noteId, p.blob, {
					fileName: buildPhotoFileName(noteId),
					isTopo: p.isTopo === true,
				});
				URL.revokeObjectURL(p.previewURL);
			} catch (err) {
				console.warn("flushPendingPhotos:", err);
				s.pending.push(p); // keep for consistency; the save continues
				failures += 1;
			}
		}
	} finally {
		setBusy(prefix, false);
	}
	if (failures > 0) {
		showToast(
			`${failures} photo${failures === 1 ? "" : "s"} failed to upload — add them again from the edit overlay.`,
			"error",
		);
	}
}

/** Decode + compress one picked file; report and skip on failure. */
async function processPickedFile(prefix, file) {
	try {
		return await processImageFile(file);
	} catch (err) {
		console.warn("photo processing failed:", err);
		showPhotoError(prefix, "Could not read image file.");
		return null;
	}
}

/** Store a processed photo against the note it was picked for: immediate
 * upload on edit (iOS EditOverlayView parity), queue on add (the save
 * creates the note and flushes via flushPendingPhotos). */
async function storeProcessedPhoto(prefix, noteId, processed) {
	if (noteId) {
		await uploadPhoto(noteId, processed.blob, {
			fileName: buildPhotoFileName(noteId),
			isTopo: false,
		});
	} else {
		STATE[prefix].pending.push({
			blob: processed.blob,
			previewURL: URL.createObjectURL(processed.blob),
			isTopo: false,
		});
	}
}

async function handleFiles(prefix, files) {
	const picked = Array.from(files ?? []).filter(isImageFile);
	if (picked.length === 0) return;
	const state = STATE[prefix];
	const session = ++state.session;
	const noteIdAtPick = state.noteId;
	setBusy(prefix, true);
	showPhotoError(prefix, null);
	try {
		for (const file of picked) {
			const processed = await processPickedFile(prefix, file);
			if (!processed) continue;
			// The overlay may have been closed or switched climbs while the
			// image was decoding — drop the result instead of uploading it
			// against the wrong note.
			if (STATE[prefix].session !== session) {
				console.warn("handleFiles: overlay changed mid-upload — photo dropped");
				continue;
			}
			await storeProcessedPhoto(prefix, noteIdAtPick, processed);
		}
		await refreshPhotos(prefix);
		renderGrid(prefix);
	} catch (err) {
		console.warn("handleFiles:", err);
		showPhotoError(prefix, "Photo upload failed — please try again.");
	} finally {
		if (STATE[prefix].session === session) setBusy(prefix, false);
	}
}

async function toggleTopo(prefix, index) {
	const s = STATE[prefix];
	if (index >= s.photos.length) {
		// Pending upload — toggle locally (combinedItems copies are detached).
		const pending = s.pending[index - s.photos.length];
		if (pending) pending.isTopo = !pending.isTopo;
		renderGrid(prefix);
		return;
	}
	const item = s.photos[index];
	if (!item) return;
	try {
		await setPhotoIsTopo(s.noteId, item.id, !item.isTopo);
		await refreshPhotos(prefix);
	} catch (err) {
		console.warn("toggleTopo:", err);
		showPhotoError(prefix, "Could not update the photo — please try again.");
	}
}

/** Re-fetch the current note's photos and re-render (edit mode only). */
async function refreshPhotos(prefix) {
	const s = STATE[prefix];
	const noteId = s.noteId;
	if (!noteId) return;
	try {
		const photos = await fetchPhotos(noteId);
		if (STATE[prefix].noteId === noteId) {
			s.photos = photos;
			renderGrid(prefix);
		}
	} catch (err) {
		console.warn("refreshPhotos:", err);
	}
}

async function deletePhoto(prefix, index) {
	const s = STATE[prefix];
	const item = combinedItems(prefix)[index];
	if (!item) return;
	const confirmed = await showConfirmDialog(
		"Delete Photo",
		"Delete this photo? It is removed on all your devices.",
	);
	if (!confirmed) return;
	if (item.pending) {
		const pendingIndex = index - s.photos.length;
		const [removed] = s.pending.splice(pendingIndex, 1);
		if (removed?.previewURL) URL.revokeObjectURL(removed.previewURL);
		renderGrid(prefix);
		return;
	}
	try {
		await softDeletePhoto(s.noteId, item);
		await refreshPhotos(prefix);
	} catch (err) {
		console.warn("deletePhoto:", err);
		showPhotoError(prefix, "Could not delete the photo — please try again.");
	}
}

function onGridClick(prefix, e) {
	const thumb = e.target.closest?.(".ovl-photo-thumb");
	if (!thumb) return;
	const index = Number(thumb.dataset.photoIndex);
	if (Number.isNaN(index)) return;
	if (e.target.closest(".ovl-photo-topo-toggle")) {
		toggleTopo(prefix, index);
		return;
	}
	if (e.target.closest(".ovl-photo-delete")) {
		deletePhoto(prefix, index);
		return;
	}
	// Click on the thumbnail itself → full-screen viewer (TopoViewerSheet).
	const items = combinedItems(prefix).map((p) => ({
		storageURL: p.pending ? p.previewURL : p.storageURL,
		isTopo: p.isTopo === true,
	}));
	openLightbox(items, index);
}

/**
 * Bind the photo sections of both edit overlays. Call once at init
 * (ui.js); safe to call again (idempotent via marker attribute).
 */
export function initPhotoOverlayUI() {
	for (const prefix of ["so", "po"]) {
		const input = document.getElementById(`${prefix}-photo-input`);
		const grid = gridEl(prefix);
		if (!input || !grid) continue;
		if (!input.dataset.photoBound) {
			input.dataset.photoBound = "1";
			input.addEventListener("change", () => {
				handleFiles(prefix, input.files);
				input.value = ""; // allow re-picking the same file
			});
		}
		if (!grid.dataset.photoBound) {
			grid.dataset.photoBound = "1";
			grid.addEventListener("click", (e) => onGridClick(prefix, e));
		}
	}
}
