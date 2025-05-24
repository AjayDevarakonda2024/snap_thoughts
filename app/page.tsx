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
import { format } from "date-fns";
import Head from "next/head";
import { RefObject } from "react";

// Firebase config (Move to .env.local in production)
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
    <header className="sticky top-0 z-30 flex items-center justify-between w-full px-4 py-3 bg-gradient-to-r from-pink-100 to-rose-100 border-b border-rose-300 shadow-sm">
      <h1 className="text-xl font-bold text-rose-600 md:text-2xl font-cursive animate-pulse">
        Honey Thought
      </h1>
      {user && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-rose-600 font-cursive md:text-base">
            {user.nickname || user.displayName || user.email}
          </p>
          <button
            onClick={logout}
            className="p-2 transition-transform duration-200 transform bg-rose-400 rounded-full hover:bg-rose-500 hover:scale-105 active:scale-95"
            aria-label="Log out"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
        </div>
      )}
    </header>
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
      transition={{ duration: 0.3 }}
      className="w-full max-w-md p-4 mb-4 bg-rose-50 border border-rose-300 rounded-lg shadow-lg"
    >
      <p className="mb-2 text-sm text-rose-600 font-cursive md:text-base">💕 Choose your sweet name</p>
      <input
        type="text"
        placeholder="e.g. Sweetheart"
        className="w-full p-3 text-sm text-rose-600 transition-all duration-200 bg-white border border-rose-300 rounded-md font-cursive md:text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-500/50"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        aria-label="Nickname input"
      />
      <button
        onClick={() => saveNickname(nickname, user, db)}
        className="px-4 py-2 mt-3 text-sm font-cursive text-white transition-transform duration-200 transform bg-rose-400 rounded-md hover:bg-rose-500 hover:scale-105 active:scale-95 md:text-base"
        aria-label="Save nickname"
      >
        💕 Save
      </button>
    </motion.div>
  );
}

