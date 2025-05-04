// lib/firebase.js
import firebase from "firebase/app";
import "firebase/messaging";

// Firebase config (use your config from Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
    authDomain: "snap-thoughts-d1423.firebaseapp.com",
    databaseURL: "https://snap-thoughts-d1423-default-rtdb.firebaseio.com",
    projectId: "snap-thoughts-d1423",
    storageBucket: "snap-thoughts-d1423.firebasestorage.app",
    messagingSenderId: "736664268783",
    appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
    measurementId: "G-XYHPJ4PEPC",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

const messaging = firebase.messaging();

export { messaging };
