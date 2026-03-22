// auth.js — User authentication module

async function initAuth() {
  try {
    const userIdentity = await container.setUpAuth();
    if (!userIdentity) {
      // Not signed in
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
      return null;
    }
    return userIdentity;
  } catch (err) {
    console.error('Auth error:', err);
    if (typeof showToast === 'function') {
      showToast('Authentication failed. Please try again.', 'error');
    }
    return null;
  }
}

async function signOut() {
  await container.signOut();
  window.location.href = 'login.html';
}

function getCurrentUser() {
  return container.userRecordName;
}
