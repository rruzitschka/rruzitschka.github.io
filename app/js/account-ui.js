// account-ui.js — Account view, Stats view, logbook view switch, API keys
// overlay, confirm dialog, and account deletion. Moved out of ui.js as part
// of the new-UI refactor (docs/plan-uijs-refactor.md, Chunk 4).
//
// ui.js keeps the sidebar view-switch wiring (showLogbookView is called from
// setActiveView) and the export-CSV binding; view-account / view-stats /
// delete-account / API-key handlers are bound here.

"use strict";

import {
	getCurrentUser as $getCurrentUser,
	deleteAccount as $deleteAccount,
} from "./firebase-auth.js";
import {
	apiKeysList as $apiKeysList,
	apiKeysCreate as $apiKeysCreate,
	apiKeysRevoke as $apiKeysRevoke,
} from "./firebase-api-keys.js";
import { ensureTrainingSessionsLoaded } from "./training-ui.js";

// ── Mutable service references (can be overridden by setAccountUIMockServices) ──

let getCurrentUser = $getCurrentUser;
let deleteAccount = $deleteAccount;
let apiKeysList = $apiKeysList;
let apiKeysCreate = $apiKeysCreate;
let apiKeysRevoke = $apiKeysRevoke;

/** Override the account services (mock mode — see ui.js setMockServices). */
export function setAccountUIMockServices(mocks) {
	if (mocks.getCurrentUser) getCurrentUser = mocks.getCurrentUser;
	if (mocks.deleteAccount) deleteAccount = mocks.deleteAccount;
	if (mocks.apiKeysList) apiKeysList = mocks.apiKeysList;
	if (mocks.apiKeysCreate) apiKeysCreate = mocks.apiKeysCreate;
	if (mocks.apiKeysRevoke) apiKeysRevoke = mocks.apiKeysRevoke;
}

// ── Shims (kept on globalThis by ui.js / grades.js / stats.js; keeps the
//    dependency one-way — see training-ui.js for the same pattern) ──

const escapeHtml = (...args) => globalThis.escapeHtml(...args);
const showToast = (...args) => globalThis.showToast(...args);
const renderStatsPage = (...args) => globalThis.renderStatsPage(...args);
const bindStatsPeriodTabs = (...args) => globalThis.bindStatsPeriodTabs(...args);

// Grades API — provided by grades.js (regular script, always loaded before modules)
const getPreferredGradeSystem = () => window.getPreferredGradeSystem();
const setPreferredGradeSystem = (s) => window.setPreferredGradeSystem(s);

// ── View panel helpers ──

// ".table-container" is the only main panel selected by class, not id.
const MAIN_PANEL_IDS = [
	"stats-bar",
	"table-container",
	"training-view",
	"account-view",
	"stats-view",
	"admin-view",
];

function mainPanelEl(id) {
	return id === "table-container"
		? document.querySelector(".table-container")
		: document.getElementById(id);
}

/** Show exactly the listed main panels, hide all others. */
function setMainPanels(visibleIds) {
	for (const id of MAIN_PANEL_IDS) {
		mainPanelEl(id)?.classList.toggle("hidden", !visibleIds.includes(id));
	}
}

function hideHeaderActionButtons() {
	document.getElementById("btn-log-send")?.classList.add("hidden");
	document.getElementById("btn-add-project")?.classList.add("hidden");
}

/** Clear sidebar active state, then optionally activate one item. */
function setActiveSidebarItem(activeId) {
	for (const id of [
		"view-all",
		"view-projects",
		"view-sent",
		"view-account",
		"view-stats",
		"view-admin",
	]) {
		document.getElementById(id)?.classList.remove("active");
	}
	document.querySelector('[data-view="training"]')?.classList.remove("active");
	document.getElementById(activeId)?.classList.add("active");
}

// ---------- Logbook view ----------

// Called from ui.js setActiveView — which manages the sidebar active state
// and header action buttons itself; this only restores the main panels.
export function showLogbookView() {
	setMainPanels(["stats-bar", "table-container"]);
}

// ---------- Account view ----------

export function showAccountView() {
	setMainPanels(["account-view"]);
	// Clear sidebar active state (account is in header, not sidebar)
	setActiveSidebarItem(null);
	hideHeaderActionButtons();
	renderAccountCard();
	renderApiKeys();
}

