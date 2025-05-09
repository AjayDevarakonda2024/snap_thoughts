"use client";

import { motion, AnimatePresence, useAnimation, AnimationControls } from "framer-motion";
import { useEffect, useState, useMemo, useRef } from "react";
import { initializeApp, FirebaseApp } from "firebase/app";
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
  Firestore,
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  Auth,
} from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import sanitizeHtml from "sanitize-html";
import debounce from "lodash.debounce";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import Head from "next/head";

// --- Firebase config (Moved to .env.local in production) ---
const firebaseConfig = {
  apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
  authDomain: "snap-thoughts-d1423.firebaseapp.com",
  projectId: "snap-thoughts-d1423",
  storageBucket: "snap-thoughts-d1423.firebasestorage.app",
  messagingSenderId: "736664268783",
  appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
  measurementId: "G-XYHPJ4PEPC",
};

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
  createdAt: Timestamp | null;
}

interface Particle {
  id: number;
  text: string;
  x: number;
  y: number;
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const thoughtsPerPage = 20;
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  // Initialize Firebase
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authInstance = getAuth(app);
      setFirebaseApp(app);
      setDb(firestore);
      setAuth(authInstance);
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      toast.error("Failed to connect to the server. Please try again.");
    }
  }, []);

  // Login with Google
  const login = async () => {
    if (!auth) return toast.error("Authentication service is not initialized.");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      if (!db) return toast.error("Database service is not initialized.");
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
    if (!auth) return toast.error("Authentication service is not initialized.");
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Logged out successfully!");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed. Please try again.");
    }
  };

  // Save nickname (Debounced)
  const saveNickname = useMemo(
    () =>
      debounce(async (nickname: string, user: User | null, db: Firestore | null) => {
        const cleanNickname = sanitizeHtml(nickname.trim(), {
          allowedTags: [],
          allowedAttributes: {},
        });
        if (cleanNickname === "") return toast.error("Please enter a valid nickname.");
        if (!user) return toast.error("Please login to set a nickname.");
        if (!db) return toast.error("Database service is not initialized.");

        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, { nickname: cleanNickname });
          setUser((prev) => ({ ...prev!, nickname: cleanNickname }));

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
      }, 500),
    []
  );

  // Post a thought with particle animation (Debounced)
  const postThought = useMemo(
    () =>
      debounce(
        async (thought: string, user: User | null, db: Firestore | null, controls: AnimationControls) => {
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
          if (!user || !db) {
            toast.error(user ? "Database service is not initialized." : "Please login to post a thought.");
            setIsPosting(false);
            return;
          }

          try {
            // Get textarea position for particle origin
            const textareaRect = textareaRef.current?.getBoundingClientRect();
            const feedRect = feedRef.current?.getBoundingClientRect();
            if (!textareaRect || !feedRect) throw new Error("Could not get element positions.");

            // Split thought into words (limit to 20 for performance)
            const words = cleanThought.split(" ").slice(0, 20);
            const newParticles: Particle[] = words.map((word, index) => ({
              id: index,
              text: word,
              x: textareaRect.left + textareaRect.width / 2,
              y: textareaRect.top + textareaRect.height / 2,
            }));
            setParticles(newParticles);

            // Animate particles
            await controls.start((i: number) => ({
              x: feedRect.left + 50 + Math.random() * (feedRect.width - 100),
              y: feedRect.top + 50,
              opacity: [1, 1, 0],
              scale: [1, 1.2, 0.8],
              transition: {
                duration: 1.5,
                ease: "easeOut",
                delay: i * 0.05,
              },
            }));

            // Post to Firestore
            await addDoc(collection(db, "thoughts"), {
              text: cleanThought,
              likes: 0,
              likedBy: [],
              userId: user.uid,
              nickname: user.nickname || user.displayName || "Anonymous",
              createdAt: serverTimestamp(),
            });

            setThought("");
            setParticles([]);
            toast.success("Thought posted!");
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (error) {
            console.error("Post thought failed", error);
            toast.error("Failed to post thought. Try again.");
          } finally {
            setIsPosting(false);
          }
        },
        500
      ),
    []
  );

  // Like a thought
  const likeThought = async (id: string, likedBy: string[], currentLikes: number) => {
    if (!user || !db) return toast.error(user ? "Database service is not initialized." : "Please login to like a thought.");
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
    if (!db) return toast.error("Database service is not initialized.");
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

  // Auth state listener
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser && db) {
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
  }, [auth, db]);

  // Real-time thoughts with pagination
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "thoughts"),
      orderBy("createdAt", "desc"),
      limit(thoughtsPerPage * page)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const thoughts: Thought[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || null,
      } as Thought));
      setFeed(thoughts);
    });
    return () => unsub();
  }, [db, page]);

  // Clean up debounced functions
  useEffect(() => {
    return () => {
      postThought.cancel();
      saveNickname.cancel();
    };
  }, [postThought, saveNickname]);

  // Load more thoughts
  const loadMore = async () => {
    setIsLoadingMore(true);
    setPage((prev) => prev + 1);
    setIsLoadingMore(false);
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>HoneyThoughts 🍯</title>
        <meta name="description" content="Share your sweet thoughts anonymously." />
      </Head>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="light"
        toastClassName="bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-100"
        progressClassName="bg-[#FF99CC]"
      />

      {/* Header */}
      <header className="w-full bg-white/90 backdrop-blur-lg sticky top-0 z-30 py-4 px-6 shadow-md">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-[#FF99CC] to-[#66CCFF] animate-glow">
          HoneyThoughts 🍯
        </h1>
      </header>

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br p-6 pb-36 flex flex-col items-center">
        {loading || !firebaseApp ? (
          <div className="flex items-center justify-center h-40" aria-live="polite">
            <div className="w-12 h-12 border-4 border-[#FF99CC] border-t-transparent rounded-full animate-spin" aria-label="Loading thoughts"></div>
          </div>
        ) : user ? (
          <>
            {/* Profile & Logout */}
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-8 w-full max-w-lg bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="text-center sm:text-left w-full">
                <p className="font-semibold text-lg text-[#2D3748] tracking-tight">
                  {user.nickname ? `✨ ${user.nickname}` : user.displayName || user.email}
                </p>
                <button
                  onClick={logout}
                  className="mt-3 px-6 py-2 text-sm font-semibold text-white bg-[#E53E3E] rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 focus:ring-2 focus:ring-[#FF99CC]"
                  aria-label="Log out"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Nickname Input */}
            {!user.nickname && (
              <div className="w-full max-w-lg bg-white/60 backdrop-blur-xl rounded-3xl p-8 shadow-lg mb-8 hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold text-[#2D3748] mb-3 tracking-tight">Choose a Nickname</h3>
                <p className="text-sm text-[#718096] mb-4">This will be shown with your posts.</p>
                <input
                  type="text"
                  placeholder="e.g. ThoughtBee"
                  className="w-full p-4 rounded-xl border border-[#FF99CC]/30 bg-white/80 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#FF99CC] focus:border-transparent transition-all duration-200"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  aria-label="Nickname input"
                />
                <button
                  onClick={() => saveNickname(nickname, user, db)}
                  className="mt-4 w-full px-6 py-3 bg-gradient-to-r from-[#FF99CC] to-[#66CCFF] text-white font-semibold rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 focus:ring-2 focus:ring-[#FF99CC]"
                  aria-label="Save nickname"
                >
                  Save Nickname
                </button>
              </div>
            )}

            {/* Feed */}
            <div className="w-full max-w-lg space-y-6 pb-36 relative" aria-live="polite" ref={feedRef}>
              {/* Particle Animation */}
              <AnimatePresence>
                {particles.map((particle, i) => (
                  <motion.div
                    key={particle.id}
                    custom={i}
                    animate={controls}
                    initial={{
                      x: particle.x - window.scrollX,
                      y: particle.y - window.scrollY,
                      opacity: 1,
                      scale: 1,
                    }}
                    className="absolute text-[#FF99CC] font-semibold text-sm pointer-events-none glow-particle"
                  >
                    {particle.text}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Thought Cards */}
              <AnimatePresence initial={false}>
                {feed.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 border border-[#FF99CC]/30"
                  >
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[#FF99CC] tracking-wide">
                        🧠 {t.nickname || "Anonymous"}
                      </p>
                      <p className="text-[#2D3748] text-base leading-relaxed whitespace-pre-wrap">
                        {t.text}
                      </p>
                      <p className="text-xs text-[#718096]">
                        {t.createdAt && t.createdAt.toDate
                          ? `${formatDistanceToNow(t.createdAt.toDate(), { addSuffix: true })} (${format(
                              t.createdAt.toDate(),
                              "MMM d, yyyy, h:mm a"
                            )})`
                          : "Date unavailable"}
                      </p>
                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => likeThought(t.id, t.likedBy, t.likes)}
                          className={`text-sm font-medium flex items-center gap-1 transition-all duration-200 transform ${
                            t.likedBy.includes(user.uid)
                              ? "text-[#FF99CC] scale-110"
                              : "text-[#718096] hover:text-[#FF99CC] hover:scale-105"
                          }`}
                          aria-label={t.likedBy.includes(user.uid) ? "Unlike thought" : "Like thought"}
                        >
                          🍯 <span className="font-semibold">{t.likes}</span>
                        </button>
                        {t.userId === user?.uid && (
                          <button
                            onClick={() => deleteThought(t.id)}
                            className="text-sm font-medium text-[#E53E3E] hover:text-[#C53030] transition-all duration-200"
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
                  disabled={isLoadingMore}
                  className={`w-full px-6 py-3 bg-gradient-to-r from-[#FF99CC] to-[#66CCFF] text-white font-semibold rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 focus:ring-2 focus:ring-[#FF99CC] ${
                    isLoadingMore ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  aria-label="Load more thoughts"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </button>
              )}
            </div>

            {/* Floating Thought Input */}
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="fixed bottom-0 left-0 right-0 px-6 py-4 bg-white/90 backdrop-blur-xl border-t border-[#FF99CC]/30 shadow-t z-20"
            >
              <div className="flex flex-col sm:flex-row items-center gap-4 max-w-lg mx-auto w-full">
                <div className="relative w-full sm:flex-1">
                  <textarea
                    ref={textareaRef}
                    placeholder="✨ Share something sweet..."
                    className="w-full h-24 p-4 rounded-xl border border-[#FF99CC]/30 bg-white/80 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#FF99CC] focus:border-transparent resize-none transition-all duration-200"
                    value={thought}
                    onChange={(e) => setThought(e.target.value)}
                    maxLength={500}
                    aria-label="Thought input"
                  />
                  <span className="absolute bottom-3 right-3 text-xs text-[#718096]">
                    {thought.length}/500
                  </span>
                </div>
                <button
                  onClick={() => postThought(thought, user, db, controls)}
                  disabled={isPosting}
                  className={`px-8 py-3 bg-gradient-to-r from-[#FF99CC] to-[#66CCFF] text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 focus:ring-2 focus:ring-[#FF99CC] glow-button ${
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
          <div className="w-full max-w-lg bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg p-8 text-center hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-semibold mb-4 text-[#2D3748] tracking-tight">
              Welcome to HoneyThoughts 🍯
            </h2>
            <p className="text-sm text-[#718096] mb-6">Share your sweet thoughts anonymously.</p>
            <button
              onClick={login}
              className="w-full px-8 py-4 flex items-center justify-center gap-3 bg-gradient-to-r from-[#FF99CC] to-[#66CCFF] text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 focus:ring-2 focus:ring-[#FF99CC] glow-button"
              aria-label="Sign in with Google"
            >
              <Image
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                width={24}
                height={24}
                className="w-6 h-6"
                priority
              />
              Continue with Google
            </button>
          </div>
        )}
      </div>

      {/* Custom CSS */}
      <style jsx global>{`
        @keyframes glow {
          0%,
          100% {
            text-shadow: 0 0 10px rgba(255, 153, 204, 0.5);
          }
          50% {
            text-shadow: 0 0 20px rgba(255, 153, 204, 0.8), 0 0 30px rgba(255, 153, 204, 0.4);
          }
        }
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
        .glow-particle {
          text-shadow: 0 0 10px rgba(255, 153, 204, 0.8), 0 0 20px rgba(255, 153, 204, 0.4);
        }
        .glow-button {
          box-shadow: 0 0 15px rgba(255, 153, 204, 0.5);
        }
        .bg-gradient-to-br {
          background: linear-gradient(135deg, #fce4ec, #e6f3ff, #f3e8ff);
          background-size: 200% 200%;
          animation: gradientShift 15s ease infinite;
        }
        button:focus,
        input:focus,
        textarea:focus {
          outline: none;
        }
        .hover\:scale-105:hover {
          transform: scale(1.05);
        }
        .shadow-t {
          box-shadow: 0 -4px 6px -1px rgba(255, 153, 204, 0.1), 0 -2px 4px -1px rgba(255, 153, 204, 0.06);
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-glow,
          .glow-particle,
          .hover\:scale-105:hover,
          .bg-gradient-to-br {
            animation: none;
            transform: none;
            text-shadow: none;
            box-shadow: none;
          }
        }
      `}</style>
    </>
  );
}