/**
 * Firebase Configuration (Landing - Read Only)
 *
 * Minimal Firebase init for reading showcase videos from Firestore.
 * No auth, no storage, no realtime database.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  projectId: "the-kinetic-alphabet",
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  messagingSenderId: "664225703033",
  appId: "1:664225703033:web:62e6c1eebe4fff3ef760a8",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    const existing = getApps();
    app = existing.length > 0 ? (existing[0] as FirebaseApp) : initializeApp(firebaseConfig, "tka-landing");
  }
  return app as FirebaseApp;
}

export function getFirestoreInstance(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}
