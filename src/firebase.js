import { initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyswlJTIm4NuhnAv8dNG8ij6zq0L8FmcU",
  authDomain: "txtfileviewer.firebaseapp.com",
  projectId: "txtfileviewer",
  storageBucket: "txtfileviewer.firebasestorage.app",
  messagingSenderId: "185707122313",
  appId: "1:185707122313:web:45b14964453e8139cb8058",
  measurementId: "G-ELZ4NBL705",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const notesCollection = collection(db, "notes");

export {
  db,
  notesCollection,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
};