/** Render the user info card and the grade-system preference. */
function renderAccountCard() {
	const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
	const nameEl = document.getElementById("account-name");
	const emailEl = document.getElementById("account-email");
	if (nameEl) nameEl.textContent = user?.displayName ?? "Climber";
	if (emailEl) emailEl.textContent = user?.email ?? "";
	bindGradeSystemPreference();
}

/** Bind the grade-system preference (one-time binding on first open). */
function bindGradeSystemPreference() {
	const gradeSystemEl = document.getElementById("account-grade-system");
	if (!gradeSystemEl) return;
	gradeSystemEl.value = getPreferredGradeSystem();
	if (gradeSystemEl.dataset.bound) return;
	gradeSystemEl.addEventListener("change", () => {
		setPreferredGradeSystem(gradeSystemEl.value);
	});
	gradeSystemEl.dataset.bound = "1";
}

// ---------- Stats view ----------

export async function showStatsView() {
	setMainPanels(["stats-view"]);
	setActiveSidebarItem("view-stats");
	hideHeaderActionButtons();
	// Fetch sessions directly if not yet loaded (avoids calling renderTrainingPage as a side-effect)
	let sessions = [];
	try {
		sessions = await ensureTrainingSessionsLoaded();
	} catch (e) {
		console.warn("Stats: could not load training sessions", e);
	}
	renderStatsPage(globalThis.allClimbs ?? [], sessions);
	bindStatsPeriodTabs();
}

// ---------- Confirm dialog ----------

function showConfirmDialog(title, message) {
	return new Promise((resolve) => {
		document.getElementById("confirm-title").textContent = title;
		document.getElementById("confirm-message").textContent = message;
		const dialog = document.getElementById("confirm-dialog");
		dialog.classList.remove("hidden");
		const ok = document.getElementById("confirm-ok");
		const cancel = document.getElementById("confirm-cancel");
		function cleanup() {
			dialog.classList.add("hidden");
			ok.removeEventListener("click", onOk);
			cancel.removeEventListener("click", onCancel);
		}
		function onOk() {
			cleanup();
			resolve(true);
		}
		function onCancel() {
			cleanup();
			resolve(false);
		}
		ok.addEventListener("click", onOk);
		cancel.addEventListener("click", onCancel);
	});
}

// ---------- Delete account ----------

async function handleDeleteAccount() {
	if (typeof deleteAccount !== "function") {
		showToast("Account deletion is not available in this mode.", "info");
		return;
	}
	const confirmed = await showConfirmDialog(
		"Delete Account",
		"Your cloud data (climbs, ascents, photos) will be permanently deleted from the server. Your local session will end. This cannot be undone.",
	);
	if (!confirmed) return;
	try {
		await deleteAccount();
		window.location.href = "../login.html";
	} catch (err) {
		console.error("Delete account failed:", err);
		showToast("Failed to delete account. Please try again.", "error");
	}
}

// ---------- API Keys ----------

async function renderApiKeys() {
	const list = document.getElementById("api-keys-list");
	if (!list) return;

	list.innerHTML =
		'<p style="color:#94a3b8;font-size:14px;margin:0">Loading…</p>';

	try {
		const keys = await apiKeysList();

		if (keys.length === 0) {
			list.innerHTML =
				'<p style="color:#94a3b8;font-size:14px;margin:0">No API keys yet.</p>';
			return;
		}

		list.innerHTML = keys
			.map((k) => {
				const created = k.createdAt
					? new Date(k.createdAt).toLocaleDateString("en-US", {
							year: "numeric",
							month: "short",
							day: "numeric",
						})
					: "—";
				const lastUsed = k.lastUsedAt
					? new Date(k.lastUsedAt).toLocaleDateString("en-US", {
							year: "numeric",
							month: "short",
							day: "numeric",
						})
					: "never";
				return `
        <div class="account-card" style="margin-bottom:0.5rem">
          <div class="account-card-text">
            <strong>🔑 ${escapeHtml(k.label)}</strong>
            <p style="margin:2px 0 0">
              <span class="type-badge">${escapeHtml((k.scopes || []).join(", "))}</span>
            </p>
            <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">
              Created ${created} · Last used ${lastUsed}
            </p>
          </div>
          <button class="btn btn-danger btn-sm"
                  data-key-id="${escapeHtml(k.id)}"
                  data-key-label="${escapeHtml(k.label)}">Revoke</button>
        </div>
      `;
			})
			.join("");

		list.querySelectorAll(".btn-danger").forEach((btn) => {
			btn.addEventListener("click", () =>
				handleRevokeKey(btn.dataset.keyId, btn.dataset.keyLabel),
			);
		});
	} catch (e) {
		console.error("Failed to load API keys:", e);
		list.innerHTML =
			'<p style="color:#ef4444;font-size:14px;margin:0">Failed to load keys.</p>';
	}
}

