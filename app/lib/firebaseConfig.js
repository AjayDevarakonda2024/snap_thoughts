// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
    authDomain: "snap-thoughts-d1423.firebaseapp.com",
    databaseURL: "https://snap-thoughts-d1423-default-rtdb.firebaseio.com",
    projectId: "snap-thoughts-d1423",
    storageBucket: "snap-thoughts-d1423.firebasestorage.app",
    messagingSenderId: "736664268783",
    appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
    measurementId: "G-XYHPJ4PEPC"
};

const app = initializeApp(firebaseConfig);

const messaging = getMessaging(app);

export { messaging };
