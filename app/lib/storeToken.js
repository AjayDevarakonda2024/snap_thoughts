import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";  // Firestore initialized

// Store the token in Firestore or your backend
await setDoc(doc(db, "users", userId), {
  fcmToken: token,
}, { merge: true });
