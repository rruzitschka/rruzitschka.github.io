// firebase-api-keys.js — API key management against the Cloud Functions REST API
// Depends on: firebase-config.js (auth)

import { auth } from './firebase-config.js';

const API_KEYS_BASE = 'https://api-hoxktcdqvq-uc.a.run.app/v1/keys';

async function _apiKeysIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

export async function apiKeysCreate({ label, scopes }) {
  const token = await _apiKeysIdToken();
  const res = await fetch(API_KEYS_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ label, scopes }),
  });
  if (!res.ok) throw new Error(`Create key failed: ${res.status}`);
  return res.json(); // { id, key, label, scopes }
}

export async function apiKeysList() {
  const token = await _apiKeysIdToken();
  const res = await fetch(API_KEYS_BASE, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List keys failed: ${res.status}`);
  const body = await res.json();
  return body.data; // [{ id, label, scopes, createdAt, lastUsedAt }]
}

export async function apiKeysRevoke(keyId) {
  const token = await _apiKeysIdToken();
  const res = await fetch(`${API_KEYS_BASE}/${keyId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Revoke key failed: ${res.status}`);
}
