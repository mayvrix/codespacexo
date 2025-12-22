import React from "react";
// ✅ Added onSnapshot for real-time updates
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase"; 

// --- Helper Components for Icons ---
const EyeIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
);

const EyeSlashIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228"/>
  </svg>
);

// --- Shared Styles ---
const PageStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    body { font-family: 'Press Start 2P', cursive; }
    .font-press-start { font-family: 'Press Start 2P', cursive; }
    .text-glow { text-shadow: 0 0 6px rgba(50, 205, 50, 0.7); }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 1.25rem; height: 1.25rem; animation: spin 1s linear infinite; }
    .scrollbar-thin { scrollbar-width: thin; scrollbar-color: #32CD32 #000000; }
    .scrollbar-thin::-webkit-scrollbar { width: 8px; }
    .scrollbar-thin::-webkit-scrollbar-track { background: #000000; }
    .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #32CD32; border-radius: 0; border: 0; }
    .dash-button { background-color: #32CD32; color: #000; font-family: 'Press Start 2P', cursive; font-size: 10px; padding: 8px 12px; border: none; cursor: pointer; }
    .dash-button:hover { background-color: #fff; }
    .dash-input { font-family: 'Press Start 2P', cursive; font-size: 10px; background-color: #000; color: #32CD32; border: 1px solid #32CD32; padding: 8px; outline: none; }

    /* Snackbar */
    .snackbar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #ff3333;
      color: #fff;
      padding: 10px 20px;
      border-radius: 4px;
      font-family: 'Press Start 2P', cursive;
      font-size: 10px;
      text-align: center;
      z-index: 9999;
      opacity: 0;
      animation: fadeInOut 4s ease forwards;
    }
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translate(-50%, 20px); }
      10%, 90% { opacity: 1; transform: translate(-50%, 0); }
      100% { opacity: 0; transform: translate(-50%, 20px); }
    }
  `}</style>
);

// --- Snackbar Component ---
const Snackbar = ({ message }) => {
  if (!message) return null;
  return <div className="snackbar">{message}</div>;
};

// --- Dashboard Card ---
const DashboardCard = ({ title, children }) => (
  <div className="border-2 border-green-400 p-4 mb-4">
    <h3 className="text-lg text-green-400 text-glow mb-3 uppercase">{title}</h3>
    <div className="space-y-2 text-sm">{children}</div>
  </div>
);

/**
 * Main Dashboard Page (Fetches Feedback from Firestore)
 */
const MainPage = () => {
  const [loading, setLoading] = React.useState(true);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [feedbackList, setFeedbackList] = React.useState([]);
  const [snackbarMsg, setSnackbarMsg] = React.useState("");

  // --- Firebase Auth ---
  React.useEffect(() => {
    if (!auth) {
      setSnackbarMsg("Firebase Auth not initialized.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        try { 
          await signInAnonymously(auth);
          setIsAuthReady(true);
        } catch (e) {
          setSnackbarMsg("Auth error: " + e.message);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Fetch Feedback (REAL-TIME UPDATES) ---
  React.useEffect(() => {
    if (!isAuthReady || !db) return;

    setLoading(true);
    const feedbackCol = collection(db, "feedback");
    // Sort by createdAt descending (newest first). 
    // NOTE: This will HIDE any documents that do not have a 'createdAt' field.
    const q = query(feedbackCol, orderBy("createdAt", "desc"));

    // Using onSnapshot for real-time data sync
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFeedbackList(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setSnackbarMsg("Error loading feedback: " + error.message);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [isAuthReady]);

  // --- UI States ---
  if (!isAuthReady) {
    return (
      <div className="w-full min-h-screen bg-black text-green-400 font-press-start flex flex-col items-center justify-center p-6 text-glow">
        <span className="text-xl font-semibold">dashXO</span>
        <span className="mt-4 text-lg">SIGNING IN...</span>
        <Snackbar message={snackbarMsg} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-black text-green-400 font-press-start flex flex-col items-center justify-center p-6 text-glow">
        <span className="text-xl font-semibold">dashXO</span>
        <span className="mt-4 text-lg">LOADING DATA...</span>
        <Snackbar message={snackbarMsg} />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-black text-green-400 font-press-start p-4 md:p-6 scrollbar-thin">
      <span className="text-xl font-semibold text-glow">dashXO</span>

      <div className="mt-6 w-full max-w-4xl mx-auto">
        <h2 className="text-2xl text-glow mb-4">[ FEEDBACK ]</h2>

        <DashboardCard title="Received Feedback">
          {!feedbackList.length ? (
            <p className="text-gray-400">No feedback found.</p>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((fb) => (
                <div key={fb.id} className="pb-3 border-b-2 border-green-900 last:border-b-0">
                  <h4 className="text-base text-white text-glow">{fb.statement}</h4>
                  <p className="text-sm text-gray-300 mt-2 leading-relaxed">{fb.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Received:{" "}
                    {fb.createdAt?.toDate
                      ? fb.createdAt.toDate().toLocaleString()
                      : "No Date"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>

      <Snackbar message={snackbarMsg} />
    </div>
  );
};

/**
 * Login Page (Unchanged)
 */
const LoginPage = ({ onLogin }) => {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [snackbarMsg, setSnackbarMsg] = React.useState("");

  const correctPassword = "Tanmaya#136@!";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (password === correctPassword) {
        onLogin();
      } else {
        setError("Wrong password!");
        setSnackbarMsg("❌ Wrong password!");
        setPassword("");
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="bg-black text-white font-press-start flex flex-col items-center min-h-screen p-4 justify-center">
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-4xl md:text-6xl tracking-wider text-center">dashXO</h1>
      </div>

      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="border-2 border-white p-6 flex flex-col items-center">
          <p className="mb-4 text-center text-sm">ENTER PASSWORD</p>

          <div className="relative w-full mb-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="PASSWORD"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-press-start border-2 border-white p-2 w-full text-center outline-none focus:bg-gray-800 bg-black text-white text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-300" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-300" />
              )}
            </button>
          </div>

          {error && <p className="text-red-400 text-xs mb-2 text-center">{error}</p>}

          <div className="flex justify-end w-full mt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-white text-black px-4 py-2 text-sm flex items-center justify-center disabled:opacity-75"
              style={{ minWidth: "80px" }}
            >
              {loading ? (
                <div className="spinner-dark">
                  <style>{`
                    @keyframes spin-dark { to { transform: rotate(360deg); } }
                    .spinner-dark {
                      border: 3px solid rgba(0, 0, 0, 0.3);
                      border-top-color: #000;
                      border-radius: 50%;
                      width: 1.25rem; height: 1.25rem;
                      animation: spin-dark 1s linear infinite;
                    }
                  `}</style>
                </div>
              ) : (
                "ENTER"
              )}
            </button>
          </div>
        </form>
      </div>

      <Snackbar message={snackbarMsg} />
    </div>
  );
};

/**
 * Root Component
 */
export default function DashXO() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const handleLoginSuccess = () => setIsLoggedIn(true);

  return (
    <>
      <PageStyles />
      {isLoggedIn ? <MainPage /> : <LoginPage onLogin={handleLoginSuccess} />}
    </>
  );
}