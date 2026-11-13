// ui-theme.js — Pure helpers for the SendLog web app's new UI: iOS route-type
// filter chips, compact climb rows, and the Route Detail Inspector.
//
// Kept DOM-free and Firestore-free so every helper is unit-testable with vitest.

"use strict";

// ── iOS Route-type colors (mirrors StatsView.getRouteTypeColor in iOS) ──────

export const ROUTE_TYPE_DOT_MAP = {
	Sport: "rt-sport",
	Boulder: "rt-boulder",
	"Multi-Pitch": "rt-multipitch",
	Trad: "rt-trad",
	Gym: "rt-gym",
	"Gym Boulder": "rt-gymboulder",
};

/**
 * CSS class for the route-type color dot.
 *
 * @param {string|null|undefined} routeType
 * @returns {string}
 */
export function routeTypeDotClass(routeType) {
	return ROUTE_TYPE_DOT_MAP[routeType] ?? "rt-default";
}

/**
 * CSS class for the route-type font color (same palette as the dots —
 * used by the filter chips and the table's Type column).
 *
 * @param {string|null|undefined} routeType
 * @returns {string}
 */
export function routeTypeColorClass(routeType) {
	return routeTypeDotClass(routeType).replace("rt-", "rt-text-");
}

/** Canonical chip display order — NOT alphabetical (the old sort scattered
 * related types); mirrors the iOS StatsView palette order. Types the user
 * never logged get no chip (data-driven bar); unknown/legacy types are
 * appended alphabetically so nothing disappears. */
const ROUTE_TYPE_CHIP_ORDER = [
	"Sport",
	"Multi-Pitch",
	"Trad",
	"Boulder",
	"Gym",
	"Gym Boulder",
];

/**
 * Escape HTML special characters for safe template interpolation.
 *
 * @param { unknown } str
 * @returns {string}
 */
