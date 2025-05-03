// firebaseAdmin.js
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK with service account credentials
const serviceAccount = require('../config/firebase-credentials.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const messaging = admin.messaging();

export { messaging };
