// firebase-auth.js — Firebase Auth replacing CloudKit auth
// Exposes: initAuth(), signInWithApple(), signOut(), getCurrentUser()
// Depends on: firebase-config.js (sets window.auth, window.db, window.storage)

async function initAuth() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(user => resolve(user ?? null));
  });
}

async function signInWithApple() {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  try {
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error) {
    console.error('Apple sign-in failed:', error);
    throw error;
  }
}

async function signOut() {
  await auth.signOut();
  window.location.reload();
}

function getCurrentUser() {
  return auth.currentUser;
}

async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('No signed-in user');

  // Delete all Firestore data before removing the auth user
  await deleteUserFirestoreData(user.uid);

  try {
    await user.delete();
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      // Re-authenticate with Apple then retry
      const provider = new firebase.auth.OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await auth.signInWithPopup(provider);
      await auth.currentUser.delete();
    } else {
      throw err;
    }
  }
}

async function deleteUserFirestoreData(uid) {
  // Delete all climbNotes and their subcollections (ascents, photos)
  const climbNotesSnap = await db.collection(`users/${uid}/climbNotes`).get();
  for (const noteDoc of climbNotesSnap.docs) {
    const notePath = `users/${uid}/climbNotes/${noteDoc.id}`;
    const [ascentsSnap, photosSnap] = await Promise.all([
      db.collection(`${notePath}/ascents`).get(),
      db.collection(`${notePath}/photos`).get()
    ]);
    const batch = db.batch();
    ascentsSnap.docs.forEach(d => batch.delete(d.ref));
    photosSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(noteDoc.ref);
    await batch.commit();
  }

  // Delete all training sessions
  const sessionsSnap = await db.collection(`users/${uid}/trainingSessions`).get();
  if (!sessionsSnap.empty) {
    const batch = db.batch();
    sessionsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // Delete the user document itself
  await db.doc(`users/${uid}`).delete().catch(() => {});
}
