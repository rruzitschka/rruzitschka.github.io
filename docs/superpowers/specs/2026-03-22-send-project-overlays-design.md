# Design Spec: Send vs Project Overlays + Button Alignment

**Date:** 2026-03-22  
**Status:** Approved  
**Scope:** `app/` (SPA web companion)

---

## Problem

1. **Button alignment bug** — the `+ Add Climb` button crowds the view heading instead of sitting right-aligned.
2. **Single generic overlay** — the "Add Climb" overlay serves both sends and projects but uses the same fields for both, which is confusing (projects don't have a date or style yet; sends shouldn't show project status).
3. **No path from project → send** — when a project is climbed, users have no way to convert it to a send from within the app.

---

## Solution Overview

Split the single "Add Climb" overlay into two purpose-built overlays — **Log Send** and **Add/Edit Project** — each with context-appropriate fields. Replace the always-visible `+ Add Climb` button with a context-aware button that shows `+ Log Send` or `+ Add Project` depending on the active filter view. Fix the button alignment with a proper flex layout.

---

## 1. Button Alignment Fix

The table header row (`<h3>` + action button) must use `display: flex; justify-content: space-between; align-items: center; width: 100%`. The button must have `flex: 0 0 auto` so it does not expand. The current bug is caused by `.btn-primary { flex: 1 }` in `app.css` being inherited when the button sits inside a flex container.

**Changes:** Add a `.table-header-row` CSS class for the header flex container; apply `flex: 0 0 auto` override on the action button variant inside it.

---

## 2. Context-Aware Action Button

| Active view | Button shown | Action |
|---|---|---|
| All Climbs | `+ Log Send` (blue) | Opens Log Send overlay |
| Sent | `+ Log Send` (blue) | Opens Log Send overlay |
| Projects | `+ Add Project` (purple) | Opens Add Project overlay |
| Training | *(no climb button shown)* | — |

The button visibility is toggled in the existing `setActiveView` function and in the filter-tab click handler when the Projects filter is selected.

---

## 3. Log Send Overlay (Add + Edit)

Replaces the existing "Add Climb" / "Edit Climb" overlay.

### Fields

| Field | Required | Notes |
|---|---|---|
| Route Name | ✅ | Text input |
| Area | — | Text input |
| Crag | — | Text input |
| Grade | — | Text input (free-form, e.g. `9a`) |
| Type | — | Select: Sport / Boulder / Multi-Pitch |
| Date | ✅ | Date input, defaults to today |
| Style | ✅ | Pill buttons (see below) |
| Rating | — | 1–5 star picker |
| Notes | — | Textarea |

### Style Pill Buttons

Replaces the current `<select>` with `sendType` options. Options: **Redpoint**, **On Sight**, **Flash**, **Pinkpoint**. No "Project" option here.

Each button has a distinct active colour:
- Redpoint → green (`#22c55e` border, `#f0fdf4` background)
- On Sight → blue (`#3b82f6` border, `#eff6ff` background)
- Flash → amber (`#f59e0b` border, `#fffbeb` background)
- Pinkpoint → pink (`#ec4899` border, `#fdf2f8` background)

Exactly one pill must be selected at all times. Clicking a pill deselects others and applies the active colour class.

### Edit Mode Extras

- **Repeat Ascents** section (hidden in Add mode): lists existing child `Ascent` records with date + style; allows adding new ascents inline; each existing ascent has a `✕` delete button.
- **Delete** button (bottom-left, red text) — triggers confirm dialog before deleting the ClimbNote and all child Ascents.

### Save Button

Blue, labelled "Save Send".

---

## 4. Add / Edit Project Overlay

New overlay, separate from the send overlay.

### Fields

| Field | Required | Notes |
|---|---|---|
| Route Name | ✅ | Text input |
| Area | — | Text input |
| Crag | — | Text input |
| Grade | — | Text input |
| Type | — | Select: Sport / Boulder / Multi-Pitch |
| Attempts | — | Number input, default 0 |
| Last Attempt Date | — | Date input |
| High Point | — | Text input (e.g. "2nd bolt") |
| Status | — | Select: Working / Close / Abandoned |
| Notes | — | Textarea |

**No Date, No Style dropdown, No Rating** — projects are works in progress, not completed sends.

### Edit Mode Extras

