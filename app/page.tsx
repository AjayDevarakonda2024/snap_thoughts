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

interface Message {
  id: string;
  text: string;
  userId: string;
  nickname?: string;
  createdAt: Timestamp | null;
}

// Header Component
function Header({ user, logout }: { user: User | null; logout: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between w-full px-4 py-3 bg-gray-950 border-b border-green-500 shadow-sm">
      <h1 className="text-xl font-bold text-green-500 md:text-2xl font-mono animate-glitch">
        HackChat_
      </h1>
      {user && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-green-500 font-mono md:text-base">
            {user.nickname || user.displayName || user.email}
          </p>
          <button
            onClick={logout}
            className="p-2 transition-transform duration-200 transform bg-green-500 rounded-full hover:bg-cyan-400 hover:scale-105 active:scale-95"
            aria-label="Log out"
          >
            <svg className="w-4 h-4 text-gray-950" fill="currentColor" viewBox="0 0 24 24">
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
      className="w-full max-w-md p-4 mb-4 bg-gray-900 border border-green-500 rounded-lg shadow-lg"
    >
      <p className="mb-2 text-sm text-green-500 font-mono md:text-base">{'>'} Set hacker handle</p>
      <input
        type="text"
        placeholder="e.g. CyberPunk"
        className="w-full p-3 text-sm text-green-500 transition-all duration-200 bg-gray-950 border border-green-500 rounded-md font-mono md:text-base focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        aria-label="Handle input"
      />
      <button
        onClick={() => saveNickname(nickname, user, db)}
        className="px-4 py-2 mt-3 text-sm font-mono text-gray-950 transition-transform duration-200 transform bg-green-500 rounded-md hover:bg-cyan-400 hover:scale-105 active:scale-95 md:text-base"
        aria-label="Save handle"
      >
        {'>'} Save
      </button>
    </motion.div>
  );
}

// Chat Feed Component
function ChatFeed({
  feed,
  user,
  deleteMessage,
  feedRef,
  loadMore,
  isLoadingMore,
  page,
}: {
  feed: Message[];
  user: User | null;
  deleteMessage: (id: string) => void;
  feedRef: RefObject<HTMLDivElement | null>;
  loadMore: () => void;
  isLoadingMore: boolean;
  page: number;
}) {
  return (
    <div
      className="w-full max-w-2xl p-4 mb-4 overflow-y-auto bg-gray-900 border border-green-500 rounded-lg shadow-lg h-[calc(100vh-200px)] flex flex-col gap-3 scroll-smooth"
      ref={feedRef}
      role="feed"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {feed.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`flex ${msg.userId === user?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-2xl shadow-md ${
                msg.userId === user?.uid
                  ? 'bg-green-500/20 text-green-500 rounded-br-sm'
                  : 'bg-cyan-400/20 text-cyan-400 rounded-bl-sm'
              }`}
            >
              <p className="mb-1 text-xs font-mono opacity-80">
                {msg.nickname || 'Anon'} |{' '}
                {msg.createdAt && msg.createdAt.toDate
                  ? format(msg.createdAt.toDate(), 'HH:mm')
                  : 'Unknown'}
              </p>
              <p className="text-sm font-mono whitespace-pre-wrap md:text-base">{msg.text}</p>
              {msg.userId === user?.uid && (
                <button
                  onClick={() => deleteMessage(msg.id)}
                  className="mt-1 text-xs font-mono text-red-500 transition-colors duration-200 hover:text-red-600"
                  aria-label="Delete message"
                >
                  Delete
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
          className={`w-full p-3 text-sm font-mono text-gray-950 transition-transform duration-200 transform bg-green-500 rounded-md hover:bg-cyan-400 hover:scale-105 active:scale-95 md:text-base ${
            isLoadingMore ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label="Load more messages"
        >
          {'>'} Load More
        </button>
      )}
    </div>
  );
}

// Message Input Component
function MessageInput({
  message,
  setMessage,
  sendMessage,
  isSending,
  user,
  db,
  inputRef,
}: {
  message: string;
  setMessage: (value: string) => void;
  sendMessage: (message: string, user: User | null, db: Firestore | null) => void;
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-green-500"
      style={{ transition: 'padding-bottom 0.2s ease' }}
    >
      <div className="flex items-center gap-3 max-w-2xl p-3 mx-auto">
        <button
          className="p-2 transition-colors duration-200 text-green-500 hover:text-cyan-400"
          aria-label="Attach file"
          disabled
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.828 9.172a4 4 0 0 1 0 5.656l-2.829 2.829a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.828-2.829a1 1 0 0 0-1.414-1.414l-2.829 2.829a4 4 0 0 0 0 5.656 4 4 0 0 0 5.657 0l2.828-2.829a6 6 0 0 0 0-8.485 1 1 0 0 0-1.414 1.415z" />
          </svg>
        </button>
        <input
          ref={inputRef}
          placeholder="Type a message..."
          className="flex-1 p-3 text-sm text-green-500 transition-all duration-200 bg-gray-950 border border-green-500 rounded-full font-mono md:text-base focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          aria-label="Message input"
        />
        <button
          onClick={() => sendMessage(message, user, db)}
          disabled={isSending || !message.trim()}
          className={`p-2 transition-transform duration-200 transform bg-green-500 rounded-full hover:bg-cyan-400 hover:scale-105 active:scale-95 text-gray-950 ${
            isSending || !message.trim() ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label="Send message"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
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
      className="w-full max-w-md p-6 text-center bg-gray-900 border border-green-500 rounded-lg shadow-lg"
    >
      <h2 className="mb-3 text-lg font-mono text-green-500 md:text-xl animate-glitch">
        HackChat_ Access Terminal
      </h2>
      <p className="mb-4 text-sm text-cyan-400 font-mono md:text-base">Enter the matrix.</p>
      <button
        onClick={login}
        className="flex items-center justify-center gap-2 px-5 py-2 mx-auto text-sm font-mono text-gray-950 transition-transform duration-200 transform bg-green-500 rounded-md hover:bg-cyan-400 hover:scale-105 active:scale-95 md:text-base min-w-[140px]"
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
        Auth Google
      </button>
    </motion.div>
  );
}

// Main Component
export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [feed, setFeed] = useState<Message[]>([]);
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

        const inputContainer = inputRef.current.parentElement?.parentElement;
        if (document.activeElement === inputRef.current && isKeyboardOpen) {
          if (inputContainer) {
            inputContainer.style.paddingBottom = `${keyboardHeight + 16}px`;
          }
          const inputRect = inputRef.current.getBoundingClientRect();
          if (inputRect.bottom > viewport.height + viewport.offsetTop) {
            inputRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        } else if (inputContainer) {
          inputContainer.style.paddingBottom = "16px";
        }
      }, 100);
    };

    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);

    const handleFocus = () => handleViewportChange();
    if (inputRef.current) {
      inputRef.current.addEventListener("focus", handleFocus);
    }

    return () => {
      clearTimeout(timeout);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      if (inputRef.current) {
        inputRef.current.removeEventListener("focus", handleFocus);
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
      toast.success("Access granted!");
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
      toast.success("Session terminated!");
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
          return toast.error("Error: Handle must be 1-20 chars, letters, numbers, _, or -.");
        }
        if (!user) return toast.error("Error: Must be logged in.");
        if (!db) return toast.error("Error: Database offline.");

        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, { nickname: cleanNickname });
          setUser((prev) => ({ ...prev!, nickname: cleanNickname }));

          const messagesRef = collection(db, "messages");
          const q = query(messagesRef, where("userId", "==", user.uid));
          const snapshot = await getDocs(q);

          const batch = writeBatch(db);
          snapshot.forEach((doc) => {
            batch.update(doc.ref, { nickname: cleanNickname });
          });
          await batch.commit();
          toast.success("Handle updated!");
        } catch (error) {
          console.error("Failed to save nickname", error);
          toast.error("Error: Handle update failed.");
        }
      }, 500),
    []
  );

  // Send a message (Debounced)
  const sendMessage = useMemo(
    () =>
      debounce(
        async (message: string, user: User | null, db: Firestore | null) => {
          setIsSending(true);
          const cleanMessage = sanitizeHtml(message.trim(), {
            allowedTags: [],
            allowedAttributes: {},
          });
          if (cleanMessage === "" || cleanMessage.length > 500) {
            toast.error("Error: Message must be 1-500 chars.");
            setIsSending(false);
            return;
          }
          if (!user || !db) {
            toast.error(user ? "Error: Database offline." : "Error: Must be logged in.");
            setIsSending(false);
            return;
          }

          try {
            await addDoc(collection(db, "messages"), {
              text: cleanMessage,
              userId: user.uid,
              nickname: user.nickname || user.displayName || "Anon",
              createdAt: serverTimestamp(),
            });

            setMessage("");
            toast.success("Message sent!");
            if (feedRef.current) {
              feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }
          } catch (error) {
            console.error("Send message failed", error);
            toast.error("Error: Send failed. Try again.");
          } finally {
            setIsSending(false);
          }
        },
        500
      ),
    []
  );

  // Delete a message
  const deleteMessage = async (id: string) => {
    if (!db) return toast.error("Error: Database offline.");
    if (window.confirm("Delete this message?")) {
      try {
        const messageRef = doc(db, "messages", id);
        await deleteDoc(messageRef);
        toast.success("Message deleted!");
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

  // Real-time messages with pagination
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "messages"),
      orderBy("createdAt", "desc"),
      limit(20 * page)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const messages: Message[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt || null,
      } as Message));
      setFeed(messages);
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      toast.error("Error: Failed to load messages.");
    });
    return () => unsub();
  }, [db, page]);

  // Clean up debounced functions
  useEffect(() => {
    return () => {
      sendMessage.cancel();
      saveNickname.cancel();
    };
  }, [sendMessage, saveNickname]);

  // Load more messages
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
        <title>HackChat_</title>
        <meta name="description" content="Encrypted chat for hackers." />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
        toastClassName="bg-gray-950 border border-green-500 text-green-500 font-mono rounded-lg text-sm shadow-lg"
        progressClassName="bg-green-500"
      />
      <div className="flex flex-col min-h-screen bg-gray-950 font-mono">
        <Header user={user} logout={logout} />
        <main className="flex flex-col items-center flex-1 px-4 py-6">
          {loading || !firebaseApp ? (
            <div className="flex items-center justify-center h-40" aria-live="polite">
              <div
                className="w-10 h-10 border-4 border-green-500 rounded-full border-t-transparent animate-spin"
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
              <ChatFeed
                feed={feed}
                user={user}
                deleteMessage={deleteMessage}
                feedRef={feedRef}
                loadMore={loadMore}
                isLoadingMore={isLoadingMore}
                page={page}
              />
              <MessageInput
                message={message}
                setMessage={setMessage}
                sendMessage={sendMessage}
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
        @keyframes glitch {
          0% {
            transform: translate(0);
            text-shadow: 0.05em 0 0 #00ff00, -0.05em 0 0 #00ffff;
          }
          14% {
            transform: translate(-0.05em, 0.05em);
            text-shadow: 0.05em 0 0 #00ff00, -0.05em 0 0 #00ffff;
          }
          15% {
            transform: translate(-0.05em, 0.05em);
            text-shadow: -0.05em 0 0 #00ff00, 0.05em 0 0 #00ffff;
          }
          49% {
            transform: translate(0);
            text-shadow: -0.05em 0 0 #00ff00, 0.05em 0 0 #00ffff;
          }
          50% {
            transform: translate(0.05em, -0.05em);
            text-shadow: 0.05em 0 0 #00ff00, -0.05em 0 0 #00ffff;
          }
          99% {
            transform: translate(0);
            text-shadow: 0.05em 0 0 #00ff00, -0.05em 0 0 #00ffff;
          }
          100% {
            transform: translate(0);
            text-shadow: -0.05em 0 0 #00ff00, 0.05em 0 0 #00ffff;
          }
        }
        html,
        body {
          font-family: 'JetBrains Mono', monospace;
          background: #0a0a0a;
          color: #00ff00;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        .animate-glitch {
          animation: glitch 1s linear infinite;
        }
        [role='feed'] {
          scroll-behavior: smooth;
          overscroll-behavior: contain;
          contain: layout;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-glitch {
            animation: none;
            text-shadow: none;
          }
        }
        @media (max-width: 640px) {
          .min-h-screen {
            padding-bottom: 80px;
          }
          .fixed.bottom-0 {
            bottom: env(safe-area-inset-bottom, 0);
          }
          .h-[calc(100vh-200px)] {
            height: calc(100vh - 160px - env(safe-area-inset-bottom, 0));
          }
        }
      `}</style>
    </>
  );
}