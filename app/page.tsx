"use client";

import { motion, AnimatePresence } from "framer-motion";
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
import { format } from "date-fns";
import Head from "next/head";
import { RefObject } from "react";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD3f6Jj6u1xWDRop7MVk-NWhLbwqnPeHfA",
  authDomain: "snap-thoughts-d1423.firebaseapp.com",
  projectId: "snap-thoughts-d1423",
  storageBucket: "snap-thoughts-d1423.firebasestorage.app",
  messagingSenderId: "736664268783",
  appId: "1:736664268783:web:1be88e4d1d26ebd052d01a",
  measurementId: "G-XYHPJ4PEPC",
};

// Types
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
  userId: string;
  nickname?: string;
  createdAt: Timestamp | null;
}

// Header Component
function Header({ user, logout }: { user: User | null; logout: () => void }) {
  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-40 flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-rose-100 to-pink-100 border-b border-rose-200 shadow-sm"
    >
      <h1 className="text-xl font-bold text-rose-600 md:text-2xl font-cursive">
        Honey Chat
      </h1>
      {user && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-rose-700 font-cursive md:text-base truncate max-w-[150px]">
            {user.nickname || user.displayName || user.email}
          </p>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="p-2 bg-rose-500 rounded-full text-white transition-colors duration-200 hover:bg-rose-600 focus:ring-2 focus:ring-rose-400 focus:outline-none"
            aria-label="Log out"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 17v-2H9v-2h7V9l4 4-4 4zm-5 3H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h6v2H5v12h6v2z" />
            </svg>
          </motion.button>
        </div>
      )}
    </motion.header>
  );
}

// Nickname Input Component
function NicknameSection({
  nickname,
  setNickname,
  saveNickname,
  user,
  db,
}: {
  nickname: string;
  setNickname: (value: string) => void;
  saveNickname: (nickname: string, user: User | null, db: Firestore | null) => void;
  user: User | null;
  db: Firestore | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md p-4 mb-6 bg-white/80 backdrop-blur-sm border border-rose-200 rounded-xl shadow-md"
    >
      <p className="mb-2 text-sm text-rose-600 font-cursive md:text-base">
        💖 Choose your sweet nickname
      </p>
      <input
        type="text"
        placeholder="e.g. Sweetheart"
        className="w-full p-3 text-sm text-rose-700 bg-rose-50 border border-rose-300 rounded-lg font-cursive md:text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-400 focus:outline-none transition-all duration-200"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        aria-label="Nickname input"
      />
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => saveNickname(nickname, user, db)}
        className="w-full px-4 py-2 mt-3 text-sm font-cursive text-white bg-rose-500 rounded-lg hover:bg-rose-600 focus:ring-2 focus:ring-rose-400 focus:outline-none transition-all duration-200 md:text-base"
        aria-label="Save nickname"
      >
        💕 Save Nickname
      </motion.button>
    </motion.div>
  );
}