export function escapeInspectorHtml(str) {
	if (str == null) return "";
	// S6551-safe coercion: JSON.stringify never falls back to "[object Object]"
	const text = typeof str === "string" ? str : JSON.stringify(str);
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

/**
 * Ordered, Gym-merged route-type values for the chip bar and the hidden
 * filter select (pure): canonical order (ROUTE_TYPE_CHIP_ORDER), Gym Boulder
 * merged into Gym (the filter side groups them too), unknown/legacy types
 * appended alphabetically so nothing disappears.
 *
 * @param {string[]} types distinct route types present in user's logbook
 * @returns {string[]}
 */
export function orderRouteTypeFilterValues(types) {
	const present = new Set((types ?? []).filter(Boolean));
	const ordered = [];
	for (const t of ROUTE_TYPE_CHIP_ORDER) {
		if (t === "Gym Boulder") continue; // merged into the Gym chip
		const show =
			t === "Gym"
				? present.has("Gym") || present.has("Gym Boulder")
				: present.has(t);
		if (show) ordered.push(t);
	}
	const known = new Set(ROUTE_TYPE_CHIP_ORDER);
	for (const t of [...present]
		.filter((u) => !known.has(u))
		.sort((a, b) => a.localeCompare(b))) {
		ordered.push(t);
	}
	return ordered;
}

/**
 * Build descriptor objects for the iOS-style route-type filter chip bar.
 * Every type keeps its raw value/label (e.g. "Multi-Pitch"); see
 * orderRouteTypeFilterValues for the ordering and Gym-merge rules.
 *
 * @param {string[]} types distinct route types present in user's logbook
 * @param {string} [activeType=""] currently active route-type filter
 * @returns {Array<{ value: string, label: string, colorClass: string|null, active: boolean }>}
 */
export function buildRouteTypeChips(types, activeType = "") {
	const current = activeType ?? "";
	const chips = [
		{
			value: "",
			label: "All Types",
			colorClass: null,
			active: current === "",
		},
	];
	for (const t of orderRouteTypeFilterValues(types)) {
		chips.push({
			value: t,
			label: t,
			colorClass: routeTypeColorClass(t),
			// The merged Gym chip also represents a raw legacy "Gym Boulder"
			// filter value (e.g. a stored filter state from before the merge).
			active:
				t === "Gym"
					? current === "Gym" || current === "Gym Boulder"
					: current === t,
		});
	}
	return chips;
}

/**
 * Render HTML for the route-type filter chip bar. The type color lives in
 * the label font (no dot) — the same color repeats in the table's Type
 * column, so chips and rows read as one system.
 *
 * @param {string[]} types
 * @param {string} [activeType=""]
 * @returns {string}
 */
export function renderRouteTypeChipsHtml(types, activeType = "") {
	return buildRouteTypeChips(types, activeType)
		.map((chip) => {
			const activeCls = chip.active ? " active" : "";
			const val = escapeInspectorHtml(chip.value);
			const lbl = escapeInspectorHtml(chip.label);
			const color = chip.colorClass
				? `<span class="${escapeInspectorHtml(chip.colorClass)}">${lbl}</span>`
				: lbl;
			return `<button type="button" class="rt-chip${activeCls}" data-routetype="${val}">${color}</button>`;
		})
		.join("");
}

// ── Route Detail Inspector HTML rendering ───────────────────────────────────

/**
 * Empty state when no climb is available to inspect.
 *
 * @returns {string}
 */
/** Local calendar date (YYYY-MM-DD) for <input type="date"> hydration and
 * defaults — toISOString() would shift the day in non-UTC timezones, which
 * round-trips badly with date inputs that were parsed as local dates. */
export function formatDateInput(date = new Date()) {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Legacy-web compatibility: previous web versions parsed date-only inputs
 * as UTC midnight, so their stored timestamps sit exactly at 00:00:00.000Z
 * (iOS writes local-midnight dates instead). Normalize such timestamps to
 * local midnight of the intended (UTC calendar) date so hydration doesn't
 * shift the day in non-UTC timezones. New local-midnight records are
 * untouched. */
/** Pitch count tolerance: "" / garbage → 0, clamped to 0–99 (iOS Stepper
 * limit from MultiPitchPlanFormFields). */
export function coercePitchCount(raw) {
	const n = Number(raw);
	if (Number.isNaN(n)) return 0;
	return Math.min(99, Math.max(0, Math.floor(n)));
}

export function normalizeLegacyUtcMidnight(date) {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return date;
	// Exact UTC midnight ⇔ the epoch milliseconds are a whole number of days.
	if (date.getTime() % 86400000 !== 0) return date;
	if (date.getTimezoneOffset() === 0) return date; // UTC zone: no shift
	return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Parse a date value as a LOCAL calendar date: "YYYY-MM-DD" strings become
 * local midnight — matching iOS, which writes local-midnight dates (Core Data
 * calendar dates). new Date("YYYY-MM-DD") parses as UTC midnight and shifts
 * the day in non-UTC timezones. Date values pass through unchanged. */
export function parseLocalDate(value) {
	if (value instanceof Date) return value;
	if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
		const [y, m, d] = value.split("-").map(Number);
		return new Date(y, m - 1, d);
	}
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function renderInspectorEmptyHtml(message) {
	const text = escapeInspectorHtml(
		message ?? "Select a climb row to inspect route details, ascents, and coordinates.",
	);
	return `<div class="insp-empty">${text}</div>`;
}

function renderInspectorAreaCrag(climb) {
	const area = escapeInspectorHtml(climb.climbingArea || "—");
	if (!climb.crag) return area;
	return `${area} · ${escapeInspectorHtml(climb.crag)}`;
}

function renderInspectorProjectSection(climb) {
	if (!climb.isProject && !climb.projectStatus) return "";
	const status = climb.projectStatus
		? escapeInspectorHtml(climb.projectStatus)
		: "Working";
	const attempts = climb.attemptCount
		? ` · ${Number(climb.attemptCount)} attempts`
		: "";
	const notes = climb.projectNotes
		? `<div class="insp-note-body" style="margin-top:6px">${escapeInspectorHtml(climb.projectNotes)}</div>`
		: "";
	return `
		<div class="insp-sec"><span>Project</span><span>${status}${attempts}</span></div>
		${notes}
	`;
}

const CLOUD_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;

function renderChalkSkyRouteIndicators({ centralRouteID, countryCode, countryName }) {
	if (!centralRouteID) return "";
	const cloud = `<span class="cs-route-cloud" title="In community database">${CLOUD_SVG}</span>`;
	const iso = countryCode
		? `<span class="cs-route-iso" title="${escapeInspectorHtml(countryName || countryCode)}">${escapeInspectorHtml(countryCode)}</span>`
		: "";
	return `<span class="cs-route-meta">${cloud}${iso}</span>`;
}

/**
 * Render route-row indicators for community-linked climbs: cloud SVG for the
 * community DB + ISO country pill.
 *
 * @param {{
 *   centralRouteID?: string|null,
 *   countryCode?: string|null,
 *   countryName?: string|null,
 * }} [info]
 * @returns {string}
 */
export function renderRouteCellIndicatorsHtml(info = {}) {
	return renderChalkSkyRouteIndicators(info);
}

/**
 * Owner indicator for community-DB search results — cloud symbol plus an
 * "Owner" label when the current user created the route.
 *
 * @param {boolean} isOwner
 * @returns {string}
 */
export function renderCommunityOwnerIndicatorHtml(isOwner) {
	if (!isOwner) return "";
	return `<span class="cs-owner-indicator" title="You created this route">${CLOUD_SVG}<span>Owner</span></span>`;
}

// ── Compact climb-row rendering (Chalk & Sky only) ──────────────────────

/** Climber shorthand for send styles (8a.nu / TheCrag convention). */
export const STYLE_ABBREVIATIONS = {
	Redpoint: "RP",
	"On Sight": "OS",
	"Top Rope": "TR",
	"All Free": "AF",
	Pinkpoint: "PP",
	Project: "PJ",
	Flash: "FL",
	Top: "TP",
};

/**
 * Abbreviate a send style for the compact table column.
 * Falls back to the first two letters for unknown/legacy styles.
 *
 * @param {string|null|undefined} sendType
 * @returns {string}
 */
export function styleAbbreviation(sendType) {
	if (!sendType) return "—";
	return STYLE_ABBREVIATIONS[sendType] ?? sendType.slice(0, 2).toUpperCase();
}

/**
 * Locale-aware short numeric date ("12/10/2025" in en-US, "12.10.2025"
 * in de-DE) — every user sees their own convention, so no ambiguity.
 *
 * @param {Date|string|number|null|undefined} date
 * @returns {string}
 */
export function formatShortNumericDate(date) {
	if (!date) return "—";
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString(undefined, {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export function renderAreaCragCell(climb) {
	const area = escapeInspectorHtml(climb.climbingArea || "—");
	if (!climb.crag) return area;
	return `${area} <small style="color:#64748b">/ ${escapeInspectorHtml(climb.crag)}</small>`;
}

/**
 * Render the compact Chalk & Sky climb-row cells: drops the Rating column
 * (details live in the Inspector) and shrinks Style (climber shorthand with
 * full-name tooltip) and Date (locale-aware numeric with full-date tooltip).
 *
 * @param {object} climb
 * @param {object} rowMeta { gradeClass, sendClass }
 * @returns {string}
 */
function lookupRowCountry(deps, routeID) {
	if (!routeID || !deps.routeCountries) return null;
	return deps.routeCountries.get(routeID) ?? null;
}

function lookupRowCountryName(deps, code) {
	if (!code || !deps.countryName) return null;
	return deps.countryName(code);
}

function lookupRowFlagEmoji(deps, code) {
	if (!code || !deps.flagEmoji) return null;
	return deps.flagEmoji(code);
}

function compactRowIndicators(climb, deps) {
	const routeID = climb.centralRouteID;
	const hasGps = Boolean(routeID && deps.gpsData?.has(routeID));
	const code = lookupRowCountry(deps, routeID);
	return renderRouteCellIndicatorsHtml({
		centralRouteID: routeID,
		hasGps,
		countryCode: code,
		countryName: lookupRowCountryName(deps, code),
		flagEmoji: lookupRowFlagEmoji(deps, code),
	});
}

export function buildCompactClimbRowCellsHtml(climb, rowMeta, deps) {
	const indicators = compactRowIndicators(climb, deps);
	const routeName = escapeInspectorHtml(climb.route || "—");
	const grade = escapeInspectorHtml(climb.difficulty || "—");
	const dateText = formatShortNumericDate(climb.date);
	const fullDate = escapeInspectorHtml(deps.longDateText);
	const abbr = escapeInspectorHtml(styleAbbreviation(climb.sendType));
	const fullStyle = escapeInspectorHtml(climb.sendType || "—");

	const areaCragText = `${climb.climbingArea || "—"}${climb.crag ? " / " + climb.crag : ""}`;

	return `
      <td><div class="cs-route-cell" title="${routeName}"><strong>${routeName}</strong>${indicators}</div></td>
      <td title="${escapeInspectorHtml(areaCragText)}">${renderAreaCragCell(climb)}</td>
      <td><span class="type-badge ${escapeInspectorHtml(routeTypeColorClass(climb.routeType))}">${escapeInspectorHtml(climb.routeType || "—")}</span></td>
      <td><span class="badge ${escapeInspectorHtml(rowMeta.gradeClass)}">${grade}</span></td>
      <td class="cs-date-cell" title="${fullDate}">${dateText}</td>
      <td><span class="badge ${escapeInspectorHtml(rowMeta.sendClass)} cs-style-badge" title="${fullStyle}">${abbr}</span></td>
    `;
}

function renderInspectorCloudBadge(centralRouteID) {
	if (!centralRouteID) return "";
	return `<span class="insp-cloud-pill" id="insp-cloud-pill" title="In community database">${CLOUD_SVG}</span>`;
}

function renderInspectorIsoBadge(country) {
	if (!country) {
		return `<span class="insp-iso-pill hidden" id="inspector-country-pill"></span>`;
	}
	return `<span class="insp-iso-pill" id="inspector-country-pill">${escapeInspectorHtml(country)}</span>`;
}

export function formatCommunityRating(communityRating, communityCount = null) {
	if (typeof communityRating !== "number") return "—";
	const base = `★ ${communityRating.toFixed(1)}`;
	return typeof communityCount === "number"
		? `${base} (${communityCount})`
		: base;
}

function inspectorPrimaryButtonLabel(sendType) {
	return sendType === "Project" ? "Edit Project" : "Log Ascent / Edit";
}

/**
 * Combine the original send (from the climb note — date, style, note) with
 * the repeat ascents from the ascent sub-collection. The original send IS an
 * ascent — it always leads the log. Projects contribute their first-attempt
 * entry (sendType "Project").
 *
 * @param {{
 *   date?: Date|null,
 *   sendType?: string|null,
 *   noteText?: string|null,
 * }} climb
 * @param {Array<{ date?: string|Date, sendType?: string, notes?: string }>} ascents
 * @returns {Array<{ date: Date|string|null, sendType: string, notes: string|null, original: boolean }>}
 */
export function combineAscentsWithOriginalSend(climb, ascents) {
	const repeats = Array.isArray(ascents) ? ascents : [];
	if (!climb.date && !climb.sendType) return repeats;
	const original = {
		date: climb.date ?? null,
		sendType: climb.sendType ?? "Redpoint",
		notes: climb.noteText ?? null,
		original: true,
	};
	return [original, ...repeats];
}

/**
 * Render the async Repeat Ascents section inside the Route Detail Inspector.
 *
 * @param {Array<{ date?: string|Date, sendType?: string, notes?: string }>} ascents
 * @returns {string}
 */
export function renderInspectorAscentsHtml(ascents, sendClasses = {}) {
	const list = ascents ?? [];
	const label =
		list.length === 1 ? "1 entry" : `${list.length} entries`;
	const items = list.length
		? list
			.map((a) => {
				const dateStr = a.date
					? new Date(a.date).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
							year: "numeric",
						})
					: "—";
				const fullSt = escapeInspectorHtml(a.sendType ?? "Redpoint");
				const badgeCls = escapeInspectorHtml(
					sendClasses[a.sendType] ?? "send-proj",
				);
				const note = a.notes
					? `<div class="insp-ascent-note">${escapeInspectorHtml(a.notes)}</div>`
					: "";
				return `<div class="insp-ascent-item">
					<div class="insp-ascent-row1">
						<span class="insp-ascent-date">${escapeInspectorHtml(dateStr)}</span>
						<span class="badge ${badgeCls} cs-style-badge" title="${fullSt}">${escapeInspectorHtml(styleAbbreviation(a.sendType))}</span>
					</div>
					${note}
				</div>`;
			})
			.join("")
		: `<div class="insp-mini-row insp-empty-row"><span>No ascents logged yet</span></div>`;
	return `
		<div class="insp-sec"><span>Ascent Log</span><span>${label}</span></div>
		<div class="insp-ascent-list">${items}</div>
	`;
}

function hasValidCoordinates(route) {
	if (!route) return false;
	return typeof route.latitude === "number" && typeof route.longitude === "number";
}

/**
 * Render the async GPS coordinates section inside the Route Detail Inspector.
 *
 * @param {{ latitude?: number|null, longitude?: number|null }|null|undefined} route
 * @param {string} [climbName="Route start"]
 * @returns {string}
 */
export function renderInspectorGpsHtml(route, climbName = "Route start") {
	if (!hasValidCoordinates(route)) return "";
	const coords = `${route.latitude.toFixed(5)}°, ${route.longitude.toFixed(5)}°`;
	const mapsURL = `https://maps.apple.com/?ll=${route.latitude},${route.longitude}&q=${encodeURIComponent(climbName || "Route start")}`;
	return `
		<div class="insp-sec insp-coords-row">
			<span>Coordinates</span>
			<a href="${escapeInspectorHtml(mapsURL)}" target="_blank" rel="noopener" class="insp-maps-link" title="Open in Maps">${coords}</a>
		</div>
	`;
}

/**
 * Render the async Photos strip inside the Route Detail Inspector.
 *
 * @param {Array<{ storageURL?: string }>} photos
 * @returns {string}
 */
export function renderInspectorPhotosHtml(photos) {
	if (!photos || photos.length === 0) return "";
	const imgs = photos
		.map((p) => {
			const url = escapeInspectorHtml(p.storageURL);
			return `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Route photo" /></a>`;
		})
		.join("");
	return `<div class="insp-sec"><span>Photos</span></div><div class="insp-photos-strip">${imgs}</div>`;
}

/**
 * Render the shared Route Detail card HTML — used by BOTH the right-hand
 * Route Inspector (variant "inspector") and the Full-Details modal
 * (variant "modal"). Same structure, different element-ID prefix and
 * action buttons.
 *
 * @param {object|null|undefined} climb
 * @param {{
 *   country?: string|null,
 *   sendBadgeClass?: string,
 *   communityRating?: number|null,
 * }} [meta]
 * @returns {string}
 */
/** "7 pitches" / "1 pitch" label for the plan header. */
function pitchCountLabel(count) {
	return `${count} pitch${count === 1 ? "" : "es"}`;
}

/**
 * Multi-Pitch Plan section for the Route Inspector (iOS parity with
 * MultiPitchPlanSection.planDetailsCard): Pitches / Approach / Descent /
 * Gear. Renders nothing unless the climb is Multi-Pitch with plan data —
 * like iOS's hasPlanDetails.
 *
 * @param {object|null|undefined} climb
 * @returns {string} HTML ("" when not applicable)
 */
export function renderMultiPitchPlanHtml(climb) {
	if (!climb || climb.routeType !== "Multi-Pitch") return "";
	const pitches = Number(climb.numberOfPitches) || 0;
	const noteRows = [
		["Approach", climb.approachNotes],
		["Descent", climb.descentNotes],
		["Gear", climb.gearNotes],
	]
		.filter(([, text]) => Boolean(text))
		.map(
			([label, text]) =>
				`<div class="insp-sec"><span>${escapeInspectorHtml(label)}</span></div>` +
				`<div class="insp-note-body">${escapeInspectorHtml(text)}</div>`,
		)
		.join("");
	if (pitches <= 0 && !noteRows) return "";
	const header =
		`<div class="insp-sec"><span>Multi-Pitch Plan</span>` +
		(pitches > 0 ? `<span>${pitchCountLabel(pitches)}</span>` : "") +
		`</div>`;
	return header + noteRows;
}

/**
 * "Log Attempt" section for the Route Inspector (item #10 of
 * docs/plan-new-ui-gui-followups.md): a toggle button that expands a compact
 * attempt form — same fields as the project overlay's Log Attempt section
 * (iOS AttemptLogView parity). Rendered only for active projects; hidden for
 * completed/abandoned projects and for sends, like iOS.
 *
 * The DOM wiring (expand/collapse, save) lives in climb-inspector-ui.js.
 *
 * @param {object|null|undefined} climb
 * @returns {string} HTML ("" when not applicable)
 */
export function renderInspectorAttemptSectionHtml(climb) {
	if (!climb?.isProject || !climb.recordName) return "";
	const status = String(climb.projectStatus ?? "").toLowerCase();
	if (status === "completed" || status === "abandoned") return "";
	return `
		<button type="button" class="btn-inspector-ghost insp-attempt-toggle" id="insp-attempt-toggle">Log Attempt</button>
		<div class="insp-attempt-form hidden" id="insp-attempt-form">
			<div class="insp-attempt-grid">
				<div>
					<label for="insp-attempt-date">Attempt Date</label>
					<input type="date" id="insp-attempt-date" value="${formatDateInput()}" />
				</div>
				<div>
					<label for="insp-attempt-duration">Duration (min)</label>
					<input type="number" id="insp-attempt-duration" min="0" max="999" step="5" value="0" />
				</div>
			</div>
			<div class="insp-attempt-field">
				<label for="insp-attempt-highpoint">High Point</label>
				<input type="text" id="insp-attempt-highpoint" placeholder="e.g. 'First crux', 'Halfway'" />
			</div>
			<div class="insp-attempt-field">
				<label for="insp-attempt-notes">Attempt Notes</label>
				<textarea id="insp-attempt-notes" rows="3" placeholder="What was hard? What beta worked well?"></textarea>
			</div>
			<div class="insp-attempt-footer">
				<label class="insp-attempt-success-row" for="insp-attempt-success">
					<input type="checkbox" id="insp-attempt-success" />
					Send was successful
				</label>
				<button type="button" class="btn-inspector-primary" id="insp-save-attempt">Save Attempt</button>
			</div>
		</div>
	`;
}

export function renderInspectorHtml(climb, meta = {}) {
	if (!climb) return renderInspectorEmptyHtml();

	const {
		country = null,
		sendBadgeClass = "send-proj",
		communityRating = null,
		userRating = null,
	} = meta;

	const routeName = escapeInspectorHtml(climb.route || "—");
	const grade = escapeInspectorHtml(climb.difficulty || "—");
	const rType = escapeInspectorHtml(climb.routeType || "Sport");
	const dotCls = routeTypeDotClass(climb.routeType);
	const sendType = escapeInspectorHtml(climb.sendType || "—");
	const commText = formatCommunityRating(communityRating);
	const cloudBadge = renderInspectorCloudBadge(climb.centralRouteID);
	const isoBadge = renderInspectorIsoBadge(country);

	return `
		<div class="insp-top">
			<div class="insp-title">${routeName}</div>
			<span class="insp-grade-wrap"><span class="badge insp-grade-pill">${grade}</span>${cloudBadge}</span>
		</div>
		<div class="insp-meta">
			${isoBadge}
			<span>${renderInspectorAreaCrag(climb)}</span>
			<span>·</span>
			<span class="insp-type"><span class="rt-dot ${dotCls}"></span>${rType}</span>
		</div>
		<div class="insp-grid">
			<div>
				<div class="insp-cell-l">Style</div>
				<div class="insp-cell-v"><span class="badge ${escapeInspectorHtml(sendBadgeClass)} cs-style-badge" title="${sendType}">${escapeInspectorHtml(styleAbbreviation(climb.sendType))}</span></div>
			</div>
			<div>
				<div class="insp-cell-l">Ascents</div>
				<div class="insp-cell-v" id="inspector-ascents-count">—</div>
			</div>
			<div>
				<div class="insp-cell-l">Community</div>
				<div class="insp-cell-v" id="inspector-comm-rating">${commText}</div>
			</div>
			<div>
				<div class="insp-cell-l">Your Rating</div>
				<div class="insp-cell-v">${userRating ? renderStarsHtml(userRating) : "—"}</div>
			</div>
		</div>
		${renderInspectorProjectSection(climb)}
		${renderInspectorAttemptSectionHtml(climb)}
		${renderMultiPitchPlanHtml(climb)}
		<div id="inspector-ascents-container"></div>
		<div id="inspector-gps-container"><div class="insp-sec insp-coords-row"><span>Coordinates</span><span class="insp-coords-pending">—</span></div></div>
		<div id="inspector-photos-container"></div>
		<div class="insp-actions">
			<button type="button" class="btn-inspector-primary" id="inspector-edit-btn">${inspectorPrimaryButtonLabel(climb.sendType)}</button>
		</div>
	`;
}

// ── Training session detail card ────────────────────────────────────────────

const GYM_SESSION_TYPE = "Gym Session";

/** Star row for a 0–5 rating; rounds like the iOS star picker. */
export function renderStarsHtml(rating) {
	const n = Math.round(rating ?? 0);
	let s = "";
	for (let i = 1; i <= 5; i++) s += i <= n ? "★" : "☆";
	return `<span class="stars">${s}</span>`;
}

/**
 * Locale-aware long date ("Fri, Nov 6, 2026") for detail cards.
 *
 * @param {Date|string|number|null|undefined} date
 * @returns {string}
 */
export function formatLongDate(date) {
	if (!date) return "—";
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/**
 * Intensity 1–5 dot row — sky-blue dots come from `.intensity-dot`/`.filled`
 * CSS only (no inline colors; that regression happened once already).
 *
 * @param {number|null|undefined} intensity
 * @returns {string}
 */
export function buildIntensityDotsHtml(intensity) {
	const level = Number.isFinite(Number(intensity)) ? Number(intensity) : 3;
	const dots = [1, 2, 3, 4, 5]
		.map((i) => `<span class="intensity-dot${i <= level ? " filled" : ""}"></span>`)
		.join("");
	return `<span class="intensity-dots">${dots}</span>`;
}

/**
 * Warm-up route lines of a gym session (grade + style · outcome).
 * Empty when the session has no routes.
 *
 * @param {Array<{ grade?: string, style?: string, outcome?: string }>|null|undefined} routes
 * @returns {string}
 */
export function buildWarmupRoutesHtml(routes) {
	if (!routes?.length) return "";
	const rows = routes
		.map(
			(r) =>
				`<tr><td>${escapeInspectorHtml(r.grade)}</td><td class="cs-detail-sub">${r.style === "top-rope" ? "Top-rope" : "Lead"} · ${r.outcome === "failed" ? "Failed" : "Sent"}</td></tr>`,
		)
		.join("");
	return `
		<div class="insp-sec"><span>Warm-up Routes</span><span>${routes.length}</span></div>
		<table class="cs-detail-table">${rows}</table>
	`;
}

/**
 * Sends attached to a gym session (route, difficulty, style).
 * Empty when none — the caller decides how to render that case.
 *
 * @param {Array<{ route?: string, difficulty?: string, sendType?: string }>|null|undefined} sends
 * @returns {string}
 */
export function buildSessionSendsTableHtml(sends) {
	if (!sends?.length) return "";
	const rows = sends
		.map(
			(s) =>
				`<tr><td>${escapeInspectorHtml(s.route)}</td><td class="cs-detail-sub">${escapeInspectorHtml(s.difficulty)} · ${escapeInspectorHtml(s.sendType ?? "")}</td></tr>`,
		)
		.join("");
	return `<table class="cs-detail-table">${rows}</table>`;
}

/**
 * Render the training-session detail card for the detail modal — the session
 * variant of the shared Route Detail card: type title, Date / Duration /
 * Intensity grid, gym info, warm-up routes, attached-sends placeholder
 * (filled asynchronously by ui.js for gym sessions), notes, Edit button.
 *
 * @param {object|null|undefined} session
 * @returns {string}
 */
export function renderTrainingDetailHtml(session) {
	if (!session) return renderInspectorEmptyHtml();

	const title = escapeInspectorHtml(session.type ?? "Training");
	const gym = session.gym
		? `<div class="insp-sec"><span>Gym</span><span>${escapeInspectorHtml(session.gym)}</span></div>`
		: "";
	const notes = session.notes
		? `<div class="insp-sec"><span>Notes</span></div><div class="insp-note-body">${escapeInspectorHtml(session.notes)}</div>`
		: "";
	const sendsSection =
		session.type === GYM_SESSION_TYPE
			? `<div class="insp-sec"><span>Attached Sends</span></div><div id="session-sends-section" class="train-sends-pending">…</div>`
			: "";

	return `
		<div class="insp-top"><div class="insp-title">${title}</div></div>
		<div class="insp-grid">
			<div>
				<div class="insp-cell-l">Date</div>
				<div class="insp-cell-v">${escapeInspectorHtml(formatLongDate(session.date))}</div>
			</div>
			<div>
				<div class="insp-cell-l">Duration</div>
				<div class="insp-cell-v">${session.duration ? `${Number(session.duration)} min` : "—"}</div>
			</div>
			<div>
				<div class="insp-cell-l">Intensity</div>
				<div class="insp-cell-v">${buildIntensityDotsHtml(session.intensity)}</div>
			</div>
		</div>
		${gym}
		${buildWarmupRoutesHtml(session.routes)}
		${sendsSection}
		${notes}
		<div class="insp-actions">
			<button type="button" class="btn-inspector-primary" id="training-detail-edit-btn">Edit Session</button>
		</div>
	`;
}
