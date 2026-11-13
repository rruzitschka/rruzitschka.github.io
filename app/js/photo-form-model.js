// photo-form-model.js — pure, DOM-free helpers for the photo feature
// (plan item #11: web photo upload + topos). iOS parity constants:
// FirebasePhotoUploader / PhotoStorage store JPEG q=0.85 and name files
// "{noteID}_{UUID}.jpg" under photos/{uid}/{noteID}/.

"use strict";

/** Longest edge after downscale — matches the iOS PhotoStorage pipeline. */
export const PHOTO_MAX_DIMENSION = 2048;

/** JPEG quality — matches iOS (FirebasePhotoUploader.jpegData 0.85). */
export const PHOTO_JPEG_QUALITY = 0.85;

/** Accept only real image files (a file input / drag-drop may yield anything). */
export function isImageFile(file) {
	return Boolean(file) && typeof file.type === "string" && file.type.startsWith("image/");
}

/** Downscale factor so the image fits PHOTO_MAX_DIMENSION (never upscales). */
export function fitScale(width, height) {
	const max = Math.max(Number(width) || 0, Number(height) || 0);
	if (!max || max <= PHOTO_MAX_DIMENSION) return 1;
	return PHOTO_MAX_DIMENSION / max;
}

/**
 * Collision-safe Storage fileName, iOS PhotoStorage layout parity:
 * "{noteID}_{uuid}.jpg". The uuid component keeps names unique even when
 * the same image is added to several notes.
 */
export function buildPhotoFileName(noteId, uuid = crypto.randomUUID()) {
	const safeNote = String(noteId || "").replaceAll(/[^A-Za-z0-9_-]/g, "") || "photo";
	return `${safeNote}_${String(uuid).replaceAll(/[^A-Za-z0-9-]/g, "")}.jpg`;
}

/** Storage object path — must match the iOS FirebasePhotoUploader layout. */
export function photoStoragePath(uid, noteId, fileName) {
	return `photos/${uid}/${noteId}/${fileName}`;
}

/**
 * Split fetched photo docs into route photos and topos (area sketch photos).
 * Order within each group is preserved (fetchPhotos sorts by updatedAt asc).
 */
export function splitPhotosByTopo(photos) {
	const list = Array.isArray(photos) ? photos : [];
	return {
		routePhotos: list.filter((p) => !p.isTopo),
		topos: list.filter((p) => p.isTopo === true),
	};
}

function escapeAttr(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

/** SVG stroke icons (convention: no emojis). */
export const PHOTO_ICONS = {
	pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
	trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
	add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
};

/**
 * One thumbnail of the overlay photo grid.
 * @param {object} photo { id?, storageURL|previewURL, fileName?, isTopo, pending? }
 * @param {number} index index in the overlay's combined photo list
 * @returns {string}
 */
export function buildOverlayPhotoThumbHtml(photo, index) {
	const url = photo.pending ? photo.previewURL : photo.storageURL;
	const topoBadge = photo.isTopo
		? `<span class="photo-topo-badge">${PHOTO_ICONS.pin}<span>Topo</span></span>`
		: "";
	const pinTitle = photo.isTopo ? "Unmark as Topo" : "Mark as Topo";
	const pinClass = photo.isTopo ? "ovl-photo-topo-toggle is-topo" : "ovl-photo-topo-toggle";
	return `<div class="ovl-photo-thumb${photo.isTopo ? " is-topo" : ""}" data-photo-index="${index}">
		<img src="${escapeAttr(url)}" alt="Route photo" loading="lazy" />
		${topoBadge}
		<div class="ovl-photo-actions">
			<button type="button" class="${pinClass}" title="${pinTitle}" aria-label="${pinTitle}">${PHOTO_ICONS.pin}</button>
			<button type="button" class="ovl-photo-delete" title="Delete photo" aria-label="Delete photo">${PHOTO_ICONS.trash}</button>
		</div>
	</div>`;
}

/**
 * Grid of photo thumbnails for the edit overlays (send + project). Items are
 * existing photo docs or pending uploads ({pending: true, previewURL, blob,
 * isTopo}); both kinds carry isTopo and render in list order.
 *
 * @param {Array<object>} photos
 * @returns {string} empty string when there are no photos
 */
export function buildOverlayPhotoGridHtml(photos) {
	const list = Array.isArray(photos) ? photos : [];
	if (list.length === 0) return "";
	return list.map((p, i) => buildOverlayPhotoThumbHtml(p, i)).join("");
}
