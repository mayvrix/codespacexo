import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase"; // Ensure this path matches your project structure
import TextPressure from "../comps/textPressure";
import ASCIIText from "../comps/asciitext";
import Aurora from "../comps/aurora";
import Logo from "../assets/xo.png";
import IntroNext from "./IntroNext"; 

export default function Intro() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- 1. Handle Window Resize for Mobile View ---
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- 2. Handle Auth Redirect (Auto-login) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/home");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  return (
    <>
      {/* Intro section */}
      <div
        className="w-full h-screen bg-black relative overflow-hidden text-white"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`
          ::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Aurora background */}
        <Aurora
          colorStops={["#3A29FF", "#FF94B4", "#FF3232"]}
          blend={0.9}
          amplitude={isMobile ? 0.3 : 1.0}
          speed={1}
        />

        {/* Content wrapper */}
        <div className="absolute top-0 left-0 z-10 w-full h-full flex flex-col items-center justify-center">
          {/* Logo */}
          <img
            src={Logo}
            alt="XO Logo"
            className="w-36 md:w-40 mb-16 md:mb-2"
            style={{
              marginTop: "-5rem",
            }}
          />

          {/* Main text area */}
          <div
            className="w-full flex flex-col items-center justify-center text-center px-6 md:px-0"
            style={{ lineHeight: "1.1" }}
          >
            {isMobile ? (
              /* FIXED: Added explicit height and relative positioning for ASCII to hook into */
              <div
                className="relative w-full h-48 flex items-center justify-center"
                style={{
                  transform: "scale(1.5)", 
                }}
              >
                <ASCIIText
                  text="CSXO"
                  enableWaves={false}
                  asciiFontSize={8}
                />
              </div>
            ) : (
              <TextPressure
                text="CODESPACEXO"
                flex
                alpha={false}
                stroke={false}
                width
                weight
                italic
                scale={false}
                textColor="#ffffff"
                strokeColor="#ff0000"
                minFontSize={120}
              />
            )}
          </div>

          {/* Visit button */}
          <button
            onClick={() => navigate("/entry")}
            className="font-doto font-bold mt-28 px-12 py-4 md:px-32 md:py-3 rounded-full bg-gray-100 text-black text-xl md:text-xl lg:text-2xl transition pointer-events-auto border border-transparent hover:bg-transparent hover:text-white hover:border-white"
          >
            visit
          </button>
        </div>
      </div>

      {/* Second section */}
      <IntroNext />
    </>
  );
}