// Thought Feed Component
function ThoughtFeed({
  feed,
  user,
  deleteThought,
  feedRef,
  loadMore,
  isLoadingMore,
  page,
}: {
  feed: Thought[];
  user: User | null;
  deleteThought: (id: string) => void;
  feedRef: RefObject<HTMLDivElement | null>;
  loadMore: () => void;
  isLoadingMore: boolean;
  page: number;
}) {
  return (
    <div
      className="w-full max-w-2xl p-4 mb-4 overflow-y-auto bg-rose-50 border border-rose-300 rounded-lg shadow-lg h-[calc(100vh-200px)] flex flex-col gap-3 scroll-smooth"
      ref={feedRef}
      role="feed"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {feed.map((thought) => (
          <motion.div
            key={thought.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`flex ${thought.userId === user?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-2xl shadow-md ${
                thought.userId === user?.uid
                  ? 'bg-rose-200 text-rose-600 rounded-br-sm'
                  : 'bg-pink-100 text-pink-600 rounded-bl-sm'
              }`}
            >
              <p className="mb-1 text-xs font-cursive opacity-80">
                {thought.nickname || 'Darling'} |{' '}
                {thought.createdAt && thought.createdAt.toDate
                  ? format(thought.createdAt.toDate(), 'HH:mm')
                  : 'Timeless'}
              </p>
              <p className="text-sm font-cursive whitespace-pre-wrap md:text-base">{thought.text}</p>
              {thought.userId === user?.uid && (
                <button
                  onClick={() => deleteThought(thought.id)}
                  className="mt-1 text-xs font-cursive text-red-600 transition-colors duration-200 hover:text-red-700"
                  aria-label="Delete thought"
                >
                  Remove
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {feed.length >= 20 * page && (
        <button
          onClick={loadMore}
          disabled={isLoadingMore}
          className={`w-full p-3 text-sm font-cursive text-white transition-transform duration-200 transform bg-rose-400 rounded-md hover:bg-rose-500 hover:scale-105 active:scale-95 md:text-base ${
            isLoadingMore ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label="Load more thoughts"
        >
          💕 More Thoughts
        </button>
      )}
    </div>
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
      transition={{ duration: 0.3 }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-rose-50 border-t border-rose-300 input-container"
      style={{ transition: 'bottom 0.3s ease' }}
    >
      <div className="flex items-center gap-3 max-w-2xl p-3 mx-auto">
        <button
          className="p-2 transition-colors duration-200 text-rose-600 hover:text-rose-700"
          aria-label="Attach file"
          disabled
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.828 9.172a4 4 0 0 1 0 5.656l-2.829 2.829a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.828-2.829a1 1 0 0 0-1.414-1.414l-2.829 2.829a4 4 0 0 0 0 5.656 4 4 0 0 0 5.657 0l2.828-2.829a6 6 0 0 0 0-8.485 1 1 0 0 0-1.414 1.415z" />
          </svg>
        </button>
        <input
          ref={inputRef}
          placeholder="Share a sweet thought..."
          className="flex-1 p-3 text-sm text-rose-600 transition-all duration-200 bg-white border border-rose-300 rounded-full font-cursive md:text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-500/50"
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          maxLength={500}
          aria-label="Thought input"
        />
        <button
          onClick={() => sendThought(thought, user, db)}
          disabled={isSending || !thought.trim()}
          className={`p-2 transition-transform duration-200 transform bg-rose-400 rounded-full hover:bg-rose-500 hover:scale-105 active:scale-95 text-white ${
            isSending || !thought.trim() ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label="Send thought"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
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
      transition={{ duration: 0.3 }}
      className="w-full max-w-md p-6 text-center bg-rose-50 border border-rose-300 rounded-lg shadow-lg"
    >
      <h2 className="mb-3 text-lg font-cursive text-rose-600 md:text-xl animate-pulse">
        Honey Thought
      </h2>
      <p className="mb-4 text-sm text-pink-600 font-cursive md:text-base">Share your heart with us.</p>
      <button
        onClick={login}
        className="flex items-center justify-center gap-2 px-5 py-2 mx-auto text-sm font-cursive text-white transition-transform duration-200 transform bg-rose-400 rounded-md hover:bg-rose-500 hover:scale-105 active:scale-95 md:text-base min-w-[140px]"
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
        Join with Google
      </button>
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
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
      toast.error("Error: Connection to server failed. Retry.");
    }
  }, []);

  // Handle keyboard visibility for input bar
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleViewportChange = () => {
      if (!inputRef.current) return;

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!inputRef.current) return;

        const viewport = window.visualViewport || {
          height: window.innerHeight,
          offsetTop: 0,
        };
        const keyboardHeight = window.innerHeight - viewport.height;
        const isKeyboardOpen = keyboardHeight > 0;

        const inputContainer = document.querySelector('.input-container') as HTMLElement;
        if (document.activeElement === inputRef.current && isKeyboardOpen) {
          if (inputContainer) {
            inputContainer.style.bottom = `${keyboardHeight}px`;
          }
          const inputRect = inputRef.current.getBoundingClientRect();
          if (inputRect.bottom > viewport.height + viewport.offsetTop) {
            inputRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        } else if (inputContainer) {
          inputContainer.style.bottom = "0px";
        }
      }, 300);
    };

    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);

    const handleFocus = () => handleViewportChange();
    const handleBlur = () => handleViewportChange();

    if (inputRef.current) {
      inputRef.current.addEventListener("focus", handleFocus);
      inputRef.current.addEventListener("blur", handleBlur);
    }

    return () => {
      clearTimeout(timeout);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      if (inputRef.current) {
        inputRef.current.removeEventListener("focus", handleFocus);
        inputRef.current.removeEventListener("blur", handleBlur);
      }
    };
  }, []);

  // Login with Google
  const login = async () => {
    if (!auth) return toast.error("Error: Auth service offline.");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      if (!db) return toast.error("Error: Database offline.");
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
      toast.error("Error: Access denied. Try again.");
    }
  };

  // Logout
  const logout = async () => {
    if (!auth) return toast.error("Error: Auth service offline.");
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Goodbye, sweetheart!");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Error: Logout failed. Try again.");
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
          return toast.error("Error: Name must be 1-20 chars, letters, numbers, _, or -.");
        }
        if (!user) return toast.error("Error: Must be logged in.");
        if (!db) return toast.error("Error: Database offline.");

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
          toast.success("Name saved, love!");
        } catch (error) {
          console.error("Failed to save nickname", error);
          toast.error("Error: Name update failed.");
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
            toast.error("Error: Thought must be 1-500 chars.");
            setIsSending(false);
            return;
          }
          if (!user || !db) {
            toast.error(user ? "Error: Database offline." : "Error: Must be logged in.");
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
            console.error("Send thought failed", error);
            toast.error("Error: Send failed. Try again.");
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
    if (!db) return toast.error("Error: Database offline.");
    if (window.confirm("Remove this thought?")) {
      try {
        const thoughtRef = doc(db, "thoughts", id);
        await deleteDoc(thoughtRef);
        toast.success("Thought removed!");
      } catch (error) {
        console.error("Delete failed", error);
        toast.error("Error: Delete failed. Try again.");
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
      limit(20 * page)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const thoughts: Thought[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || null,
      } as Thought));
      setFeed(thoughts);
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      toast.error("Error: Failed to load thoughts.");
    });
    return () => unsub();
  }, [db, page]);

  // Clean up debounced functions
  useEffect(() => {
    return () => {
      sendThought.cancel();
      saveNickname.cancel();
    };
  }, [sendThought, saveNickname]);

  // Load more thoughts
  const loadMore = async () => {
    setIsLoadingMore(true);
    setPage((prev) => prev + 1);
    setIsLoadingMore(false);
  };

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <title>Honey Thought</title>
        <meta name="description" content="Share your sweetest thoughts with love." />
        <link
          href="https://fonts.googleapis.com/css2?family=Parisienne&display=swap"
          rel="stylesheet"
        />
      </Head>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="light"
        toastClassName="bg-rose-50 border border-rose-300 text-rose-600 font-cursive rounded-lg text-sm shadow-lg"
        progressClassName="bg-rose-400"
      />
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-pink-50 to-rose-50 font-cursive">
        <Header user={user} logout={logout} />
        <main className="flex flex-col items-center flex-1 px-4 py-6">
          {loading || !firebaseApp ? (
            <div className="flex items-center justify-center h-40" aria-live="polite">
              <div
                className="w-10 h-10 border-4 border-rose-400 rounded-full border-t-transparent animate-spin"
                aria-label="Connecting to server"
              ></div>
            </div>
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
                loadMore={loadMore}
                isLoadingMore={isLoadingMore}
                page={page}
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
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        html,
        body {
          font-family: 'Parisienne', cursive;
          background: linear-gradient(to bottom, #fef2f2, #fefce8);
          color: #be123c;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        .animate-pulse {
          animation: pulse 2s ease-in-out infinite;
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
        }
        @media (max-width: 640px) {
          .min-h-screen {
            padding-bottom: 80px;
          }
          .input-container {
            bottom: env(safe-area-inset-bottom, 0);
            transition: bottom 0.3s ease;
          }
          .h-[calc(100vh-200px)] {
            height: calc(100vh - 160px - env(safe-area-inset-bottom, 0));
          }
        }
      `}</style>
    </>
  );
}