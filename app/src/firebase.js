import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  enableNetwork,
  disableNetwork,
  CACHE_SIZE_UNLIMITED,
} from "firebase/firestore";

// ── Firebase configuration ─────────────────────────────────────────────────
// EXPO_PUBLIC_* vars are inlined at build time by Expo/Metro for both
// local dev (from .env) and EAS cloud builds (from eas.json > env block).
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// ── Firestore with Android-safe networking settings ───────────────────────
// experimentalForceLongPolling: true  → avoids WebSocket failures on Android
// ignoreUndefinedProperties: true    → prevents errors from undefined fields
// cacheSizeBytes: UNLIMITED           → aggressive offline cache so notes
//                                       remain readable even without network
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});

const notesCollection = collection(db, "notes");

// ── Network helper ────────────────────────────────────────────────────────
// Call this to force-reconnect Firestore after a network drop.
// Useful to pair with AppState change listeners.
const reconnectFirestore = async () => {
  try {
    await disableNetwork(db);
    await enableNetwork(db);
  } catch (_) {
    // Ignore — Firestore will retry automatically
  }
};

export {
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  notesCollection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  reconnectFirestore,
};
