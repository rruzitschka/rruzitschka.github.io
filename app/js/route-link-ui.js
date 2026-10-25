// route-link-ui.js — find-route button state helpers for the soft-link UI
// shared by the Send/Project climb overlays. Pure DOM, no module state —
// split out of ui.js to keep the dashboard module focused.

"use strict";

import { auth } from "./firebase-config.js";

/** Update a find-route button to linked state, with 👤 if the current user owns the route. */
export function setFindRouteLinked(btnId, routeName, createdBy) {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	const isOwned = createdBy && createdBy === auth.currentUser?.uid;
	btn.textContent = isOwned ? "✓ 👤" : "✓";
	btn.title = isOwned
		? `✓ ${routeName} (you created this route)`
		: `✓ ${routeName}`;
	btn.style.color = "var(--success-color, green)";
}

/** Reset a find-route button to unlinked state. */
export function setFindRouteUnlinked(btnId) {
	const btn = document.getElementById(btnId);
	if (!btn) return;
	btn.textContent = "🔍";
	btn.title = "Find Route in Database";
	btn.style.color = "";
}
