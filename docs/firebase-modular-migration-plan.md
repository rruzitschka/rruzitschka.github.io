# Firebase Modular SDK Migration Plan

> **Reference:** `docs/firebase-modular-upgrade-reference.md`
> **SDK version:** 10.12.2 compat → 12.12.1 modular
> **Trigger:** `db.collection(...).count is not a function` — `getCountFromServer()` does not exist in the compat SDK; modular SDK required.

---

## Approach: CDN ES Modules, no bundler

The Firebase docs recommend a bundler (Vite/webpack) for tree-shaking. However, this app:
- Has no build step and is served as static files from GitHub Pages
- Is a personal tool where 80% size reduction is not a priority
- Must remain deployable via `git push` only

**Decision:** Use Firebase modular SDK loaded via CDN ES module URLs, with native browser `<script type="module">`. No npm, no bundler, no build step. All JS files become ES modules with explicit `import`/`export`.

This gives us:
- `getCountFromServer()` and all new modular APIs ✅
- No bundler or CI pipeline needed ✅
- GitHub Pages compatible ✅
- No tree-shaking (acceptable for this use case) ⚠️

---

## Scope

| File | Firebase SDK calls | Changes needed |
|---|---|---|
| `firebase-config.js` | `initializeApp`, `getFirestore`, `getAuth`, `getStorage` | Full rewrite — exports `app`, `db`, `auth`, `storage` |
| `firebase-auth.js` | `onAuthStateChanged`, `signInWithPopup`, `signOut`, `OAuthProvider` | Rewrite to modular auth functions |
| `firebase-climbs.js` | `collection`, `doc`, `getDocs`, `setDoc`, `updateDoc`, `deleteDoc`, `query`, `orderBy`, `where`, `serverTimestamp`, `Timestamp`, `increment` | Rewrite all Firestore calls |
| `firebase-training.js` | Same Firestore patterns as climbs | Rewrite all Firestore calls |
| `firebase-routes.js` | All of the above + `runTransaction`, `getCountFromServer`, `collectionGroup` | Rewrite + unlocks `getCountFromServer` |
| `firebase-api-keys.js` | None (REST only) | No changes |
| `admin.js` | `getCountFromServer`, `collectionGroup`, `getDocs` | Minor — already uses modular-style function calls |
| `ui.js` | No direct Firebase calls | No SDK changes; needs `import` of functions from other modules |
| `grades.js` | None | Stay as regular `<script>` (no exports needed) |
| `stats.js` | None | Stay as regular `<script>` (no exports needed) |
| `mock.js` | None (overrides window globals) | Needs rethink — see Task 8 |
| `index.html` | CDN script tags | Replace compat CDN with modular CDN; convert app scripts to `type="module"` |

---

## Key API mapping

| Compat (current) | Modular (target) |
|---|---|
| `firebase.initializeApp(config)` | `initializeApp(config)` from `firebase/app` |
| `firebase.firestore()` | `getFirestore(app)` from `firebase/firestore` |
| `firebase.auth()` | `getAuth(app)` from `firebase/auth` |
| `firebase.storage()` | `getStorage(app)` from `firebase/storage` |
| `db.collection('x')` | `collection(db, 'x')` |
| `db.doc('x/y')` | `doc(db, 'x/y')` |
| `db.collectionGroup('x')` | `collectionGroup(db, 'x')` |
| `ref.get()` | `getDoc(ref)` / `getDocs(query)` |
| `ref.set(data, opts)` | `setDoc(ref, data, opts)` |
| `ref.update(data)` | `updateDoc(ref, data)` |
| `ref.delete()` | `deleteDoc(ref)` |
| `db.runTransaction(fn)` | `runTransaction(db, fn)` |
| `db.collection('x').where(...)` | `query(collection(db,'x'), where(...))` |
| `db.collection('x').orderBy(...).limit(n)` | `query(collection(db,'x'), orderBy(...), limit(n))` |
| `db.collection('x').count().get()` | `getCountFromServer(collection(db,'x'))` → `.data().count` |
| `firebase.firestore.FieldValue.serverTimestamp()` | `serverTimestamp()` |
| `firebase.firestore.FieldValue.increment(n)` | `increment(n)` |
| `firebase.firestore.Timestamp.fromDate(d)` | `Timestamp.fromDate(d)` (same class, direct import) |
| `snapshot.exists` *(property)* | `snapshot.exists()` *(method — BREAKING)* |
| `auth.onAuthStateChanged(fn)` | `onAuthStateChanged(auth, fn)` |
| `auth.signInWithPopup(provider)` | `signInWithPopup(auth, provider)` |
| `auth.signOut()` | `signOut(auth)` |
| `new firebase.auth.OAuthProvider('apple.com')` | `new OAuthProvider('apple.com')` from `firebase/auth` |
| `db.enablePersistence()` | `enableIndexedDbPersistence(db)` |

