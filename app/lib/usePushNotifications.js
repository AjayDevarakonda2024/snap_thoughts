// usePushNotifications.js
import { useEffect } from 'react';
import { messaging } from './firebaseConfig.js';
import { getToken, onMessage } from 'firebase/messaging';

const usePushNotifications = () => {
  useEffect(() => {
    // Request permission to send notifications
    const requestNotificationPermission = async () => {
      try {
        const token = await getToken(messaging, { vapidKey: 'BI5f46ABnF_Le6DnIvPc0Kjjcy1i9us8Y8ZmiaolXMXwdDm4FLGuK0ZFZ_1XDTV1qvE7EBw2i_UgVUpXQp4XuUE' });
        if (token) {
          console.log('FCM Token:', token);
          // Save token in your backend or wherever necessary
        } else {
          console.log('No registration token available.');
        }
      } catch (err) {
        console.error('Error getting token:', err);
      }
    };

    // Check if the user has granted permission
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        requestNotificationPermission();
      } else {
        console.log('Notification permission denied');
      }
    });

    // Listen for incoming messages when the app is in the foreground
    onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      alert('New Thought: ' + payload.notification.body); // Show notification or alert in the app
    });
  }, []);
};

export default usePushNotifications;
