import { useEffect } from "react";
import { messaging } from ".../lib/firebase.js";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Request permission to show notifications
    const requestPermission = async () => {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("Notification permission granted.");
        // Get FCM token and send it to the backend
        messaging
          .getToken()
          .then((token) => {
            console.log("FCM Token:", token);
            // Send this token to your server to store
          })
          .catch((error) => {
            console.log("Error getting FCM token:", error);
          });
      } else {
        console.log("Notification permission denied.");
      }
    };

    requestPermission();
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
