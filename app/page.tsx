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
        if (cleanNickname === "") return toast.error("Error: Invalid handle.");
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
          if (cleanMessage === "") {
            toast.error("Error: Message empty.");
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
            window.scrollTo({ top: feedRef.current?.offsetTop, behavior: "smooth" });
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

  // Handle input focus for mobile
  useEffect(() => {
    const handleResize = () => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      <header className="w-full bg-[#0A0A0A] sticky top-0 z-30 py-3 px-4 border-b border-[#00FF00]">
        <h1 className="text-2xl md:text-3xl font-bold text-[#00FF00] font-mono animate-glitch">
          HackChat_ [v1.0.0]
        </h1>
      </header>

      {/* Main Content */}
      <div className="bg-[#0A0A0A] px-4 py-6 flex flex-col items-center min-h-screen">
        {loading || !firebaseApp ? (
          <div className="flex items-center justify-center h-40" aria-live="polite">
            <div className="w-10 h-10 border-4 border-[#00FF00] border-t-transparent rounded-full animate-spin" aria-label="Connecting to server"></div>
          </div>
        ) : user ? (
          <>
            {/* Profile & Logout */}
            <div className="w-full max-w-lg bg-[#1A1A1A] border border-[#00FF00] rounded-lg p-4 mb-4 flex justify-between items-center">
              <p className="font-mono text-[#00FF00] text-sm md:text-base">
                {'>'} {user.nickname ? `${user.nickname}` : user.displayName || user.email}
              </p>
              <button
                onClick={logout}
                className="px-3 py-1.5 font-mono text-[#0A0A0A] bg-[#00FF00] hover:bg-[#00FFFF] transition-all duration-200 glitch text-sm md:text-base min-w-[60px]"
                aria-label="Log out"
              >
                exit
              </button>
            </div>

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
            <div className="w-full max-w-lg bg-[#1A1A1A] border border-[#00FF00] rounded-lg p-4 h-[calc(100vh-240px)] overflow-y-auto mb-4 flex flex-col gap-3" ref={feedRef} role="feed" aria-live="polite">
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
                      className={`max-w-[80%] p-2.5 rounded-lg ${
                        msg.userId === user.uid
                          ? 'bg-[#00FF00]/20 text-[#00FF00]'
                          : 'bg-[#00FFFF]/20 text-[#00FFFF]'
                      }`}
                    >
                      <p className="font-mono text-xs mb-1">
                        {msg.nickname || "Anon"} |{' '}
                        {msg.createdAt && msg.createdAt.toDate
                          ? format(msg.createdAt.toDate(), "HH:mm")
                          : "??:??"}
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
              className="fixed bottom-0 left-0 right-0 p-3 bg-[#0A0A0A] border-t border-[#00FF00] z-40"
            >
              <div className="flex items-center gap-2 max-w-lg mx-auto">
                <input
                  ref={inputRef}
                  placeholder="> Type your message..."
                  className="flex-1 p-2 bg-[#0A0A0A] border border-[#00FF00] text-[#00FF00] font-mono focus:outline-none focus:border-[#00FFFF] transition-all duration-200 text-sm md:text-base"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  aria-label="Message input"
                />
                <button
                  onClick={() => sendMessage(message, user, db)}
                  disabled={isSending}
                  className={`px-3 py-2 font-mono text-[#0A0A0A] bg-[#00FF00] hover:bg-[#00FFFF] transition-all duration-200 glitch text-sm md:text-base min-w-[60px] ${
                    isSending ? 'opacity-50' : ''
                  }`}
                  aria-label="Send message"
                >
                  {'>'} send
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
        @media (prefers-reduced-motion: reduce) {
          .animate-glitch,
          .glitch:hover {
            animation: none;
            text-shadow: none;
          }
        }
        @media (max-width: 640px) {
          .min-h-screen {
            padding-bottom: 80px; /* Space for fixed input */
          }
          .fixed.bottom-0 {
            bottom: env(safe-area-inset-bottom, 0);
            padding-bottom: calc(8px + env(safe-area-inset-bottom, 0));
          }
          .h-[calc(100vh-240px)] {
            height: calc(100vh - 200px);
          }
        }
      `}</style>
    </>
  );
}