- **"Mark as Sent" button** (green, full-width, shown only in edit mode) — closes the project overlay and opens the Log Send overlay pre-filled with the project's Route Name, Grade, Area, and Crag. The project record is deleted after the send is saved successfully.
- **Delete** button (bottom-left, red text) — triggers confirm dialog.

### Save Button

Purple (`#7c3aed`), labelled "Save Project". Purple visually distinguishes project saves from blue send saves.

---

## 5. Data Model

Projects and sends are both stored as `ClimbNote` records. The distinguishing field is `sendType`:

- Sends: `sendType` = `Redpoint` | `On Sight` | `Flash` | `Pinkpoint`
- Projects: `sendType` = `Project`

Project-specific fields map to **existing** `ClimbNote` CloudKit fields:

| UI field | CloudKit field | Type |
|---|---|---|
| Attempts | `CD_attemptCount` (existing) | Integer 16 |
| Last Attempt Date | `CD_lastAttemptDate` (existing) | Date |
| High Point | `CD_highPoint` (existing) | String |
| Status | `CD_projectStatus` (existing) | String |

All four fields already exist in the iOS Core Data model — no schema additions required. The web app just needs to read and write them.

### Mock Data

`MOCK_CLIMBS` already contains 3 project entries (with `sendType: 'Project'`). The `window.saveClimbNote` mock override handles projects by reusing the same function with `sendType='Project'`. No separate `saveProject` function is needed.

---

## 6. "Mark as Sent" Flow

1. User clicks "Mark as Sent" in Edit Project overlay.
2. Project overlay closes.
3. Log Send overlay opens, pre-filled: Route Name, Grade, Area, Crag from the project record. Date defaults to today, Style defaults to Redpoint (first pill selected).
4. User fills in Date, selects Style, optionally sets Rating/Notes, clicks "Save Send".
5. `saveClimbNote` is called for the new send record.
6. On success: `deleteClimbNote` is called for the original project record (with its child Ascents cascade-deleted).
7. View refreshes — project disappears from Projects filter, new send appears in All Climbs / Sent.

The project's `recordName` must be held in a closure variable during the Log Send save so the delete can reference it after the save completes.

**Cancel behavior:** If the user clicks "Mark as Sent" but then cancels the Log Send overlay without saving, `deleteClimbNote` is never called — the project remains unchanged in CloudKit and the user returns to the normal view with no data loss.

**Partial failure:** If `saveClimbNote` succeeds but `deleteClimbNote` fails, show an error toast ("Send saved, but project could not be deleted — please delete it manually"). The send record is preserved; the project must be deleted manually by the user.

---

## 7. CSS Additions

New classes to add to `app/css/app.css`:

- `.table-header-row` — flex container for heading + action button
- `.btn-action` — the action button variant (`flex: 0 0 auto; padding: .45rem 1rem; font-size: .85rem`)
- `.btn-project` — purple button variant (`background: #7c3aed; border-color: #7c3aed`)
- `.style-tabs` — flex container for pill buttons
- `.style-tab` — individual pill (border, radius, cursor, font-weight)
- `.style-tab.active-rp/os/fl/pk` — per-style active colours

---

## 8. Files Changed

| File | Change |
|---|---|
| `app/css/app.css` | Add `.table-header-row`, `.btn-action`, `.btn-project`, `.style-tabs`, `.style-tab` + active variants |
| `app/index.html` | Replace `btn-add-climb` with `btn-log-send` + `btn-add-project`; replace climb overlay with Log Send overlay (style pills); add Project overlay |
| `app/js/ui.js` | `showAddSendOverlay()`, `showEditSendOverlay(climb)`, `showAddProjectOverlay()`, `showEditProjectOverlay(climb)`, `handleMarkAsSent(project)`, `bindSendOverlayHandlers()`, `bindProjectOverlayHandlers()`, update `setActiveView` for context-aware button |
| `app/js/mock.js` | Add `CD_attemptCount`, `CD_lastAttemptDate`, `CD_highPoint`, `CD_projectStatus` to 3 existing project entries in `MOCK_CLIMBS` |
| `app/js/climbs.js` | Map `CD_attemptCount`, `CD_lastAttemptDate`, `CD_highPoint`, `CD_projectStatus` in `fetchClimbs()` field mapping |

No new files. Training overlay unchanged.

---

## 9. Out of Scope

- Sorting/filtering projects by status
- Bulk-marking multiple projects as sent
- Project history / attempt log
- CloudKit schema migration tooling (additive fields are backward compatible automatically)
