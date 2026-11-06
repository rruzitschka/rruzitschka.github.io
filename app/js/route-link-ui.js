// route-link-ui.js — find-route button state helpers for the soft-link UI
// shared by the Send/Project climb overlays. Pure DOM, no module state —
// split out of ui.js to keep the dashboard module focused.

"use strict";

import { auth } from "./firebase-config.js";

const CLOUD_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
const SEARCH_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

function buildLinkedTitle(routeName, isOwned) {
	if (isOwned) return `✓ ${routeName} (you created this route)`;
	return `✓ ${routeName}`;
}

/** Update a find-route button to linked state: cloud symbol, plus "Owner" when the current user created the route (matches the detail views). */
export function setFindRouteLinked(btnId, routeName, createdBy) {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	const isOwned = Boolean(createdBy && createdBy === auth.currentUser?.uid);
	const classicLabel = isOwned ? "✓ 👤" : "✓";
	const ownerLabel = isOwned ? `<span>Owner</span>` : "";
	btn.innerHTML = `<span class="classic-only">${classicLabel}</span><span class="cs-only cs-route-link-pill linked" title="In community database">${CLOUD_ICON_SVG}${ownerLabel}</span>`;
	btn.title = buildLinkedTitle(routeName, isOwned);
	btn.style.color = "var(--success-color, green)";
}

/** Reset a find-route button to unlinked state. */
export function setFindRouteUnlinked(btnId) {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	btn.innerHTML = `<span class="classic-only">🔍</span><span class="cs-only cs-route-link-pill">${SEARCH_ICON_SVG}<span>Find in Community DB</span></span>`;
	btn.title = "Find Route in Database";
	btn.style.color = "";
}
