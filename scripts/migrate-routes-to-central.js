/**
 * migrate-routes-to-central.js
 *
 * Migrates existing user climbNotes to the central routes/ collection.
 *
 * HOW TO RUN:
 *   1. Open the live web app (NOT mock mode) and sign in
 *   2. Open DevTools → Console
 *   3. Paste this entire script and press Enter
 *   4. Watch the output — it logs every route created and every note updated
 *   5. Run once per user account. Safe to re-run (uses name+crag dedup key,
 *      skips notes that already have centralRouteID).
 *
 * WHAT IT DOES:
 *   - Reads all climbNotes for the current user
 *   - Groups them by (route name + crag) to deduplicate
 *   - Creates one central routes/ document per unique route
 *   - Writes sendCount / projectCount / attemptCount from your actual data
 *   - Back-fills centralRouteID on every climbNote
 */

(async () => {
  // ── Grade normalization (mirrors firebase-routes.js) ──────────────────────
  const FRENCH = ['3b','3c','4a','4b','4c','5a','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c','9c+','10a','10b'];
  const YDS    = ['5.3','5.4','5.5','5.6','5.7','5.8','5.9','5.9+','5.10a','5.10a+','5.10b','5.10c','5.10d','5.11a','5.11b','5.11c','5.11d','5.12a','5.12b','5.12c','5.12d','5.13a','5.13b','5.13c','5.13d','5.14a','5.14b','5.14c','5.14d','5.15a','5.15b','5.15c','5.15d','5.16a','5.16b','5.16c'];
  const UIAA   = ['3','3+','4-','4','4+','5','6-','6-/6','6','6/6+','6+','7-','7','7+','8-','8','8+','9-','9','9+','10-','10','10+','11-','11','11+','12-','12','12+','13-','13','13+','14-','14','14+','15-'];
  const SYSTEMS = { French: FRENCH, YDS, UIAA };

  function detectSystem(grade) {
    if (!grade) return 'French';
    for (const [sys, arr] of Object.entries(SYSTEMS)) {
      if (arr.includes(grade)) return sys;
    }
    return 'French';
  }

  function normalizeToFrench(grade) {
    const sys = detectSystem(grade);
    if (sys === 'French') return grade || '';
    const idx = SYSTEMS[sys].indexOf(grade);
    if (idx === -1) return FRENCH[0];
    return FRENCH[Math.min(idx, FRENCH.length - 1)];
  }

  function foldedForSearch(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // ── Verify signed in ──────────────────────────────────────────────────────
  const user = auth.currentUser;
  if (!user) { console.error('❌ Not signed in. Sign in first, then re-run.'); return; }
  console.log(`✅ Signed in as ${user.email ?? user.uid}`);

  // ── Fetch all climbNotes ──────────────────────────────────────────────────
  console.log('📥 Fetching climbNotes…');
  const snap = await db.collection(`users/${user.uid}/climbNotes`).get();

  const notes = snap.docs
    .map(d => ({ _id: d.id, ...d.data() }))
    .filter(d => !d.deletedAt);

  console.log(`📋 Found ${notes.length} notes`);

  // ── Skip notes already linked ─────────────────────────────────────────────
  const unlinked = notes.filter(n => !n.centralRouteID);
  const alreadyLinked = notes.length - unlinked.length;
  if (alreadyLinked > 0) console.log(`⏭  Skipping ${alreadyLinked} notes already linked`);
  if (unlinked.length === 0) { console.log('🎉 All notes already linked — nothing to do!'); return; }

  // ── Group by (name + crag) key ────────────────────────────────────────────
  const groups = new Map(); // key → { notes[], routeName, crag, area, grade, routeType }
  for (const note of unlinked) {
    const name = (note.route ?? '').trim();
    if (!name) continue;
    const crag = (note.crag ?? '').trim();
    const key  = `${foldedForSearch(name)}||${foldedForSearch(crag)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        notes: [],
        name,
        crag,
        climbingArea: note.climbingArea ?? '',
        grade: note.difficulty ?? '',
        routeType: note.routeType ?? 'Sport',
      });
    }
    groups.get(key).notes.push(note);
  }

  console.log(`🗂  ${groups.size} unique routes to create`);

  // ── Create central routes + back-fill ────────────────────────────────────
  const now = firebase.firestore.FieldValue.serverTimestamp();
  let created = 0, updated = 0, errors = 0;

  for (const [, group] of groups) {
    const { name, crag, climbingArea, grade, routeType, notes: groupNotes } = group;

    // Count sends / projects / attempts
    const sendCount    = groupNotes.filter(n => n.sendType && n.sendType.toLowerCase() !== 'project').length;
    const projectCount = groupNotes.filter(n => n.sendType?.toLowerCase() === 'project' && n.projectStatus !== 'Abandoned').length;
    const attemptCount = groupNotes.reduce((sum, n) => sum + (n.attemptCount ?? 0), 0);

    // Pick the most common grade (prefer the grade of the first send)
    const canonicalGrade = grade || groupNotes[0]?.difficulty || '';
    const frenchGrade    = normalizeToFrench(canonicalGrade);
    const gradeSystem    = detectSystem(canonicalGrade);

    const routeID = db.collection('routes').doc().id;

    try {
      await db.collection('routes').doc(routeID).set({
        id:                 routeID,
        name,
        climbingArea:       climbingArea || '',
        crag:               crag || '',
        grade:              frenchGrade,
        createdGrade:       canonicalGrade,
        createdGradeSystem: gradeSystem,
        routeType:          routeType || 'Sport',
        length:             null,
        sendCount,
        projectCount,
        attemptCount,
        createdAt:          now,
        updatedAt:          now,
        createdBy:          user.uid,
        isOrphaned:         false,
        orphanedAt:         null,
        nameSearch:         foldedForSearch(name),
        cragSearch:         foldedForSearch(crag || ''),
      });
      created++;
      console.log(`  ✓ Created "${name}" (${crag || '—'}) → ${routeID}  [${sendCount} sends, ${projectCount} projecting]`);
    } catch (err) {
      errors++;
      console.error(`  ✗ Failed to create "${name}":`, err.message);
      continue;
    }

    // Back-fill centralRouteID on all notes in this group
    const batch = db.batch();
    for (const note of groupNotes) {
      batch.update(db.doc(`users/${user.uid}/climbNotes/${note._id}`), {
        centralRouteID: routeID,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    try {
      await batch.commit();
      updated += groupNotes.length;
    } catch (err) {
      errors++;
      console.error(`  ✗ Failed to back-fill notes for "${name}":`, err.message);
    }
  }

  console.log(`\n🏁 Done! Created ${created} routes, updated ${updated} notes, ${errors} errors.`);
  if (errors === 0) console.log('✅ Migration complete — reload the app to see linked routes.');
})();
