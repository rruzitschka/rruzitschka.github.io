# Firebase Modular SDK Upgrade Reference

> Extracted from https://firebase.google.com/docs/web/modular-upgrade
> Latest SDK version at time of writing: **12.12.1**

## Two library types

| Type | Description | Size benefit |
|---|---|---|
| **Modular** | New API, function-based, enables tree-shaking | ✅ Up to 80% smaller |
| **Namespaced (compat)** | Old dot-chained API, backward compatible | ❌ None |

## Bundler requirement

> "Using a module bundler is **strongly recommended**. If you don't use one, you won't be able to take advantage of the modular API's main benefits in reduced app size."

Without a bundler you still get the **new APIs** (including `getCountFromServer`), just no tree-shaking size reduction. For a personal app on GitHub Pages this is acceptable.

## Compat from window (current approach — deprecated)

```html
<script src="https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.12.1/firebase-auth-compat.js"></script>
<script>
  const firebaseApp = firebase.initializeApp({ /* config */ });
  const db = firebaseApp.firestore();
  const auth = firebaseApp.auth();
</script>
```

> "This method is not recommended for long term use, but as a start to upgrade to the fully modular library."
> Compat libraries will be **removed in a future major version**.

## Recommended upgrade process (with bundler / npm)

1. `npm i firebase@12.12.1`
2. Change imports to compat: `import firebase from 'firebase/compat/app'`
3. Refactor one product at a time to modular style
4. Update initialization last
5. Remove all compat imports

## Key API changes: compat → modular

### Initialization

```js
// Before (compat)
import firebase from "firebase/compat/app";
firebase.initializeApp({ /* config */ });

// After (modular)
import { initializeApp } from "firebase/app";
const firebaseApp = initializeApp({ /* config */ });
```

### Auth

```js
// Before
const auth = firebase.auth();
auth.onAuthStateChanged(user => { ... });

// After
import { getAuth, onAuthStateChanged } from "firebase/auth";
const auth = getAuth(firebaseApp);
onAuthStateChanged(auth, user => { ... });
```

### Firestore queries

```js
// Before
const db = firebase.firestore();
db.collection("cities").where("capital", "==", true).get()
  .then(snapshot => snapshot.forEach(doc => console.log(doc.data())));

// After
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
const db = getFirestore(firebaseApp);
const q = query(collection(db, "cities"), where("capital", "==", true));
const snapshot = await getDocs(q);
snapshot.forEach(doc => console.log(doc.data()));
```

### snapshot.exists — BREAKING CHANGE

```js
// Before (property)
if (snapshot.exists) { ... }

// After (method)
if (snapshot.exists()) { ... }
```

### FieldValue

```js
// Before
firebase.firestore.FieldValue.serverTimestamp()
firebase.firestore.FieldValue.increment(1)

// After
import { serverTimestamp, increment } from "firebase/firestore";
serverTimestamp()
increment(1)
```

### Transactions

```js
// Before
db.runTransaction(async tx => { const snap = await tx.get(ref); tx.update(ref, {}); })

// After
import { runTransaction } from "firebase/firestore";
runTransaction(db, async tx => { const snap = await tx.get(ref); tx.update(ref, {}); })
```

### Count aggregation (new — not in compat)

```js
import { getCountFromServer, collection, query, where } from "firebase/firestore";

const snap = await getCountFromServer(collection(db, "routes"));
snap.data().count; // → 47

// With filter
const q = query(collection(db, "routes"), where("isOrphaned", "==", false));
const snap = await getCountFromServer(q);
```

### Collection group

```js
import { collectionGroup, getDocs } from "firebase/firestore";
const snap = await getDocs(collectionGroup(db, "apiKeys"));
```

### Offline persistence

```js
// Before
db.enablePersistence().catch(...)

// After
import { enableIndexedDbPersistence } from "firebase/firestore";
enableIndexedDbPersistence(db).catch(...)
```
