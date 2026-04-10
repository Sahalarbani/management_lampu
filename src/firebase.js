/*
  Version: 8.6.0 (Offline-First Edition)
  Date: 2026-04-10
  Changelog:
  - FEATURE: Enabled IndexedDB Persistence for true offline capability.
*/
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// NYALAKAN MESIN OFFLINE DATABASE
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, offline mode restricted to one tab.');
    } else if (err.code == 'unimplemented') {
        console.warn('Browser does not support offline mode.');
    }
});
// ... (kode atasnya biarin sama aja)

// Pastikan baris export config ini ADA di paling bawah:
export { firebaseConfig };
