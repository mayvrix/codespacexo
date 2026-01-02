import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect, // for mobile
  getRedirectResult   // for mobile
} from "firebase/auth";
import Logo from "../assets/xoMod.png";
import ColorBends from '../comps/bends';
import GlassSurface from '../comps/glass';
import GlassSurfaceXO from '../comps/glassx';

// --- Custom Hook to Detect Mobile Device ---
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  return isMobile;
};

// --- Custom Hook to Detect Lag/Low Performance ---
const usePerformanceMonitor = () => {
  const [isLowSpec, setIsLowSpec] = useState(false);

  useEffect(() => {
    let frameId;
    let lastTime = performance.now();
    let lagCounter = 0;
    
    // Delay monitoring by 1s to ignore load stutter
    const startMonitoring = setTimeout(() => {
      const checkFPS = () => {
        const now = performance.now();
        const delta = now - lastTime;
        lastTime = now;

        if (delta > 50) { // < 20 FPS
          lagCounter++;
        } else {
          lagCounter = Math.max(0, lagCounter - 0.5);
        }

        if (lagCounter > 15) {
          setIsLowSpec(true);
          return;
        }

        frameId = requestAnimationFrame(checkFPS);
      };

      frameId = requestAnimationFrame(checkFPS);
    }, 1000);

    return () => {
      clearTimeout(startMonitoring);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return isLowSpec;
};

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

export default function Entry() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isLowPerf = usePerformanceMonitor();
  
  // Flag: If mobile or lagging, disable blur and use a solid dark background instead
  const reduceMotion = isMobile || isLowPerf;
  const glassFallback = reduceMotion ? '!backdrop-blur-none !bg-black/80' : '';

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

  // 1. Handle the "Return" from Google (Run only once on mount)
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          console.log("Mobile Redirect Success:", result.user);
          // Process the user (same logic as popup)
          await processGoogleUser(result.user);
        }
      } catch (error) {
        console.error("Redirect Error:", error);
        // ALERT THE ERROR ON MOBILE SO YOU CAN SEE IT
        if (isMobile) alert(`Login Error: ${error.message}`);
        setError(error.message);
      }
    };
    handleRedirectResult();
  }, [isMobile]); // Dependencies

  // 2. The Logic to Process a User (Shared by Popup & Redirect)
  const processGoogleUser = async (user) => {
    setLoading(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        await updateDoc(userDocRef, { lastLogin: Date.now() });
        navigate("/home");
      } else {
        // User not in your 'users' collection -> Delete and reject
        await user.delete();
        setError("Account not found. Please Sign Up first.");
        if (isMobile) alert("Account not found in database.");
        await auth.signOut();
      }
    } catch (err) {
      console.error("Process User Error:", err);
      setError("Failed to verify account.");
    } finally {
      setLoading(false);
    }
  };

  // 3. The Login Trigger
  const handleGoogleLogin = async () => {
    setError("");
    const provider = new GoogleAuthProvider();

    try {
      if (isMobile) {
        // MOBILE: REDIRECT STRATEGY
        // This will reload the page. The useEffect above handles the return.
        setLoading(true);
        await signInWithRedirect(auth, provider);
      } else {
        // DESKTOP: POPUP STRATEGY
        setLoading(true);
        const result = await signInWithPopup(auth, provider);
        await processGoogleUser(result.user);
      }
    } catch (err) {
      console.error("Login Trigger Error:", err);
      setLoading(false);
      // Ignore "popup closed by user" errors
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
         setError("Google login failed.");
         if (isMobile) alert(`Trigger Error: ${err.message}`);
      }
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
      {/* Background Layer - ALWAYS ColorBends, but reduced motion settings may apply if you wanted to pass them to ColorBends, but requirement is just disabling glass blur */}
      <div className="absolute inset-0 w-full h-full opacity-80">
        <ColorBends
            colors={["#00fa08ff", "#561becff", "#ff0000ff"]}
            rotation={-6}
            speed={0.53}
            scale={1.2}
            frequency={1}
            warpStrength={1}
            mouseInfluence={1}
            parallax={0.5}
            noise={0.1}
        />
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
          /* Custom Triangle Arrow (Updated: Larger, Flipped to point left) */
          .arrow-selection {
             width: 0; 
             height: 0; 
             border-top: 10px solid transparent;    /* Larger */
             border-bottom: 10px solid transparent; /* Larger */
             border-right: 14px solid white;        /* Flipped to point Left */
          }
          /* Modern Desktop Scrollbar */
          ::-webkit-scrollbar {
            width: 8px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            border: 2px solid transparent; /* padding around thumb */
            background-clip: content-box;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
            background-clip: content-box;
          }
        `}
      </style>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 pb-24 text-white">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-2">
          <img
            src={Logo}
            alt="XO Logo"
            className="w-32 h-32 md:w-40 md:h-40 mb-0 object-contain"
          />
        </div>

        {/* --- MAIN INTERFACE: 4 GLASS SURFACES LAYOUT --- */}
        {!confirmedUser ? (
            /* WIDENED CONTAINER: max-w-md */
            <div className="w-full max-w-md flex flex-col gap-4">
                
                {/* 1. SEARCH CAPSULE (Top) */}
                <GlassSurface
                   className={`w-full px-6 py-4 ${glassFallback}`}
                   borderRadius={9999}
                   borderWidth={0.02}
                   distortionScale={-180}
                   opacity={0.8}
                   backgroundOpacity={0.1}
                >
                    <input
                      type="text"
                      placeholder="Search User Here"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="font-doto font-bold bg-transparent border-none w-full text-left outline-none text-white placeholder-white text-lg"
                    />
                </GlassSurface>

                {/* 2. USER LIST CONTAINER (Middle) */}
                <GlassSurface
                   // Optimize: Remove blur on low-spec devices
                   className={`w-full py-4 ${glassFallback}`} 
                   borderRadius={24}
                   borderWidth={0.02}
                   distortionScale={-180}
                   opacity={0.8}
                   backgroundOpacity={0.1}
                >
                      {error && (
                        <p className="text-red-400 text-xs mb-2 text-center border border-red-500 rounded p-1">
                            {error}
                        </p>
                      )}
                      
                      {/* Reduced padding to px-6 (a little gap, not fully close to edge) */}
                      <div
                        ref={listRef}
                        className="h-52 overflow-y-auto px-4"
                      >
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user, index) => (
                            <div
                              key={user.uid}
                              onClick={() => setConfirmedUser(user)}
                              className={`w-full p-2 mb-1 rounded-xl cursor-pointer select-none transition-all
  flex items-center justify-between ${
    selectedIndex === index
      ? "bg-white/20"
      : "hover:bg-white/5 opacity-70"
  }`}
                            >
                              {/* Left Aligned Text */}
                              <span className="text-md text-left flex-1">{user.name}</span>
                              
                              {/* Arrow on the Right, pointing Left */}
                              {selectedIndex === index && (
                                  <div className="arrow-selection"></div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-400">
                             {users.length === 0 ? "Loading..." : "No users found"}
                          </div>
                        )}
                      </div>
                </GlassSurface>

                {/* BOTTOM ROW (Two Capsules) - Space Between */}
                <div className="flex justify-between items-center w-full h-[60px]">
                    
                    {/* 3. SIGN UP PILL (Bottom Left) - WIDER (70%) */}
                    <div className="w-[50%] h-full cursor-pointer" onClick={() => navigate("/signup")}>
                        <GlassSurfaceXO
                            className={`w-full h-full flex items-center justify-center py-2 ${glassFallback}`}
                            borderRadius={9999}
                            borderWidth={0.02}
                            distortionScale={-180}
                            opacity={0.8}
                            backgroundOpacity={0.1}
                        >
                            <span className="font-doto font-bold text-xl tracking-wide hover:scale-105 transition-transform">SIGN UP</span>
                        </GlassSurfaceXO>
                    </div>

                    {/* 4. GOOGLE BUTTON (Bottom Right - Circular) - Aspect Square */}
                    <div className="aspect-square h-full cursor-pointer" onClick={handleGoogleLogin}>
                        <GlassSurfaceXO
                            className={`w-full h-full flex items-center justify-center py-2 ${glassFallback}`}
                            borderRadius={9999}
                            borderWidth={0.02}
                            distortionScale={-180}
                            opacity={0.8}
                            backgroundOpacity={0.1}
                        >
                             <GoogleIcon className="w-6 h-6 hover:scale-110 transition-transform" />
                        </GlassSurfaceXO>
                    </div>

                </div>

            </div>
        ) : (
            // --- PASSWORD CONFIRMATION VIEW ---
            /* WIDENED CONTAINER: max-w-lg */
            <GlassSurface
                // Optimize: Remove blur on low-spec devices
                className={`w-full max-w-lg p-8 ${glassFallback}`}
                borderRadius={32}
                borderWidth={0.02}
                distortionScale={-180}
                opacity={0.8}
                backgroundOpacity={0.1}
            >
                <div className="flex flex-col items-center w-full">
                  {resetMessage ? (
                    <p className="text-center text-green-400">{resetMessage}</p>
                  ) : (
                    <>
                      <h2 className="text-2xl mb-6 text-center">{confirmedUser.name}</h2>
                      
                      <div className="relative w-full mb-4">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="PASSWORD"
                          autoFocus
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="font-press bg-black/40 border-2 border-white/50 rounded-xl p-3 w-full text-center outline-none focus:bg-black/60 focus:border-white text-white transition-all"
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
                        <p className="text-red-400 text-xs mb-4 text-center">
                          {error}
                        </p>
                      )}

                      {showResetLink && (
                        <button
                          onClick={handleForgotPassword}
                          className="text-xs text-blue-300 hover:text-white hover:underline mb-6 transition-colors"
                        >
                          Forgot Password?
                        </button>
                      )}

                      <div className="flex justify-between w-full gap-4 mt-2">
                        <button
                          onClick={handleBack}
                          className="flex-1 bg-transparent border-2 border-white/30 text-white rounded-xl py-3 text-sm hover:bg-white/10 transition"
                        >
                          BACK
                        </button>
                        <button
                          onClick={handleLogin}
                          disabled={loading}
                          className="flex-1 bg-white text-black rounded-xl py-3 text-sm font-bold hover:bg-gray-200 transition flex items-center justify-center disabled:opacity-75"
                        >
                          {loading ? <div className="spinner !border-black !border-t-transparent"></div> : "ENTER"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
            </GlassSurface>
        )}

      </div>
    </div>
  );
}