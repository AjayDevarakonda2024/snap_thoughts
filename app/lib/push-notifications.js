const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccount.json")),
});

// Function to send a push notification
async function sendNotification(token, message) {
  const payload = {
    notification: {
      title: message.title,
      body: message.body,
    },
  };

  try {
    await admin.messaging().sendToDevice(token, payload);
    console.log("Notification sent successfully");
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// Example: Sending notification after a thought is posted
sendNotification(userFcmToken, {
  title: "New Thought Posted!",
  body: "Check out a thought you might like!",
});
