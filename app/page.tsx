"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
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
  serverTimestamp,
  query,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  getDocs,
  where,
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import sanitizeHtml from "sanitize-html";
import debounce from "lodash.debounce";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
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
  nickname?: string;
}

interface Thought {
  id: string;
  text: string;
  likes: number;
  likedBy: string[];
  userId: string;
  nickname?: string;
  createdAt: Timestamp;
}

// --- Main Component ---
export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [thought, setThought] = useState("");
  const [feed, setFeed] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [nickname, setNickname] = useState<string>("");
  const [page, setPage] = useState(1);
  const thoughtsPerPage = 20;

  // Login with Google
  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: currentUser.email,
          displayName: currentUser.displayName,
        });
      }

      const latestUserDoc = await getDoc(userRef);
      const data = latestUserDoc.data();
      setUser({ ...currentUser, nickname: data?.nickname || "" });
      toast.success("Logged in successfully!");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Logged out successfully!");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed. Please try again.");
    }
  };

  // Save nickname to Firestore
  const saveNickname = debounce(async () => {
    const cleanNickname = sanitizeHtml(nickname.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });
    if (cleanNickname === "") {
      toast.error("Please enter a valid nickname.");
      return;
    }
    if (!user) {
      toast.error("Please login to set a nickname.");
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { nickname: cleanNickname });
      setUser((prev) => ({ ...prev!, nickname: cleanNickname }));

      // Update all thoughts by this user
      const thoughtsRef = collection(db, "thoughts");
      const q = query(thoughtsRef, where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.update(doc.ref, { nickname: cleanNickname });
      });
      await batch.commit();
      toast.success("Nickname updated!");
    } catch (error) {
      console.error("Failed to save nickname", error);
      toast.error("Failed to save nickname. Try again.");
    }
  }, 500);

  // Post a thought
  const postThought = debounce(async () => {
    setIsPosting(true);
    const cleanThought = sanitizeHtml(thought.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });
    if (cleanThought === "") {
      toast.error("Please enter some text.");
      setIsPosting(false);
      return;
    }
    if (!user) {
      toast.error("Please login to post a thought.");
      setIsPosting(false);
      return;
    }

    try {
      await addDoc(collection(db, "thoughts"), {
        text: cleanThought,
        likes: 0,
        likedBy: [],
        userId: user.uid,
        nickname: user.nickname || user.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      });
      setThought("");
      toast.success("Thought posted!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Post thought failed", error);
      toast.error("Failed to post thought. Try again.");
    } finally {
      setIsPosting(false);
    }
  }, 500);

  // Like a thought
  const likeThought = async (id: string, likedBy: string[], currentLikes: number) => {
    if (!user) {
      toast.error("Please login to like a thought.");
      return;
    }
    const thoughtRef = doc(db, "thoughts", id);

    const alreadyLiked = likedBy.includes(user.uid);
    const updatedLikes = alreadyLiked ? currentLikes - 1 : currentLikes + 1;
    const updatedLikedBy = alreadyLiked
      ? likedBy.filter((uid) => uid !== user.uid)
      : [...likedBy, user.uid];

    try {
      await updateDoc(thoughtRef, {
        likes: updatedLikes,
        likedBy: updatedLikedBy,
      });
    } catch (error) {
      console.error("Failed to update like", error);
      toast.error("Failed to like thought. Try again.");
    }
  };

  // Delete a thought
  const deleteThought = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this thought?")) {
      try {
        const thoughtRef = doc(db, "thoughts", id);
        await deleteDoc(thoughtRef);
        toast.success("Thought deleted!");
      } catch (error) {
        console.error("Delete failed", error);
        toast.error("Failed to delete thought. Try again.");
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

  // Listen for real-time thoughts with pagination
  useEffect(() => {
    const q = query(
      collection(db, "thoughts"),
      orderBy("createdAt", "desc"),
      limit(thoughtsPerPage * page)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const thoughts: Thought[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Thought));
      setFeed(thoughts);
    });
    return () => unsub();
  }, [page]);

  // Clean up debounced functions
  useEffect(() => {
    return () => {
      postThought.cancel();
      saveNickname.cancel();
    };
  }, []);

  // Load more thoughts
  const loadMore = () => {
    setPage((prev) => prev + 1);
  };

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <header className="w-full bg-white sticky top-0 z-10 py-3 px-4">
        <h1 className="w-full block text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 text-center">
          HoneyThoughts🍯
        </h1>
      </header>

      <div className="min-h-screen bg-gradient-to-br from-[#FDEFF9] via-[#EECDF7] to-[#A1C4FD] p-4 sm:p-6 pb-28 flex flex-col items-center">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

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
                  aria-label="Log out"
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
                  aria-label="Nickname input"
                />
                <button
                  onClick={saveNickname}
                  className="mt-4 w-full px-6 py-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white font-semibold rounded-full shadow-md hover:brightness-110 transition-all"
                  aria-label="Save nickname"
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
                          aria-label={t.likedBy.includes(user.uid) ? "Unlike thought" : "Like thought"}
                        >
                          🍯 {t.likes}
                        </button>
                        {t.userId === user?.uid && (
                          <button
                            onClick={() => deleteThought(t.id)}
                            className="text-sm font-medium text-red-400 hover:text-red-600 transition"
                            aria-label="Delete thought"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {feed.length >= thoughtsPerPage * page && (
                <button
                  onClick={loadMore}
                  className="w-full px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-full shadow-md hover:brightness-110 transition-all"
                  aria-label="Load more thoughts"
                >
                  Load More
                </button>
              )}
            </div>

            {/* Floating Thought Input at Bottom */}
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-t"
            >
              <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto w-full">
                <div className="relative w-full sm:flex-1">
                  <textarea
                    placeholder="✨ Share something sweet..."
                    className="w-full sm:flex-1 h-20 p-3 rounded-xl shadow-sm border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none transition"
                    value={thought}
                    onChange={(e) => setThought(e.target.value)}
                    maxLength={100}
                    aria-label="Thought input"
                  />
                  <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                    {thought.length}/100
                  </span>
                </div>
                <button
                  onClick={postThought}
                  disabled={isPosting}
                  className={`px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold hover:brightness-110 shadow-md w-full sm:w-auto transition-all ${
                    isPosting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  aria-label="Post thought"
                >
                  {isPosting ? "Posting..." : "📝 Post"}
                </button>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="w-full max-w-sm bg-white/30 backdrop-blur-lg rounded-2xl shadow-xl p-6 text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Welcome to HoneyThoughts 🍯
            </h2>
            <p className="text-sm text-gray-600 mb-6">Share your sweet thoughts anonymously.</p>
            <button
              onClick={login}
              className="w-full px-6 py-3 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg hover:scale-[1.02] hover:brightness-110 transition-all font-semibold text-base"
              aria-label="Sign in with Google"
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
    </>
  );
}