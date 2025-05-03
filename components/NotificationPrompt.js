import { useState, useEffect } from 'react';

const NotificationPrompt = ({ onPermissionGranted }) => {
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      onPermissionGranted();
    }
  };

  if (permission === 'granted') return null;

  return (
    <div style={styles.container}>
      <p>🔔 Enable notifications to get updates when someone posts a thought!</p>
      <button onClick={requestPermission} style={styles.button}>
        Allow Notifications
      </button>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    background: '#fff',
    padding: '12px 20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    borderRadius: 8,
    zIndex: 1000,
  },
  button: {
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    marginTop: 8,
  },
};

export default NotificationPrompt;
