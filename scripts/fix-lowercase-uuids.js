/**
 * fix-lowercase-uuids.js
 *
 * Fixes climbNote documents that have lowercase UUID document IDs (created by
 * the web app bug where crypto.randomUUID() produced lowercase, incompatible
 * with iOS which uses uppercase UUIDs).
 *
 * HOW TO RUN:
 *   1. Open the live web app (NOT mock mode) and sign in
 *   2. Open DevTools → Console
 *   3. Paste this entire script and press Enter
 *   4. Confirm the list looks correct before it writes anything
 *
 * WHAT IT DOES:
 *   - Finds all climbNotes whose document ID is a lowercase UUID
 *   - For each: copies the document to a new UPPERCASE UUID document
 *   - Marks the old lowercase document as deleted (soft-delete)
 *
 * SAFE TO RE-RUN: skips docs where uppercase version already exists.
 */

(async () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  const user = auth.currentUser;
  if (!user) { console.error('❌ Not signed in.'); return; }
  console.log(`✅ Signed in as ${user.email ?? user.uid}`);

  const snap = await db.collection(`users/${user.uid}/climbNotes`).get();
  const toFix = snap.docs.filter(d => UUID_RE.test(d.id) && !d.data().deletedAt);

  if (toFix.length === 0) {
    console.log('🎉 No lowercase UUID documents found — nothing to fix!');
    return;
  }

  console.log(`🔍 Found ${toFix.length} document(s) with lowercase UUID IDs:`);
  toFix.forEach(d => console.log(`  - ${d.id} | ${d.data().route} | ${d.data().sendType}`));
  console.log('');
  console.log('▶️  Starting fix…');

  const now = firebase.firestore.FieldValue.serverTimestamp();
  let fixed = 0, skipped = 0, errors = 0;

  for (const doc of toFix) {
    const uppercaseId = doc.id.toUpperCase();
    const upperRef = db.doc(`users/${user.uid}/climbNotes/${uppercaseId}`);
    const lowerRef = db.doc(`users/${user.uid}/climbNotes/${doc.id}`);

    // Check if uppercase version already exists
    const existing = await upperRef.get();
    if (existing.exists && !existing.data().deletedAt) {
      console.log(`  ⏭  ${doc.id} → uppercase already exists and is active, skipping`);
      skipped++;
      continue;
    }

    try {
      const data = { ...doc.data(), updatedAt: now };
      // Write uppercase copy
      await upperRef.set(data, { merge: true });
      // Soft-delete the lowercase original
      await lowerRef.update({ deletedAt: now, updatedAt: now });
      console.log(`  ✓ ${doc.id} → ${uppercaseId}  (${doc.data().route})`);
      fixed++;
    } catch (err) {
      console.error(`  ✗ Failed for ${doc.id}:`, err.message);
      errors++;
    }
  }

  console.log(`\n🏁 Done! Fixed: ${fixed}, Skipped: ${skipped}, Errors: ${errors}`);
  if (errors === 0 && fixed > 0) {
    console.log('✅ Reload the iOS app or force a sync to see the fixed notes.');
  }
})();
