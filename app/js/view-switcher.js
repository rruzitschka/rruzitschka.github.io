// view-switcher.js — Sidebar logbook view switching (All / Projects / Sent):
// active-state handling, view label, and context-aware header action
// buttons. Extracted from ui.js bindFilterHandlers.setActiveView as part of
// the new-UI refactor (docs/plan-uijs-refactor.md, Chunk 6).

"use strict";

import { showLogbookView } from "./account-ui.js";

const VIEW_MAP = {
	all: "view-all",
	projects: "view-projects",
	sent: "view-sent",
};

const LABEL_MAP = {
	all: "All Climbs",
	projects: "Projects",
	sent: "Sent Climbs",
};

function setSidebarActiveItem(view) {
	["view-all", "view-projects", "view-sent"].forEach((id) => {
		document.getElementById(id)?.classList.remove("active");
	});
	// Deactivate training, stats and admin sidebar items
	document.querySelector('[data-view="training"]')?.classList.remove("active");
	document.getElementById("view-stats")?.classList.remove("active");
	document.getElementById("view-admin")?.classList.remove("active");
	document.getElementById(VIEW_MAP[view])?.classList.add("active");
	const lbl = document.getElementById("view-label");
	if (lbl) lbl.textContent = LABEL_MAP[view] ?? "All Climbs";
}

function syncHeaderActionButtons(view) {
	const logSendBtn = document.getElementById("btn-log-send");
	const addProjectBtn = document.getElementById("btn-add-project");
	if (logSendBtn && addProjectBtn) {
		logSendBtn.classList.toggle(
			"hidden",
			view === "projects" || view === "training",
		);
		addProjectBtn.classList.toggle("hidden", view !== "projects");
	}
}

/**
 * Bind the sidebar All/Projects/Sent view links.
 * `refresh(view)` re-renders the climbs table for the given view filter.
 * Returns the switcher handle (`getActiveView`) for filter refreshes.
 */
export function bindViewSwitcher({ refresh }) {
	let activeView = "all"; // 'all' | 'projects' | 'sent'

	function setActiveView(view) {
		activeView = view;
		showLogbookView();
		document.getElementById("stats-view")?.classList.add("hidden");
		setSidebarActiveItem(view);
		syncHeaderActionButtons(view);
		refresh(activeView);
	}

	document.getElementById("view-all")?.addEventListener("click", (e) => {
		e.preventDefault();
		setActiveView("all");
	});
	document.getElementById("view-projects")?.addEventListener("click", (e) => {
		e.preventDefault();
		setActiveView("projects");
	});
	document.getElementById("view-sent")?.addEventListener("click", (e) => {
		e.preventDefault();
		setActiveView("sent");
	});

	return {
		getActiveView: () => activeView,
	};
}
