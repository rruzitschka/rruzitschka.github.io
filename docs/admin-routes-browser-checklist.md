# Manual checklist — Admin Routes Browser

Run against **live Firestore** (`climbingnotes-a06e3`) as a signed-in admin.
Serves with `node serve.cjs` (or the usual local server). All steps happen in
the Admin Panel → **Routes** tab unless stated otherwise.

Prereq: the 21 composite indexes from `firestore.indexes.json` are deployed
(done 2026-02) and built — if a query errors with a "requires an index" link,
the matching index is still building; retry later.

## 0. One-time backfill

- [ ] Statistics tab → Maintenance → **Backfill areaSearch**: run once; status
      shows `✓ Done — scanned N, updated M`.
- [ ] Re-run immediately: updates must be **0** (idempotent).

## 1. Browse-all (no filters)

- [ ] Routes tab opens directly on the paginated list (no "type 2 characters"
      gate anymore).
- [ ] Count label shows the route total (matches Statistics tab's
      "Community Routes").
- [ ] Rows sorted by name A–Z, case/accent-insensitive ("café" between "Caba"
      and "Cedar", not at the end).
- [ ] 25 rows per page; **Next →** pages forward 1→2→3; **← Previous** back;
      buttons disable at the ends.
- [ ] Page footer "Page X of N" is consistent with the count.

## 2. Filters (each alone, then combos)

- [ ] Type: All / Sport / Boulder / Multi-Pitch / Trad — each returns only
      matching rows; count updates.
- [ ] Country dropdown lists ISO codes with flag emoji; picking one filters
      server-side.
- [ ] Orphaned only → only orphaned routes, orange accent + badge.
- [ ] Combos: orphaned + type, orphaned + country, type + country, all three —
      each paginates correctly (Next/Previous across a page boundary).
- [ ] Filter changes reset to page 1.

## 3. Search

- [ ] Name prefix ("bürc" finds "Bürklesteig" — folded match), crag prefix,
      area prefix with Field: Any.
- [ ] Field: Name / Crag / Area each give a single clean stream; pagination
      works.
- [ ] Diacritics: typing "cafe" finds "Café".
- [ ] Search + filter combined (e.g. area search + orphaned checkbox) paginates.
- [ ] 1-character search works (admin browser has no 2-char minimum).
- [ ] Nonsense term → empty state "No routes match your filters."

## 4. List → edit → back

- [ ] Click a row → existing edit form opens (map, save, delete unchanged).
- [ ] Change a filter/page, open a route, press ← Back:
      filter values, page, and scroll position are restored.
- [ ] Save an edit from the form, go back: the row shows updated data after the
      list re-fetches.

## 5. Row content

- [ ] Orphaned rows: orange background + badge.
- [ ] GPS-backed rows show 📍 next to the name.
- [ ] Country shown with flag emoji; routes without country show "—".
- [ ] Type chip colors differ per type; grade matches the user's preferred
      grade system setting.

## 6. Error states

- [ ] (Optional, sim-net offline) load failure → red message + **Retry**
      button works.

## 7. Batch country assignment

Setup: pick an area search that returns a mix of GPS-backed and GPS-less
routes (e.g. an area where GPS came from reverse geocoding for some docs).

- [ ] Button "Apply country to results…" is **disabled** on browse-all (no
      filters) and enabled once any filter/search is active.
- [ ] Click it: scan progress appears, then the dialog shows
      "Apply country to N routes? (M GPS-backed routes will be skipped.)"
      with correct numbers (spot-check M against rows with 📍).
- [ ] Cancel closes the dialog and nothing is written (check Firestore).
- [ ] Country select requires a choice; Apply without selection shows the
      inline error.
- [ ] With "Only fill routes without a country" ON (default): confirm; summary
      reads `Updated N routes · skipped M already set · skipped K GPS-backed`;
      only GPS-less, country-less docs got the country.
- [ ] **GPS-backed routes untouched**: every skipped 📍 route still has its
      original country, latitude, longitude.
- [ ] Toggle OFF: warning line appears ("…overwrite existing country values on
      N routes without GPS…"); confirm; previously-set GPS-less docs are now
      overwritten with the new country.
- [ ] Edit one affected route from the edit form: `recentEdits` history
      contains the `admin country batch update` entries.
- [ ] No GPS field was ever modified by any batch (verify 2–3 docs in
      console).

## 8. Regression

- [ ] App-side route picker (SendLogs page search) still works — old
      `searchRoutes` path untouched.
- [ ] `npm run lint` → 0 errors; `npm test` → all green.
