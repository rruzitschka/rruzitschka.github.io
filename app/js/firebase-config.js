// firebase-config.js — git-ignored, recreate from Firebase Console
firebase.initializeApp({
  apiKey: "AIzaSyAQ6fuI0zcoGKh1eddgkBOOKA-4Ms_7F_I",
  authDomain: "climbingnotes-a06e3.firebaseapp.com",
  projectId: "climbingnotes-a06e3",
  storageBucket: "climbingnotes-a06e3.firebasestorage.app",
  messagingSenderId: "50977020077",
  appId: "1:50977020077:web:9a7dfa7dd5d298bf054e24"
});

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

db.enablePersistence().catch(err => console.warn('Offline persistence unavailable:', err));
