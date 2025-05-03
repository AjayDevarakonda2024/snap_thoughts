import { useEffect } from 'react';
import usePushNotifications from '../lib/usePushNotifications';
import NotificationPrompt from './components/NotificationPrompt.js';

function MyApp({ Component, pageProps }) {
  const { getToken } = usePushNotifications();

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration);
        })
        .catch((err) => {
          console.error('❌ Service Worker registration failed:', err);
        });
    }
  }, []);

  const handlePermissionGranted = async () => {
    const token = await getToken();
    console.log('✅ FCM Token:', token);
    // 🔁 Send this token to your backend to subscribe this user
  };

  return (
    <>
      <Component {...pageProps} />
      <NotificationPrompt onPermissionGranted={handlePermissionGranted} />
    </>
  );
}

export default MyApp;
