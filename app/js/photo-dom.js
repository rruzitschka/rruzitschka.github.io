// photo-dom.js — client-side image pipeline for the web photo upload
// (plan item #11). Decodes the picked file, downscales it to the iOS-parity
// max edge, and re-encodes as JPEG 0.85. Re-encoding also strips ALL
// metadata (EXIF incl. GPS coordinates) — privacy requirement, agreed scope.
//
// DOM/canvas code: not unit-testable in jsdom; the pure decision helpers it
// uses (fitScale, isImageFile, quality constants) live in photo-form-model.js.

"use strict";

import { PHOTO_JPEG_QUALITY, fitScale, isImageFile } from "./photo-form-model.js";

/**
 * Decode, downscale and re-encode an image file to JPEG.
 *
 * @param {File|Blob} file
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function processImageFile(file) {
	if (!isImageFile(file)) {
		throw new Error("Not an image file");
	}
	const bitmap = await createImageBitmap(file);
	try {
		const scale = fitScale(bitmap.width, bitmap.height);
		const width = Math.round(bitmap.width * scale);
		const height = Math.round(bitmap.height * scale);
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		ctx.drawImage(bitmap, 0, 0, width, height);
		const blob = await new Promise((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
				"image/jpeg",
				PHOTO_JPEG_QUALITY,
			);
		});
		return { blob, width, height };
	} finally {
		bitmap.close();
	}
}
