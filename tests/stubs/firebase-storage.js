// tests/stubs/firebase-storage.js — no-op stub for the `firebase/storage`
// module in unit tests. The real module comes from the gstatic CDN import
// map (index.html) and is not installed as a package; tests that exercise
// code paths importing firebase-climbs.js need this to resolve. Per-test
// mocks of "firebase/firestore" keep working alongside this alias.
export const ref = () => ({});
export const uploadBytes = async () => ({});
export const getDownloadURL = async () => "";
export const deleteObject = async () => {};
