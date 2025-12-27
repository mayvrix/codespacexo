import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import Logo from "../assets/xo.png";
import Hyperspeed from '../comps/hyperspeed';

// --- Helper Components for Icons ---
const EyeIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeSlashIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
  </svg>
);

// Monochrome Google Icon
const GoogleIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="currentColor" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

const toTitleCase = (str) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

const hyperspeedOptions = {
  onSpeedUp: () => {},
  onSlowDown: () => {},
  distortion: 'deepDistortion',
  length: 400,
  roadWidth: 9,
  islandWidth: 2,
  lanesPerRoad: 3,
  fov: 90,
  fovSpeedUp: 150,
  speedUp: 2,
  carLightsFade: 0.4,
  totalSideLightSticks: 50,
  lightPairsPerRoadWay: 50,
  shoulderLinesWidthPercentage: 0.05,
  brokenLinesWidthPercentage: 0.1,
  brokenLinesLengthPercentage: 0.5,
  lightStickWidth: [0.12, 0.5],
  lightStickHeight: [1.3, 1.7],
  movingAwaySpeed: [60, 80],
  movingCloserSpeed: [-120, -160],
  carLightsLength: [400 * 0.05, 400 * 0.15],
  carLightsRadius: [0.05, 0.14],
  carWidthPercentage: [0.3, 0.5],
  carShiftX: [-0.2, 0.2],
  carFloorSeparation: [0.05, 1],
  colors: {
    roadColor: 0x080808,
    islandColor: 0x0a0a0a,
    background: 0x000000,
    shoulderLines: 0x131318,
    brokenLines: 0x131318,
    leftCars: [0xff322f, 0xa33010, 0xa81508],
    rightCars: [0xfdfdf0, 0xf3dea0, 0xe2bb88],
    sticks: 0xfdfdf0
  }
};

const MemoizedHyperspeed = React.memo(Hyperspeed);

