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
 * Build descriptor objects for the iOS-style route-type filter chip bar.
 *
 * @param {string[]} types distinct route types present in user's logbook
 * @param {string} [activeType=""] currently active route-type filter
 * @returns {Array<{ value: string, label: string, dotClass: string|null, active: boolean }>}
 */
export function buildRouteTypeChips(types, activeType = "") {
	const current = activeType ?? "";
	const chips = [
		{
			value: "",
			label: "All Types",
			dotClass: null,
			active: current === "",
		},
	];
	for (const t of types ?? []) {
		if (!t) continue;
		chips.push({
			value: t,
			label: t,
			dotClass: routeTypeDotClass(t),
			active: current === t,
		});
	}
	return chips;
}

/**
 * Render HTML for the route-type filter chip bar.
 *
 * @param {string[]} types
 * @param {string} [activeType=""]
 * @returns {string}
 */
export function renderRouteTypeChipsHtml(types, activeType = "") {
	return buildRouteTypeChips(types, activeType)
		.map((chip) => {
			const activeCls = chip.active ? " active" : "";
			const dot = chip.dotClass
				? `<span class="rt-dot ${chip.dotClass}"></span>`
				: "";
			const val = escapeInspectorHtml(chip.value);
			const lbl = escapeInspectorHtml(chip.label);
			return `<button type="button" class="rt-chip${activeCls}" data-routetype="${val}">${dot}${lbl}</button>`;
		})
		.join("");
}

// ── Route Detail Inspector HTML rendering ───────────────────────────────────

/**
 * Empty state when no climb is available to inspect.
 *
 * @returns {string}
 */
export function renderInspectorEmptyHtml() {
	return `<div class="insp-empty">Select a climb row to inspect route details, ascents, and coordinates.</div>`;
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
      <td><span class="type-badge">${escapeInspectorHtml(climb.routeType || "—")}</span></td>
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
export function renderInspectorHtml(climb, meta = {}) {
	if (!climb) return renderInspectorEmptyHtml();

	const {
		country = null,
		sendBadgeClass = "send-proj",
		communityRating = null,
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
		</div>
		${renderInspectorProjectSection(climb)}
		<div id="inspector-ascents-container"></div>
		<div id="inspector-gps-container"><div class="insp-sec insp-coords-row"><span>Coordinates</span><span class="insp-coords-pending">—</span></div></div>
		<div id="inspector-photos-container"></div>
		<div class="insp-actions">
			<button type="button" class="btn-inspector-primary" id="inspector-edit-btn">${inspectorPrimaryButtonLabel(climb.sendType)}</button>
		</div>
	`;
}
