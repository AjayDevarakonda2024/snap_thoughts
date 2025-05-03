// api/notifications.js (or in your backend route)
import { messaging } from '../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { userFcmToken, thought } = req.body; // Get the token and thought data from request

    try {
      const message = {
        notification: {
          title: 'New Thought Posted',
          body: thought,
        },
        token: userFcmToken, // User's FCM token to send the message to
      };

      await messaging.send(message);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
}