export default function Entry() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmedUser, setConfirmedUser] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetLink, setShowResetLink] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const listRef = useRef(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const list = snapshot.docs.map((doc) => ({
        ...doc.data(),
        uid: doc.id,
        name: toTitleCase(doc.data().name),
      }));
      list.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
      setUsers(list);
    };
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter((user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (confirmedUser) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleLogin();
        }
        return;
      }
      if (filteredUsers.length === 0) return;

      switch (e.key.toLowerCase()) {
        case "arrowup":
        case "w":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "arrowdown":
        case "s":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredUsers.length - 1 ? prev + 1 : filteredUsers.length - 1
          );
          break;
        case "enter":
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            setConfirmedUser(filteredUsers[selectedIndex]);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredUsers, selectedIndex, confirmedUser, password]);

  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIndex]) {
      listRef.current.children[selectedIndex].scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex, filteredUsers]);

  const handleLogin = async () => {
    if (!confirmedUser || !password) {
      setError("Enter password!");
      setShowResetLink(false);
      return;
    }
    setLoading(true);
    try {
      setError("");
      setShowResetLink(false);
      await signInWithEmailAndPassword(auth, confirmedUser.email, password);
      const userDocRef = doc(db, "users", confirmedUser.uid);
      await updateDoc(userDocRef, { lastLogin: Date.now() });
      navigate("/home");
    } catch (err) {
      setError("Wrong password!");
      setShowResetLink(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // CHECK if user exists in Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            // User exists, update login time and proceed
            await updateDoc(userDocRef, { lastLogin: Date.now() });
            navigate("/home");
        } else {
            // User DOES NOT exist - delete auth user to prevent signup and show error
            await user.delete(); 
            setError("Account not found. Please Sign Up first.");
            // Sign out just in case delete fails partially
            await auth.signOut();
        }
    } catch (err) {
        console.error("Google Login Error:", err);
        // Handle specific error codes if needed
        if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
             setError("Google login failed.");
        }
    } finally {
        setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!confirmedUser) return;
    setError("");
    try {
      await sendPasswordResetEmail(auth, confirmedUser.email);
      setResetMessage(
        `Reset link sent to ${confirmedUser.email}. Check your spam folder if you can't find it. This page will reload in 10 seconds...`
      );
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (err) {
      setError("Failed to send reset email. Please try again later.");
    }
  };

  const handleBack = () => {
    setConfirmedUser(null);
    setPassword("");
    setError("");
    setShowResetLink(false);
    setResetMessage("");
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-press">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <MemoizedHyperspeed effectOptions={hyperspeedOptions} />
      </div>

      <style>
        {`
          @keyframes spin { to { transform: rotate(360deg); } }
          .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            width: 1.25rem;
            height: 1.25rem;
            animation: spin 1s linear infinite;
          }
        `}
      </style>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 pb-16 text-white">
        <div className="flex flex-col items-center mb-6">
          <img
            src={Logo}
            alt="XO Logo"
            className="w-24 h-24 md:w-32 md:h-32 mb-0 object-contain"
          />
          <h1 className="text-2xl md:text-4xl tracking-wider text-center">
            CODESPACEXO
          </h1>
        </div>

        <div className="w-full max-w-md bg-black/40 backdrop-blur-sm p-4 rounded-lg">
          {!confirmedUser ? (
            <>
                {/* --- ERROR MESSAGE AREA (for Google Login failures) --- */}
               {error && !confirmedUser && (
                <p className="text-red-400 text-xs mb-2 text-center bg-black/50 p-1 border border-red-500">
                  {error}
                </p>
              )}

              <input
                type="text"
                placeholder="SEARCH USER..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="font-press border-2 border-white p-2 w-full text-left outline-none focus:bg-gray-800 mb-2 text-sm bg-black text-white"
              />
              <div
                ref={listRef}
                className="border-2 border-white h-52 overflow-y-auto relative scrollbar-thin scrollbar-thumb-white scrollbar-track-black bg-black/60"
              >
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user, index) => (
                    <div
                      key={user.uid}
                      onClick={() => setConfirmedUser(user)}
                      className={`p-2 cursor-pointer select-none transition-colors ${
                        selectedIndex === index ? "bg-white text-black" : "hover:bg-white/10"
                      }`}
                    >
                      {user.name}
                    </div>
                  ))
                ) : (
                  <p className="p-2">
                    {users.length === 0 ? "Loading..." : "No users found."}
                  </p>
                )}
              </div>
              <div className="mt-5 flex justify-between gap-2">
                <button
                  onClick={() => navigate("/signup")}
                  className="bg-white text-black px-4 py-2 text-sm hover:invert transition mr-auto"
                >
                  SIGN UP
                </button>
                
                {/* --- GOOGLE LOGIN BUTTON --- */}
                <button
                    onClick={handleGoogleLogin}
                    className="bg-white text-black w-[38px] h-[38px] flex items-center justify-center hover:bg-gray-200 transition"
                    title="Log in with Google"
                >
                    <GoogleIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => navigate("/notice")}
                  className="animated-gradient w-[38px] h-[38px] flex items-center justify-center text-sm hover:brightness-110 transition text-white"
                >
                  ?
                </button>
              </div>
            </>
          ) : (
            <div className="border-2 border-white p-6 flex flex-col items-center bg-black/60">
              {resetMessage ? (
                <p className="text-center text-green-400">{resetMessage}</p>
              ) : (
                <>
                  <p className="mb-4 text-center">{confirmedUser.name}</p>
                  <div className="relative w-full mb-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="PASSWORD"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="font-press border-2 border-white p-2 w-full text-center outline-none focus:bg-gray-800 bg-black text-white"
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

                  {error && (
                    <p className="text-red-400 text-xs mb-2 text-center">
                      {error}
                    </p>
                  )}

                  {showResetLink && (
                    <button
                      onClick={handleForgotPassword}
                      className="text-xs text-blue-400 hover:underline mb-4"
                    >
                      Forgot Password?
                    </button>
                  )}

                  <div className="flex justify-between w-full mt-2">
                    <button
                      onClick={handleBack}
                      className="bg-white text-black px-4 py-2 text-sm"
                    >
                      BACK
                    </button>
                    <button
                      onClick={handleLogin}
                      disabled={loading}
                      className="bg-white text-black px-4 py-2 text-sm flex items-center justify-center disabled:opacity-75"
                    >
                      {loading ? <div className="spinner"></div> : "ENTER"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}