async function handleRevokeKey(keyId, label) {
	const confirmed = await showConfirmDialog(
		"Revoke Key?",
		`"${label}" will stop working immediately. This cannot be undone.`,
	);
	if (!confirmed) return;
	try {
		await apiKeysRevoke(keyId);
		showToast("API key revoked.", "success");
		await renderApiKeys();
	} catch (e) {
		console.error("Revoke failed:", e);
		showToast("Failed to revoke key. Please try again.", "error");
	}
}

function openApiKeyOverlay() {
	document.getElementById("api-key-label").value = "";
	document.getElementById("api-key-label-error").classList.add("hidden");
	document
		.querySelectorAll('#api-key-overlay input[name="api-key-scope"]')
		.forEach((cb) => {
			cb.checked = true;
		});
	document.getElementById("api-key-overlay").classList.remove("hidden");
	document.getElementById("api-key-label").focus();
}

function closeApiKeyOverlay() {
	document.getElementById("api-key-overlay").classList.add("hidden");
}

async function handleGenerateKey() {
	const label = document.getElementById("api-key-label").value.trim();
	const errorEl = document.getElementById("api-key-label-error");

	if (!label) {
		errorEl.classList.remove("hidden");
		document.getElementById("api-key-label").focus();
		return;
	}
	errorEl.classList.add("hidden");

	const scopes = [
		...document.querySelectorAll(
			'#api-key-overlay input[name="api-key-scope"]:checked',
		),
	].map((cb) => cb.value);
	if (scopes.length === 0) {
		showToast("Select at least one scope.", "error");
		return;
	}

	const saveBtn = document.getElementById("api-key-overlay-save");
	saveBtn.disabled = true;
	saveBtn.textContent = "Generating…";

	try {
		const result = await apiKeysCreate({ label, scopes });
		closeApiKeyOverlay();
		document.getElementById("api-key-created-value").textContent = result.key;
		document
			.getElementById("api-key-created-overlay")
			.classList.remove("hidden");
		await renderApiKeys();
	} catch (e) {
		console.error("Generate key failed:", e);
		showToast("Failed to generate key. Please try again.", "error");
	} finally {
		saveBtn.disabled = false;
		saveBtn.textContent = "Generate";
	}
}

function bindApiKeyOverlayHandlers() {
	document
		.getElementById("api-key-generate-btn")
		?.addEventListener("click", openApiKeyOverlay);
	document
		.getElementById("api-key-overlay-close")
		?.addEventListener("click", closeApiKeyOverlay);
	document
		.getElementById("api-key-overlay-cancel")
		?.addEventListener("click", closeApiKeyOverlay);
	document.getElementById("api-key-overlay")?.addEventListener("click", (e) => {
		if (e.target === e.currentTarget) closeApiKeyOverlay();
	});
	document
		.getElementById("api-key-overlay-save")
		?.addEventListener("click", handleGenerateKey);
}

function bindApiKeyCreatedHandlers() {
	document.getElementById("api-key-copy-btn")?.addEventListener("click", () => {
		const key = document.getElementById("api-key-created-value").textContent;
		navigator.clipboard
			.writeText(key)
			.then(() => showToast("Key copied to clipboard!", "success"))
			.catch(() => showToast("Copy failed — please copy manually.", "error"));
	});
	document
		.getElementById("api-key-created-done")
		?.addEventListener("click", () => {
			document
				.getElementById("api-key-created-overlay")
				.classList.add("hidden");
		});
}

function bindApiKeyHandlers() {
	bindApiKeyOverlayHandlers();
	bindApiKeyCreatedHandlers();
}

// ---------- Init ----------

// Exposed on globalThis for non-module consumers (admin.js, training-ui.js,
// overlay-common.js, send-overlay-ui.js read it via globalThis shims).
globalThis.showConfirmDialog = showConfirmDialog;

// Modules run after DOM is parsed; execute init immediately (no DOMContentLoaded needed)

document.getElementById("view-account")?.addEventListener("click", (e) => {
	e.preventDefault();
	showAccountView();
});

document.getElementById("view-stats")?.addEventListener("click", (e) => {
	e.preventDefault();
	showStatsView();
});

document
	.getElementById("delete-account-btn")
	?.addEventListener("click", handleDeleteAccount);

bindApiKeyHandlers();