---

## Task 1 — Update `index.html` CDN and script tags

**Replace** the four compat CDN `<script>` tags with a single `<script type="importmap">` that maps Firebase module specifiers to the 12.12.1 CDN URLs, then convert all app `<script src="...">` tags to `<script type="module" src="...">`.

The import map covers:
- `firebase/app`
- `firebase/auth`
- `firebase/firestore`
- `firebase/storage`

`grades.js`, `stats.js`, and `chart.js` remain as regular `<script>` tags (no imports/exports needed) and must be loaded **before** the first `type="module"` script.

`mock.js` is handled separately (Task 8).

---

## Task 2 — Rewrite `firebase-config.js`

```js
import { initializeApp }           from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth }                 from 'firebase/auth';
import { getStorage }              from 'firebase/storage';

const firebaseConfig = { /* same config object */ };

export const app     = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

enableIndexedDbPersistence(db).catch(err =>
  console.warn('Offline persistence unavailable:', err)
);
```

All other files import `{ db, auth, storage }` from `'./firebase-config.js'`.

---

## Task 3 — Rewrite `firebase-auth.js`

Import modular auth functions. Export `initAuth`, `signInWithApple`, `signOut`, `getCurrentUser`, `deleteAccount`.

Key changes:
- `auth.onAuthStateChanged(fn)` → `onAuthStateChanged(auth, fn)`
- `auth.signInWithPopup(p)` → `signInWithPopup(auth, p)`
- `auth.signOut()` → `signOut(auth)`
- `new firebase.auth.OAuthProvider(...)` → `new OAuthProvider(...)`

---

## Task 4 — Rewrite `firebase-climbs.js`

Import `{ db }` from config. Replace all chained Firestore calls with modular equivalents.

Key patterns:
- `db.collection(...).orderBy(...).get()` → `getDocs(query(collection(db,...), orderBy(...)))`
- `db.doc(...).set(data, { merge: true })` → `setDoc(doc(db,...), data, { merge: true })`
- `db.doc(...).update({...})` → `updateDoc(doc(db,...), {...})`
- `firebase.firestore.Timestamp.fromDate(d)` → `Timestamp.fromDate(d)`
- `firebase.firestore.FieldValue.serverTimestamp()` → `serverTimestamp()`
- `snapshot.exists` → `snapshot.exists()` (**breaking change**)

Export all public functions.

---

## Task 5 — Rewrite `firebase-training.js`

Same patterns as Task 4. Export all public functions.

---

## Task 6 — Rewrite `firebase-routes.js`

Same patterns as Tasks 4–5, plus:
- `db.runTransaction(fn)` → `runTransaction(db, fn)`
- `db.collection('routes').count().get()` → `getCountFromServer(collection(db,'routes'))` → `.data().count`
- `db.collectionGroup('apiKeys')` → `collectionGroup(db, 'apiKeys')`

This is the file that unblocks the admin stats feature.

Export all public functions.

---

## Task 7 — Update `ui.js` and `admin.js`

Both files need `import` statements at the top for every function they call from firebase-*.js modules. No Firebase SDK calls in these files directly, so no API rewrites — only import wiring.

`admin.js` additionally imports `getCountFromServer`, `collection`, `query`, `where`, `collectionGroup`, `getDocs` directly from `firebase/firestore` for the stats panel.

---

## Task 8 — Update `mock.js`

`mock.js` currently overrides `window.*` globals set by the compat SDK. With ES modules, `window.fetchClimbs` etc. no longer exist.

**Approach:** Convert mock.js to a module that exports the same function signatures as firebase-climbs.js, firebase-auth.js etc. The app shell (`index.html`) checks for `?mock=true` and dynamically imports the mock module instead of the real ones.

This is the most architecturally different task and can be done last since mock mode is dev-only.

---

## Task 9 — Bump version, test, deploy

- Remove all compat CDN references
- Bump asset version string
- Commit and push

---

## Risks and notes

| Risk | Mitigation |
|---|---|
| `snapshot.exists` → `snapshot.exists()` breaking change | Grep all files for `.exists` before deploying |
| `firebase-config.js` is git-ignored | Rewrite template must be documented; developer recreates from Firebase Console |
| Import map browser support | Chrome 89+, Firefox 108+, Safari 16.4+ — all modern browsers supported |
| `mock.js` window-override pattern breaks | Defer mock.js to last task; mock mode is dev-only |
| `enableIndexedDbPersistence` deprecated in favour of `initializeFirestore` with `persistentLocalCache` | Fine to use for now; can upgrade in a follow-on |
