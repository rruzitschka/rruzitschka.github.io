// lightbox-ui.js — full-screen photo viewer (iOS TopoViewerSheet parity).
// Expects the #lightbox markup in index.html; opened from the Inspector
// photo strip (climb-inspector-ui.js) and the overlay photo grids
// (photo-overlay-ui.js). Pure DOM wiring — no service calls.

"use strict";

let _items = [];
let _index = 0;
let _keysBound = false;

const el = {
	root: () => document.getElementById("lightbox"),
	img: () => document.getElementById("lightbox-img"),
	counter: () => document.getElementById("lightbox-counter"),
};

function render() {
	const item = _items[_index];
	const root = el.root();
	if (!root || !item) return;
	const img = el.img();
	img.src = item.storageURL ?? "";
	img.alt = item.isTopo ? "Topo (area sketch)" : "Route photo";
	const count = el.counter();
	if (count) {
		count.textContent = _items.length > 1 ? `${_index + 1} / ${_items.length}` : "";
	}
	root.classList.toggle("lightbox-single", _items.length === 1);
}

function close() {
	const root = el.root();
	if (!root) return;
	root.classList.add("hidden");
	root.classList.remove("lightbox-single");
	document.body.classList.remove("lightbox-open");
	_items = [];
	_index = 0;
}

function step(delta) {
	if (_items.length === 0) return;
	_index = (_index + delta + _items.length) % _items.length;
	render();
}

function onKeydown(e) {
	const root = el.root();
	if (!root || root.classList.contains("hidden")) return;
	if (e.key === "Escape") close();
	else if (e.key === "ArrowLeft") step(-1);
	else if (e.key === "ArrowRight") step(1);
}

function bindOnce() {
	if (_keysBound) return;
	_keysBound = true;
	document.addEventListener("keydown", onKeydown);
	const root = el.root();
	if (!root) return;
	root.addEventListener("click", (e) => {
		if (e.target === root) close(); // backdrop click
	});
	document.getElementById("lightbox-close")?.addEventListener("click", close);
	document.getElementById("lightbox-prev")?.addEventListener("click", () => step(-1));
	document.getElementById("lightbox-next")?.addEventListener("click", () => step(1));
}

/**
 * Open the full-screen viewer.
 *
 * @param {Array<{storageURL: string, isTopo?: boolean}>} photos in display order
 * @param {number} [index=0]
 */
export function openLightbox(photos, index = 0) {
	if (!photos || photos.length === 0) return;
	_items = photos;
	_index = Math.min(Math.max(index, 0), photos.length - 1);
	bindOnce();
	el.root().classList.remove("hidden");
	document.body.classList.add("lightbox-open");
	render();
}

/** Testing seam: reset module state between tests. */
export function resetLightbox() {
	_items = [];
	_index = 0;
}
