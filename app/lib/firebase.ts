// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    updateDoc,
    doc,
    deleteDoc,
    getDoc,
    setDoc,
    Timestamp,
  } from "firebase/firestore";

// Your Firebase config here (from Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
    authDomain: "snap-thoughts-d1423.firebaseapp.com",
    projectId: "snap-thoughts-d1423",
    storageBucket: "snap-thoughts-d1423.firebasestorage.app",
    messagingSenderId: "736664268783",
    appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
    measurementId: "G-XYHPJ4PEPC",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getDatabase(app);

export { db };
