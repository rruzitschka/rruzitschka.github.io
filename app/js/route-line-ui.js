// route-line-ui.js — warm-up route-line helpers for the training overlay's
// "Gym Session" mode (mirrors the iOS TrainingRouteEntry feature).
// Pure DOM, no module state — split out of ui.js to keep the dashboard
// module focused.

"use strict";

const GYM_SESSION_TYPE = "Gym Session";

/** Shows/hides the gym-only fields; only "Gym Session" gets them (iOS parity). */
export function syncGymFieldVisibility() {
	const isGym = document.getElementById("to-type").value === GYM_SESSION_TYPE;
	document.getElementById("to-gym-group").classList.toggle("hidden", !isGym);
	document
		.getElementById("to-routes-group")
		.classList.toggle("hidden", !isGym);
}

/** Renders one route-line row (grade, Lead/Top-rope, Sent/Failed). */
export function addRouteLine(entry = {}) {
	const container = document.getElementById("to-routes");
	const row = document.createElement("div");
	row.className = "route-line";
	row.dataset.id = entry.id ?? crypto.randomUUID().toUpperCase();
	const grade = document.createElement("input");
	grade.type = "text";
	grade.className = "route-line-grade";
	grade.placeholder = "Grade";
	grade.value = entry.grade ?? "";
	const style = document.createElement("select");
	style.className = "route-line-style";
	style.innerHTML =
		'<option value="lead">Lead</option>' +
		'<option value="top-rope">Top-rope</option>';
	style.value = entry.style ?? "lead";
	const outcome = document.createElement("select");
	outcome.className = "route-line-outcome";
	outcome.innerHTML =
		'<option value="sent">Sent</option><option value="failed">Failed</option>';
	outcome.value = entry.outcome ?? "sent";
	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "route-line-remove";
	remove.textContent = "✕";
	remove.title = "Remove route";
	remove.addEventListener("click", () => row.remove());
	row.append(grade, style, outcome, remove);
	container.appendChild(row);
}

/** Collects the route lines as TrainingRouteEntry-shaped objects (order is
 * renumbered + empty grades dropped on save, matching iOS). */
export function collectRouteLines() {
	return [...document.querySelectorAll("#to-routes .route-line")].map(
		(row) => ({
			id: row.dataset.id,
			grade: row.querySelector(".route-line-grade").value,
			style: row.querySelector(".route-line-style").value,
			outcome: row.querySelector(".route-line-outcome").value,
			order: 0,
		}),
	);
}

/** Prefills the gym-only fields; a null/empty routes list gets one blank
 * line so the user can start typing right away. */
export function setGymFields(gym, routes) {
	document.getElementById("to-gym").value = gym ?? "";
	document.getElementById("to-routes").innerHTML = "";
	(routes?.length ? routes : [{}]).forEach(addRouteLine);
}

/** Save-payload fragment for the gym-only fields: {} for non-gym session
 * types (merge must not touch iOS-written data), {gym, routes} otherwise. */
export function gymSessionFieldsForSave(type) {
	if (type !== GYM_SESSION_TYPE) return {};
	return {
		gym: document.getElementById("to-gym").value.trim() || null,
		routes: collectRouteLines(),
	};
}

/** Detail-modal HTML for the sends attached to a gym session (empty when
 * none — the caller decides how to render that case). */
export function buildSessionSendsHtml(sends, escapeHtml) {
	if (!sends?.length) return "";
	const rows = sends
		.map(
			(s) =>
				`<tr><td style="padding:0.2rem 0">${escapeHtml(s.route)}</td><td style="padding:0.2rem 0;color:#64748b">${escapeHtml(s.difficulty)} · ${escapeHtml(s.sendType ?? "")}</td></tr>`,
		)
		.join("");
	return `
	<div style="font-weight:600;margin-bottom:0.35rem">Attached Sends</div>
	<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.75rem">
		<table style="width:100%;border-collapse:collapse;font-size:0.93rem">${rows}</table>
	</div>
	`;
}

/** Detail-modal HTML for the warm-up routes table (empty when none). */
export function buildRoutesSectionHtml(routes, escapeHtml) {
	if (!routes?.length) return "";
	const routeRows = routes
		.map(
			(r) =>
				`<tr><td style="padding:0.2rem 0">${escapeHtml(r.grade)}</td><td style="padding:0.2rem 0;color:#64748b">${r.style === "top-rope" ? "Top-rope" : "Lead"} · ${r.outcome === "sent" ? "Sent" : "Failed"}</td></tr>`,
		)
		.join("");
	return `
	<div style="margin-bottom:1.25rem">
		<div style="font-weight:600;margin-bottom:0.35rem">Warm-up Routes</div>
		<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.75rem">
			<table style="width:100%;border-collapse:collapse;font-size:0.93rem">${routeRows}</table>
		</div>
	</div>
	`;
}
