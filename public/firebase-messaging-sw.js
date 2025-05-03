// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
    authDomain: "snap-thoughts-d1423.firebaseapp.com",
    projectId: "snap-thoughts-d1423",
    storageBucket: "snap-thoughts-d1423.firebasestorage.app",
    messagingSenderId: "736664268783",
    appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
    measurementId: "G-XYHPJ4PEPC",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log("Received background message: ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/logo.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
