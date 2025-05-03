// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
    apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
    authDomain: "snap-thoughts-d1423.firebaseapp.com",
    databaseURL: "https://snap-thoughts-d1423-default-rtdb.firebaseio.com",
    projectId: "snap-thoughts-d1423",
    storageBucket: "snap-thoughts-d1423.firebasestorage.app",
    messagingSenderId: "736664268783",
    appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
    measurementId: "G-XYHPJ4PEPC"
});

// Initialize messaging
const messaging = firebase.messaging();

// Background handler
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const { title, body } = payload.notification;

  const notificationOptions = {
    body,
    icon: '/icon-192x192.png', // Add an icon if you want
  };

  self.registration.showNotification(title, notificationOptions);
});
