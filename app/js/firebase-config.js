// firebase-config.js — git-ignored, recreate from Firebase Console
import { initializeApp }                              from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence }  from 'firebase/firestore';
import { getAuth }                                   from 'firebase/auth';
import { getStorage }                                from 'firebase/storage';

const firebaseConfig = {
  apiKey:            "AIzaSyAQ6fuI0zcoGKh1eddgkBOOKA-4Ms_7F_I",
  authDomain:        "climbingnotes-a06e3.firebaseapp.com",
  projectId:         "climbingnotes-a06e3",
  storageBucket:     "climbingnotes-a06e3.firebasestorage.app",
  messagingSenderId: "50977020077",
  appId:             "1:50977020077:web:9a7dfa7dd5d298bf054e24"
};

export const app     = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

enableIndexedDbPersistence(db).catch(err =>
  console.warn('Offline persistence unavailable:', err)
);