// Thought Feed Component
function ThoughtFeed({
  feed,
  user,
  deleteThought,
  feedRef,
}: {
  feed: Thought[];
  user: User | null;
  deleteThought: (id: string) => void;
  feedRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <motion.div
      className="w-full max-w-2xl p-4 mb-6 bg-white/80 backdrop-blur-sm border border-rose-200 rounded-xl shadow-md flex flex-col gap-4 overflow-y-auto scroll-smooth feed-container"
      ref={feedRef}
      role="feed"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <AnimatePresence initial={false}>
        {feed.map((thought) => (
          <motion.div
            key={thought.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`flex ${thought.userId === user?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] p-4 rounded-2xl shadow-sm ${
                thought.userId === user?.uid
                  ? 'bg-rose-200 text-rose-700 rounded-br-none'
                  : 'bg-pink-100 text-pink-700 rounded-bl-none'
              }`}
            >
              <p className="mb-1 text-xs font-cursive text-rose-600/80">
                {thought.nickname || 'Darling'} |{' '}
                {thought.createdAt && thought.createdAt.toDate
                  ? format(thought.createdAt.toDate(), 'MMM d, HH:mm')
                  : 'Timeless'}
              </p>
              <p className="text-sm font-cursive whitespace-pre-wrap md:text-base">{thought.text}</p>
              {thought.userId === user?.uid && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => deleteThought(thought.id)}
                  className="mt-2 text-xs font-cursive text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-200"
                  aria-label={`Delete thought by ${thought.nickname || 'Darling'}`}
                >
                  Delete
                </motion.button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Thought Input Component
function ThoughtInput({
  thought,
  setThought,
  sendThought,
  isSending,
  user,
  db,
  inputRef,
}: {
  thought: string;
  setThought: (value: string) => void;
  sendThought: (thought: string, user: User | null, db: Firestore | null) => void;
  isSending: boolean;
  user: User | null;
  db: Firestore | null;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-2xl p-4 bg-white/80 backdrop-blur-sm border-t border-rose-200 input-container z-40"
      style={{ transition: 'padding-bottom 0.3s ease' }}
    >
      <div className="flex items-center gap-3">
        <motion.button
          className="p-2 text-rose-600 hover:text-rose-700 focus:ring-2 focus:ring-rose-400 focus:outline-none transition-colors duration-200"
          aria-label="Attach file (coming soon)"
          disabled
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.828 9.172a4 4 0 0 1 0 5.656l-2.829 2.829a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.828-2.829a1 1 0 0 0-1.414-1.414l-2.829 2.829a4 4 0 0 0 0 5.656 4 4 0 0 0 5.657 0l2.828-2.829a6 6 0 0 0 0-8.485 1 1 0 0 0-1.414 1.415z" />
          </svg>
        </motion.button>
        <input
          ref={inputRef}
          placeholder="Share a sweet thought..."
          className="flex-1 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-300 rounded-full font-cursive md:text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-400 focus:outline-none transition-all duration-200"
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          maxLength={500}
          aria-label="Thought input"
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => sendThought(thought, user, db)}
          disabled={isSending || !thought.trim()}
          className={`p-2 bg-rose-500 rounded-full text-white focus:ring-2 focus:ring-rose-400 focus:outline-none transition-all duration-200 ${
            isSending || !thought.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-rose-600'
          }`}
          aria-label="Send thought"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3v7l15 2-15 2v7z" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}

// Auth Section Component
function AuthSection({ login }: { login: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md p-6 text-center bg-white/80 backdrop-blur-sm border border-rose-200 rounded-xl shadow-md"
    >
      <h2 className="mb-3 text-lg font-cursive text-rose-600 md:text-xl">
        Welcome to Honey Chat
      </h2>
      <p className="mb-4 text-sm text-rose-600 font-cursive md:text-base">
        Share your heart with the world.
      </p>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={login}
        className="flex items-center justify-center gap-2 px-5 py-2 mx-auto text-sm font-cursive text-white bg-rose-500 rounded-lg hover:bg-rose-600 focus:ring-2 focus:ring-rose-400 focus:outline-none transition-all duration-200 md:text-base min-w-[160px]"
        aria-label="Sign in with Google"
      >
        <Image
          src="https://www.svgrepo.com/show/475656/google-color.svg"
          alt="Google"
          width={16}
          height={16}
          className="w-4 h-4"
          priority
        />
        Sign in with Google
      </motion.button>
    </motion.div>
  );
}

// Main Component
export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [thought, setThought] = useState("");
  const [feed, setFeed] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [nickname, setNickname] = useState<string>("");
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Connection failed: ${errorMessage}`);
    }
  }, []);

  // Handle keyboard visibility for input bar
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleViewportChange = () => {
      if (!inputRef.current) return;

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const viewport = window.visualViewport || {
          height: window.innerHeight,
          offsetTop: 0,
        };
        const keyboardHeight = window.innerHeight - viewport.height;
        const isKeyboardOpen = keyboardHeight > 0;

        const inputContainer = document.querySelector('.input-container') as HTMLElement;
        if (isKeyboardOpen && inputContainer) {
          inputContainer.style.paddingBottom = `${keyboardHeight + 16}px`;
        } else if (inputContainer) {
          inputContainer.style.paddingBottom = '16px';
        }
      }, 100);
    };

    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      clearTimeout(timeout);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, []);

  // Login with Google
  const login = async () => {
    if (!auth) return toast.error("Auth service unavailable.");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      if (!db) return toast.error("Database unavailable.");
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
      toast.success("Welcome, darling!");
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Login failed: ${errorMessage}`);
    }
  };

  // Logout
  const logout = async () => {
    if (!auth) return toast.error("Auth service unavailable.");
    try {
      await signOut(auth);
      setUser(null);
      toast.success("See you soon, sweetheart!");
    } catch (error) {
      console.error("Logout error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Logout failed: ${errorMessage}`);
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
        if (cleanNickname === "" || cleanNickname.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(cleanNickname)) {
          return toast.error("Nickname must be 1-20 chars, letters, numbers, _, or -.");
        }
        if (!user) return toast.error("Please sign in first.");
        if (!db) return toast.error("Database unavailable.");

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
          toast.success("Nickname saved!");
        } catch (error) {
          console.error("Failed to save nickname", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(`Nickname update failed: ${errorMessage}`);
        }
      }, 500),
    []
  );

  // Send a thought (Debounced)
  const sendThought = useMemo(
    () =>
      debounce(
        async (thought: string, user: User | null, db: Firestore | null) => {
          setIsSending(true);
          const cleanThought = sanitizeHtml(thought.trim(), {
            allowedTags: [],
            allowedAttributes: {},
          });
          if (cleanThought === "" || cleanThought.length > 500) {
            toast.error("Thought must be 1-500 characters.");
            setIsSending(false);
            return;
          }
          if (!user || !db) {
            toast.error(user ? "Database unavailable." : "Please sign in first.");
            setIsSending(false);
            return;
          }

          try {
            await addDoc(collection(db, "thoughts"), {
              text: cleanThought,
              userId: user.uid,
              nickname: user.nickname || user.displayName || "Darling",
              createdAt: serverTimestamp(),
            });

            setThought("");
            toast.success("Thought shared!");
            if (feedRef.current) {
              feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }
          } catch (error) {
            console.error("Send thought failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Send failed: ${errorMessage}`);
          } finally {
            setIsSending(false);
          }
        },
        500
      ),
    []
  );

  // Delete a thought
  const deleteThought = async (id: string) => {
    if (!db) return toast.error("Database unavailable.");
    if (window.confirm("Are you sure you want to delete this thought?")) {
      try {
        const thoughtRef = doc(db, "thoughts", id);
        await deleteDoc(thoughtRef);
        toast.success("Thought deleted!");
      } catch (error) {
        console.error("Delete failed", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`Delete failed: ${errorMessage}`);
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

  // Real-time thoughts (load all, newest at bottom)
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "thoughts"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const thoughts: Thought[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || null,
      } as Thought));
      setFeed(thoughts);
      setTimeout(() => {
        if (feedRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
          if (isNearBottom) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
          }
        }
      }, 0);
    }, (error) => {
      console.error("Snapshot error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to load thoughts: ${errorMessage}`);
    });
    return () => unsub();
  }, [db]);

  // Clean up debounced functions
  useEffect(() => {
    return () => {
      sendThought.cancel();
      saveNickname.cancel();
    };
  }, [sendThought, saveNickname]);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <title>Honey Chat</title>
        <meta name="description" content="Share your sweetest thoughts with love." />
        <link
          href="https://fonts.googleapis.com/css2?family=Parisienne&display=swap"
          rel="stylesheet"
        />
      </Head>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        theme="light"
        toastClassName="bg-rose-50 border border-rose-200 text-rose-600 font-cursive rounded-lg text-sm shadow-md"
        progressClassName="bg-rose-400"
      />
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-rose-50 to-pink-50 font-cursive">
        <Header user={user} logout={logout} />
        <main className="flex flex-col items-center flex-1 px-4 py-6">
          {loading || !firebaseApp ? (
            <motion.div
              className="flex items-center justify-center h-40"
              aria-live="polite"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="w-10 h-10 border-4 border-rose-400 rounded-full border-t-transparent animate-spin"
                aria-label="Loading"
              ></div>
            </motion.div>
          ) : user ? (
            <>
              {!user.nickname && (
                <NicknameSection
                  nickname={nickname}
                  setNickname={setNickname}
                  saveNickname={saveNickname}
                  user={user}
                  db={db}
                />
              )}
              <ThoughtFeed
                feed={feed}
                user={user}
                deleteThought={deleteThought}
                feedRef={feedRef}
              />
              <ThoughtInput
                thought={thought}
                setThought={setThought}
                sendThought={sendThought}
                isSending={isSending}
                user={user}
                db={db}
                inputRef={inputRef}
              />
            </>
          ) : (
            <AuthSection login={login} />
          )}
        </main>
      </div>
      <style jsx global>{`
        html,
        body {
          font-family: 'Parisienne', cursive;
          background: linear-gradient(to bottom, #fef2f2, #fff1f2);
          color: #be123c;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }
        .feed-container {
          height: calc(100vh - 200px - 60px - env(safe-area-inset-bottom, 0));
          overscroll-behavior: contain;
          scroll-behavior: smooth;
        }
        .input-container {
          position: sticky;
          bottom: env(safe-area-inset-bottom, 0);
          left: 0;
          right: 0;
        }
        [role='feed'] {
          scroll-behavior: smooth;
          overscroll-behavior: contain;
          contain: layout;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse {
            animation: none;
          }
          .motion-div, .motion-button, .motion-header {
            transition: none !important;
          }
        }
        @media (max-width: 640px) {
          .min-h-screen {
            padding-bottom: env(safe-area-inset-bottom, 0);
          }
        }
      `}</style>
    </>
  );
}