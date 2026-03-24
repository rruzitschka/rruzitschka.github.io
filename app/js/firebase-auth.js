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
