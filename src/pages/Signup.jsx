import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import Logo from "../assets/xoMod.png";
import Hyperspeed from '../comps/hyperspeed';
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
    
    // We delay monitoring by 1 second to ignore initial page load stutter
    const startMonitoring = setTimeout(() => {
      const checkFPS = () => {
        const now = performance.now();
        const delta = now - lastTime;
        lastTime = now;

        // If a frame takes longer than 50ms (meaning FPS is below 20)
        if (delta > 50) {
          lagCounter++;
        } else {
          // Slowly decrease counter if frames are smooth, so random spikes don't trigger it immediately
          lagCounter = Math.max(0, lagCounter - 0.5);
        }

        // If we hit 15 "lag points", assume the PC is struggling and disable animation
        if (lagCounter > 15) {
          setIsLowSpec(true);
          return; // Stop the loop
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

// --- SVG ICON COMPONENTS ---
const EyeIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeSlashIcon = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
  </svg>
);

// --- HYPERSPEED OPTIONS ---
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
    leftCars: [0xff322f, 0xa33010, 0xa81508], // Red theme
    rightCars: [0xfdfdf0, 0xf3dea0, 0xe2bb88],
    sticks: 0xfdfdf0
  }
};

const MemoizedHyperspeed = React.memo(Hyperspeed);

export default function SignUp() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isLowPerf = usePerformanceMonitor(); // Check for lag on PC

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- Helper for Email Validation ---
  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (!name.trim().includes(" ")) {
      setError("Please enter your full name (First & Last).");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        lastLogin: Date.now(),
      });

      navigate("/home");
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError("Email is already registered.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-doto font-bold text-white">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* If Mobile OR Low Performance PC, show black. Otherwise show Hyperspeed */}
        {isMobile || isLowPerf ? (
            <div className="w-full h-full bg-black" />
        ) : (
            <MemoizedHyperspeed effectOptions={hyperspeedOptions} />
        )}
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
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.5); background-clip: content-box; }
        `}
      </style>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 pb-24">
        
       {/* Header Section */}
       <div className="flex flex-col items-center mb-6">
         <img
           src={Logo}
           alt="XO Logo"
           className="w-24 h-24 md:w-32 md:h-32 mb-0 object-contain"
         />
       </div>

        {/* --- MAIN FORM CONTAINER --- */}
        <form onSubmit={handleSignUp} className="w-full max-w-lg flex flex-col gap-4">
            
            {/* Title Outside Glass */}
            <h2 className="text-2xl mb-2 text-center tracking-widest text-white">CREATE ACCOUNT</h2>

            {/* --- 4 SEPARATE GLASS INPUTS --- */}

            {/* 1. Name Input */}
            <GlassSurfaceXO
                className="w-full h-14"
                borderRadius={9999}
                borderWidth={0.02}
                distortionScale={-180}
                opacity={0.8}
                backgroundOpacity={0.1}
            >
                <div className="w-full h-full flex items-center justify-center px-4 py-2">
                    <input
                      type="text"
                      placeholder="FULL NAME"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-full bg-transparent font-doto font-bold text-lg text-center outline-none text-white placeholder-gray-400"
                    />
                </div>
            </GlassSurfaceXO>

            {/* 2. Email Input */}
            <GlassSurfaceXO
                className="w-full h-14"
                borderRadius={9999}
                borderWidth={0.02}
                distortionScale={-180}
                opacity={0.8}
                backgroundOpacity={0.1}
            >
                <div className="w-full h-full flex items-center justify-center px-4 py-2">
                    <input
                      type="email"
                      placeholder="EMAIL"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-full bg-transparent font-doto font-bold text-lg text-center outline-none text-white placeholder-gray-400"
                    />
                </div>
            </GlassSurfaceXO>

            {/* 3. Password Input */}
            <GlassSurfaceXO
                className="w-full h-14"
                borderRadius={9999}
                borderWidth={0.02}
                distortionScale={-180}
                opacity={0.8}
                backgroundOpacity={0.1}
            >
                <div className="w-full h-full flex items-center justify-center px-4 py-2 relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="PASSWORD"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-full bg-transparent font-doto font-bold text-lg text-center outline-none text-white placeholder-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-4 flex items-center"
                    >
                      {showPassword ? <EyeSlashIcon className="h-6 w-6 text-gray-300" /> : <EyeIcon className="h-6 w-6 text-gray-300" />}
                    </button>
                </div>
            </GlassSurfaceXO>

            {/* 4. Confirm Password Input */}
            <GlassSurfaceXO
                className="w-full h-14"
                borderRadius={9999}
                borderWidth={0.02}
                distortionScale={-180}
                opacity={0.8}
                backgroundOpacity={0.1}
            >
                <div className="w-full h-full flex items-center justify-center px-4 py-2 relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="CONFIRM PASSWORD"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-full bg-transparent font-doto font-bold text-lg text-center outline-none text-white placeholder-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-4 flex items-center"
                    >
                      {showConfirmPassword ? <EyeSlashIcon className="h-6 w-6 text-gray-300" /> : <EyeIcon className="h-6 w-6 text-gray-300" />}
                    </button>
                </div>
            </GlassSurfaceXO>

            {/* Error Message */}
            {error && <p className="text-red-400 text-sm font-bold text-center border border-red-500 rounded-full py-2 w-full bg-red-500/10">{error}</p>}


            {/* 5 & 6. BUTTONS ROW (Separated below) */}
            <div className="flex w-full gap-4 h-[70px] mt-2 items-center">
                
                {/* LOG IN CAPSULE (Glass 5) - Now a Button */}
                <button
                    type="button"
                    onClick={() => navigate("/entry")}
                    className="flex-1 h-full block group p-0 m-0 border-none bg-transparent outline-none appearance-none cursor-pointer"
                >
                     <GlassSurfaceXO
                        className="py-2 w-full h-full flex items-center justify-center"
                        borderRadius={9999}
                        borderWidth={0.02}
                        distortionScale={-180}
                        opacity={0.8}
                        backgroundOpacity={0.1}
                     >
                        <span className="text-xl tracking-wider group-hover:scale-105 transition-transform">LOG IN?</span>
                     </GlassSurfaceXO>
                </button>
                
                {/* ENTER CAPSULE (Glass 6) - Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-full block group p-0 m-0 border-none bg-transparent outline-none appearance-none cursor-pointer"
                >
                    <GlassSurfaceXO
                        className="py-2 w-full h-full flex items-center justify-center"
                        borderRadius={9999}
                        borderWidth={0.02}
                        distortionScale={-180}
                        opacity={0.8}
                        backgroundOpacity={0.1}
                     >
                         {loading ? (
                            <div className="spinner !border-white !border-t-transparent"></div>
                         ) : (
                            <span className="text-xl tracking-wider group-hover:scale-105 transition-transform">ENTER</span>
                         )}
                     </GlassSurfaceXO>
                </button>

            </div>

        </form>
      </div>
    </div>
  );
}