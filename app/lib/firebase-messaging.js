// firebase-messaging.js
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./firebase";

const messaging = getMessaging(app);

// Request Notification Permission
export async function requestPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const token = await getToken(messaging, {
      vapidKey: "BI5f46ABnF_Le6DnIvPc0Kjjcy1i9us8Y8ZmiaolXMXwdDm4FLGuK0ZFZ_1XDTV1qvE7EBw2i_UgVUpXQp4XuUE",
    });
    console.log("User notification token:", token);
    // You can now send this token to your server to store it for sending notifications later
    return token;
  } else {
    console.warn("Notification permission denied");
    return null;
  }
}

// Handle foreground messages (app is in focus)
onMessage(messaging, (payload) => {
  console.log("Notification received in foreground:", payload);
  // Handle the notification here, show it in the UI or something
});
