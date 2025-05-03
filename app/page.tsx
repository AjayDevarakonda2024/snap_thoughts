"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
  authDomain: "snap-thoughts-d1423.firebaseapp.com",
  databaseURL: "https://snap-thoughts-d1423-default-rtdb.firebaseio.com",
  projectId: "snap-thoughts-d1423",
  storageBucket: "snap-thoughts-d1423.appspot.com",
  messagingSenderId: "736664268783",
  appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
  measurementId: "G-XYHPJ4PEPC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Types ---
interface User {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  uid: string;
  nickname?: string; // Add nickname field to User type
}

interface Thought {
  id: string;
  text: string;
  likes: number;
  likedBy: string[];
  userId: string;
  nickname?: string; // 👈 add this line
  createdAt: Timestamp;
}

// --- Main Component ---
export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [thought, setThought] = useState("");
  const [feed, setFeed] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState<string>(""); // State for nickname

  // Login with Google
  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
  
      if (!userDoc.exists()) {
        // Save user data without profile picture
        await setDoc(userRef, {
          email: currentUser.email,
          displayName: currentUser.displayName,
        });
      }
  
      // Always fetch latest user info from Firestore
      const latestUserDoc = await getDoc(userRef);
      const data = latestUserDoc.data();
      setUser({ ...currentUser, nickname: data?.nickname || "" });
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please try again.");
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    }
  };

  // Save nickname to Firestore
  const saveNickname = async () => {
    if (nickname.trim() === "") return alert("Please enter a valid nickname.");
    if (!user) return alert("Please login to set a nickname.");
    
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { nickname });
      setUser((prev) => ({ ...prev!, nickname }));
    } catch (error) {
      console.error("Failed to save nickname", error);
      alert("Failed to save nickname. Try again.");
    }
  };

  // Post a thought
  const postThought = async () => {
    if (thought.trim() === "") return alert("Please enter some text.");
    if (!user) return alert("Please login to post a thought.");

    try {
      await addDoc(collection(db, "thoughts"), {
        text: thought,
        likes: 0,
        likedBy: [],
        userId: user.uid,
        nickname: user.nickname || user.displayName || "Anonymous",
        createdAt: Date.now(),
      });
      setThought("");  // Clear input after posting
    } catch (error) {
      console.error("Post thought failed", error);
      alert("Failed to post thought. Try again.");
    }
  };

  // Like a thought
  const likeThought = async (id: string, likedBy: string[], currentLikes: number) => {
    if (!user) return alert("Please login first.");
    const thoughtRef = doc(db, "thoughts", id);
  
    const alreadyLiked = likedBy.includes(user.uid);
    const updatedLikes = alreadyLiked ? currentLikes - 1 : currentLikes + 1;
    const updatedLikedBy = alreadyLiked
      ? likedBy.filter(uid => uid !== user.uid)
      : [...likedBy, user.uid];
  
    try {
      await updateDoc(thoughtRef, {
        likes: updatedLikes,
        likedBy: updatedLikedBy,
      });
    } catch (error) {
      console.error("Failed to update like", error);
    }
  };

  // Delete a thought
  const deleteThought = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this thought?")) {
      try {
        const thoughtRef = doc(db, "thoughts", id);
        await deleteDoc(thoughtRef);
        alert("Thought deleted!");
      } catch (error) {
        console.error("Delete failed", error);
        alert("Failed to delete thought. Try again.");
      }
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUser({ ...currentUser, nickname: data?.nickname || "" });
        } else {
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Listen for real-time thoughts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "thoughts"), (snapshot) => {
      const thoughts: Thought[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            likes: data.likes,
            likedBy: data.likedBy,
            userId: data.userId,
            nickname: data.nickname,
            createdAt: data.createdAt, // either Timestamp or number
          } as Thought;
        })
        .sort((a, b) => {
          const aTime = typeof a.createdAt === "number" ? a.createdAt : a.createdAt.toMillis();
          const bTime = typeof b.createdAt === "number" ? b.createdAt : b.createdAt.toMillis();
          return bTime - aTime;
        });
        
  
      setFeed(thoughts);
    });
    return () => unsub();
  }, []);
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDEFF9] via-[#EECDF7] to-[#A1C4FD] p-4 sm:p-6 pb-28 flex flex-col items-center">
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 text-center">
        SnapThoughts
      </h1>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : user ? (
        <>
          {/* Profile & Logout */}
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 w-full max-w-sm bg-white/30 backdrop-blur-md rounded-2xl p-4 shadow-xl">
            <div className="text-center sm:text-left w-full">
              <p className="font-semibold text-base sm:text-lg text-gray-800">
                {user.nickname ? `Nickname: ${user.nickname}` : user.displayName || user.email}
              </p>
              <button
                onClick={logout}
                className="mt-2 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 px-4 py-2 rounded-full shadow-md w-full sm:w-auto transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Nickname Input */}
          {!user.nickname && (
            <div className="w-full max-w-sm bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-xl mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Choose a Nickname</h3>
              <p className="text-sm text-gray-600 mb-4">This will be shown with your posts.</p>
              <input
                type="text"
                placeholder="e.g. ThoughtBee"
                className="w-full p-3 rounded-xl border border-gray-300 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <button
                onClick={saveNickname}
                className="mt-4 w-full px-6 py-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-semibold rounded-full shadow-md hover:brightness-110 transition-all"
              >
                Save Nickname
              </button>
            </div>
          )}


          {/* Feed with animation */}
          <div className="w-full max-w-sm space-y-6 pb-28">
            <AnimatePresence initial={false}>
              {feed.map((t) => (
                <motion.div
  key={t.id}
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.4 }}
  className="bg-white/70 backdrop-blur-lg p-5 sm:p-6 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300"
>
  <div className="space-y-2">
    <p className="text-sm text-gray-700 font-semibold tracking-wide">
      🧠 {t.nickname || "Anonymous"}
    </p>
    <p className="text-gray-900 text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
      {t.text}
    </p>
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={() => likeThought(t.id, t.likedBy, t.likes)}
        className={`text-sm font-medium flex items-center gap-1 transition ${
          t.likedBy.includes(user.uid)
            ? "text-yellow-500"
            : "text-gray-500 hover:text-pink-500"
        }`}
      >
        🍯 {t.likes}
      </button>
      {t.userId === user?.uid && (
        <button
          onClick={() => deleteThought(t.id)}
          className="text-sm font-medium text-red-400 hover:text-red-600 transition"
        >
          🗑 Delete
        </button>
      )}
    </div>
  </div>
</motion.div>
              
              ))}
            </AnimatePresence>
          </div>

          {/* Floating Thought Input at Bottom */}
          <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-t">
  <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto w-full">
    <textarea
      placeholder="✨ Share something sweet..."
      className="w-full sm:flex-1 h-20 p-3 rounded-xl shadow-sm border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none transition"
      value={thought}
      onChange={(e) => setThought(e.target.value)}
      maxLength={100}
    />
    <button
      onClick={async () => {
        await postThought();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold hover:brightness-110 shadow-md w-full sm:w-auto transition-all"
    >
      📝 Post
    </button>
  </div>
</div>


        </>
      ) : (
        <div className="w-full max-w-sm bg-white/30 backdrop-blur-lg rounded-2xl shadow-xl p-6 text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Welcome to HoneyThoughts 🍯</h2>
            <p className="text-sm text-gray-600 mb-6">Share your sweet thoughts anonymously.</p>
            <button
              onClick={login}
              className="w-full px-6 py-3 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:scale-[1.02] hover:brightness-110 transition-all font-semibold text-base"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="w-5 h-5"
              />
              Continue with Google
            </button>

        </div>

      )}
    </div>
  );
}
