# ARCHITECTURE — SendLog Web App

## Layering

```
landing/index.html, pages/          static marketing/docs (no JS logic)
        ┌──────────────────────────┐
ui.js / admin.js / stats.js  (views, DOM)
        │ uses
route-line-ui.js … (DOM helpers)     route-entries.js, send-style.js (pure rules)
        │ calls
firebase-*.js (service modules)      ← the only modules that import firebase/*
        │
Firestore / Auth / Storage / REST v1 (Cloud Functions, iOS repo)
```

Rules:

- **Only `firebase-*.js` touch Firestore.** Pure modules (`route-entries.js`,
  `send-style.js`, `iso-countries.js`) must stay Firestore-free and DOM-free.
- **DOM helpers must stay stateless** (no module-level mutable state); they
  take ids/arguments, like `route-link-ui.js`.
- View modules own DOM access and service calls; business rules belong in
  pure modules so they are unit-testable.

## Service binding + mock mode

`ui.js` holds every service call in mutable `let` bindings. `setMockServices()`
(registered in `SERVICE_MOCK_SETTERS`) swaps them. With `?mock=true`,
`index.html` dynamically imports `app/js/mock.js` (in-memory data, fake auth)
— used for UI testing without touching real data. Keep mock.js in sync when
service signatures change.

## iOS parity contract

The web app is the companion of the iOS app (Core Data offline-first, optional
Firebase sync). Data written here is read by iOS and vice versa:

- Wire formats must match iOS **byte-for-byte** where iOS defines them
  (e.g. `routes` JSON on gym sessions, see `route-entries.js`).
- Display vocabularies that iOS stores lowercase (send types, project status)
  are canonicalized on write and normalized for display (`send-style.js`).
- Gym feature (iOS 4.0): sessions carry `gym` + `routes`; climb notes carry
  `sessionID`; `crag` holds the gym name on gym-typed notes.

## Central route DB gate (ADR 0005)

`routes/` is the shared cross-repo route database. Gym-typed notes
(`routeType` Gym / Gym Boulder) are **hard-gated** from it: no central route
creation, no soft links, no rating or counter writes. Enforced in the send
save path (`ui.js`) — see CONVENTIONS.
