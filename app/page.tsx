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

// --- Firebase config (Move to .env.local in production) ---
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

interface Message {
  id: string;
  text: string;
  userId: string;
  nickname?: string;
  createdAt: Timestamp | null;
}

// --- Main Component ---
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
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

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
        if (!inputRef.current) return; // Additional null check for TypeScript

        const viewport = window.visualViewport || {
          height: window.innerHeight,
          offsetTop: 0,
        };
        const keyboardHeight = window.innerHeight - viewport.height;
        const isKeyboardOpen = keyboardHeight > 0;

        const inputContainer = inputRef.current.parentElement?.parentElement;
        if (document.activeElement === inputRef.current && isKeyboardOpen) {
          if (inputContainer) {
            inputContainer.style.paddingBottom = `${keyboardHeight + 8}px`;
          }
          const inputRect = inputRef.current.getBoundingClientRect();
          if (inputRect.bottom > viewport.height + viewport.offsetTop) {
            inputRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        } else if (inputContainer) {
          inputContainer.style.paddingBottom = "8px";
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
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
        toastClassName="bg-[#0A0A0A] border border-[#00FF00] text-[#00FF00] font-mono rounded-lg text-sm"
        progressClassName="bg-[#00FF00]"
      />

      {/* Header */}
      <header className="w-full bg-[#0A0A0A] sticky top-0 z-30 py-2 px-4 border-b border-[#00FF00] flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-[#00FF00] font-mono animate-glitch">
          HackChat_
        </h1>
        {user && (
          <div className="flex items-center gap-2">
            <p className="font-mono text-[#00FF00] text-sm">
              {user.nickname || user.displayName || user.email}
            </p>
            <button
              onClick={logout}
              className="p-2 text-[#0A0A0A] bg-[#00FF00] hover:bg-[#00FFFF] rounded-full transition-all duration-200"
              aria-label="Log out"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="bg-[#0A0A0A] px-4 py-6 flex flex-col items-center min-h-screen">
        {loading || !firebaseApp ? (
          <div className="flex items-center justify-center h-40" aria-live="polite">
            <div className="w-10 h-10 border-4 border-[#00FF00] border-t-transparent rounded-full animate-spin" aria-label="Connecting to server"></div>
          </div>
        ) : user ? (
          <>
            {/* Nickname Input */}
            {!user.nickname && (
              <div className="w-full max-w-lg bg-[#1A1A1A] border border-[#00FF00] rounded-lg p-4 mb-4">
                <p className="font-mono text-[#00FF00] mb-2 text-sm md:text-base">{'>'} Set hacker handle</p>
                <input
                  type="text"
                  placeholder="e.g. CyberPunk"
                  className="w-full p-2 bg-[#0A0A0A] border border-[#00FF00] text-[#00FF00] font-mono focus:outline-none focus:border-[#00FFFF] transition-all duration-200 text-sm md:text-base"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  aria-label="Handle input"
                />
                <button
                  onClick={() => saveNickname(nickname, user, db)}
                  className="mt-3 px-3 py-1.5 font-mono text-[#0A0A0A] bg-[#00FF00] hover:bg-[#00FFFF] transition-all duration-200 glitch text-sm md:text-base min-w-[60px]"
                  aria-label="Save handle"
                >
                  {'>'} save
                </button>
              </div>
            )}

            {/* Chat Feed */}
            <div
              className="w-full max-w-lg bg-[#1A1A1A] border border-[#00FF00] rounded-lg p-4 h-[calc(100vh-180px)] overflow-y-auto mb-4 flex flex-col gap-2"
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
                    className={`flex ${msg.userId === user.uid ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-2xl shadow-md ${
                        msg.userId === user.uid
                          ? 'bg-[#00FF00]/30 text-[#00FF00] rounded-br-md'
                          : 'bg-[#00FFFF]/20 text-[#00FFFF] rounded-bl-md'
                      }`}
                    >
                      <p className="font-mono text-xs mb-1 opacity-80">
                        {msg.nickname || "Anon"} |{' '}
                        {msg.createdAt && msg.createdAt.toDate
                          ? format(msg.createdAt.toDate(), "HH:mm")
                          : "Unknown"}
                      </p>
                      <p className="font-mono text-sm whitespace-pre-wrap">{msg.text}</p>
                      {msg.userId === user?.uid && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="font-mono text-xs text-[#FF5555] hover:text-[#FF0000] transition-all duration-200 mt-1"
                          aria-label="Delete message"
                        >
                          del
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
                  className={`w-full p-2 font-mono text-[#0A0A0A] bg-[#00FF00] hover:bg-[#00FFFF] transition-all duration-200 text-sm ${
                    isLoadingMore ? 'opacity-50' : ''
                  }`}
                  aria-label="Load more messages"
                >
                  {'>'} load more
                </button>
              )}
            </div>

            {/* Message Input */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 bg-[#1A1A1A] border-t border-[#00FF00] z-40"
              style={{ transition: "padding-bottom 0.2s ease" }}
            >
              <div className="flex items-center gap-2 max-w-lg mx-auto p-3">
                <button
                  className="p-2 text-[#00FF00] hover:text-[#00FFFF] transition-all duration-200"
                  aria-label="Attach file"
                  disabled
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14.828 9.172a4 4 0 0 1 0 5.656l-2.829 2.829a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.828-2.829a1 1 0 0 0-1.414-1.414l-2.829 2.829a4 4 0 0 0 0 5.656 4 4 0 0 0 5.657 0l2.828-2.829a6 6 0 0 0 0-8.485 1 1 0 0 0-1.414 1.415z" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  placeholder="Type a message..."
                  className="flex-1 p-3 bg-[#0A0A0A] border border-[#00FF00] rounded-full text-[#00FF00] font-mono focus:outline-none focus:border-[#00FFFF] transition-all duration-200 text-sm md:text-base"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  aria-label="Message input"
                />
                <button
                  onClick={() => sendMessage(message, user, db)}
                  disabled={isSending || !message.trim()}
                  className={`p-2 text-[#0A0A0A] bg-[#00FF00] hover:bg-[#00FFFF] rounded-full transition-all duration-200 ${
                    isSending || !message.trim() ? 'opacity-50' : ''
                  }`}
                  aria-label="Send message"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="w-full max-w-lg bg-[#1A1A1A] border border-[#00FF00] rounded-lg p-4 text-center">
            <h2 className="text-lg md:text-xl font-mono text-[#00FF00] mb-3 animate-glitch">
              HackChat_ Access Terminal
            </h2>
            <p className="font-mono text-[#00FFFF] mb-3 text-sm md:text-base">Enter the matrix.</p>
            <button
              onClick={login}
              className="px-5 py-2 font-mono text-[#0A0A0A] bg-[#00FF00] hover:bg-[#00FFFF] transition-all duration-200 glitch flex items-center justify-center gap-2 mx-auto text-sm md:text-base min-w-[120px]"
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
              auth google
            </button>
          </div>
        )}
      </div>

      {/* Custom CSS */}
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
        html, body {
          font-family: 'JetBrains Mono', monospace;
          background: #0A0A0A;
          color: #00FF00;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        .animate-glitch {
          animation: glitch 1s linear infinite;
        }
        .glitch:hover {
          animation: glitch 0.3s linear infinite;
        }
        button:focus,
        input:focus {
          outline: none;
          border-color: #00FFFF;
        }
        button {
          touch-action: manipulation;
        }
        [role="feed"] {
          scroll-behavior: smooth;
          overscroll-behavior: contain;
          contain: layout;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-glitch,
          .glitch:hover {
            animation: none;
            text-shadow: none;
          }
        }
        @media (max-width: 640px) {
          .min-h-screen {
            padding-bottom: 60px;
          }
          .fixed.bottom-0 {
            bottom: env(safe-area-inset-bottom, 0);
          }
          .h-[calc(100vh-180px)] {
            height: calc(100vh - 140px - env(safe-area-inset-bottom, 0));
          }
        }
        .fixed.bottom-0 {
          transition: padding-bottom 0.2s ease;
        }
      `}</style>
    </>
  );
}
