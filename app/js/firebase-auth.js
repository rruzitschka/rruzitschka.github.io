// firebase-auth.js — Firebase Auth (modular SDK)
// Exports: initAuth, signInWithApple, signOut, getCurrentUser, deleteAccount
// Depends on: firebase-config.js

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as _firebaseSignOut,
  OAuthProvider,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  writeBatch,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase-config.js';

export async function initAuth() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      if (user && !sessionStorage.getItem('_userDocEnsured')) {
        await _ensureUserDocument(user);
        sessionStorage.setItem('_userDocEnsured', '1');
      }
      resolve(user ?? null);
    });
  });
}

export async function signInWithApple() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  try {
    const result = await signInWithPopup(auth, provider);
    await _ensureUserDocument(result.user);
    return result.user;
  } catch (error) {
    console.error('Apple sign-in failed:', error);
    throw error;
  }
}

export async function signOut() {
  await _firebaseSignOut(auth);
  window.location.reload();
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('No signed-in user');

  await _deleteUserFirestoreData(user.uid);

  try {
    await user.delete();
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      // Re-authenticate with Apple then retry
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await signInWithPopup(auth, provider);
      await auth.currentUser.delete();
    } else {
      throw err;
    }
  }
}

// Ensure a users/{uid} document exists so admin getCountFromServer returns correct totals.
// Uses merge:true so it never clobbers existing fields written by iOS.
// registeredAt is only written on first creation (setDoc + merge leaves existing fields intact).
// NOTE: iOS should do an equivalent write on first sync to be counted here.
async function _ensureUserDocument(user) {
  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid:          user.uid,
      lastSeenWeb:  serverTimestamp(),
      // registeredAt only lands on the very first write; merge:true leaves it alone after that
      registeredAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('ensureUserDocument failed (non-fatal):', err.code ?? err);
  }
}

async function _deleteUserFirestoreData(uid) {
  // Delete all climbNotes and their subcollections (ascents, photos)
  const climbNotesSnap = await getDocs(collection(db, `users/${uid}/climbNotes`));
  for (const noteDoc of climbNotesSnap.docs) {
    const notePath = `users/${uid}/climbNotes/${noteDoc.id}`;
    const [ascentsSnap, photosSnap] = await Promise.all([
      getDocs(collection(db, `${notePath}/ascents`)),
      getDocs(collection(db, `${notePath}/photos`)),
    ]);
    const batch = writeBatch(db);
    ascentsSnap.docs.forEach(d => batch.delete(d.ref));
    photosSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(noteDoc.ref);
    await batch.commit();
  }

  // Delete all training sessions
  const sessionsSnap = await getDocs(collection(db, `users/${uid}/trainingSessions`));
  if (!sessionsSnap.empty) {
    const batch = writeBatch(db);
    sessionsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // Delete the user document itself
  await deleteDoc(doc(db, `users/${uid}`)).catch(() => {});
}
