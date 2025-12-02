import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- 1. IMPORTED useNavigate
import dragdrop from "../assets/dragdrop.mp4";
import publicVid from "../assets/public.mp4";
import pdfimage from "../assets/files.mp4";
import note from "../assets/notes.mp4";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function IntroNext() {
  const [userCount, setUserCount] = useState(null);
  const navigate = useNavigate(); // <-- 2. INITIALIZED useNavigate

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        setUserCount(snapshot.size); // total number of users in Firestore
      } catch (error) {
        console.error("Error fetching user count:", error);
      }
    };
    fetchUserCount();
  }, []);

  return (
    <div className="w-full bg-black text-white overflow-hidden">

      {/* ---------- PAGE 1 ---------- */}
      <section className="w-full h-screen flex flex-col md:flex-row items-center justify-center relative">
        {/* Video Section - 65% width on desktop */}
        <div className="relative w-full md:w-[65%] h-1/2 md:h-full">
          <video
            src={dragdrop}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            loading="lazy"
            className="w-full h-full object-cover"
            poster="https://via.placeholder.com/800x600/000000/FFFFFF?text=Loading+Video..."
          ></video>

          {/* Gradient overlay for fade effect */}
          <div
            className="absolute inset-0 pointer-events-none 
            bg-gradient-to-b md:bg-gradient-to-r 
            from-transparent to-black"
          ></div>
        </div>

        {/* Text Section - 35% width on desktop */}
        <div className="w-full md:w-[35%] h-1/2 md:h-full flex flex-col items-center md:items-start justify-center text-center md:text-right px-6 md:px-12">
          <h2 className="text-4xl md:text-6xl font-bold font-doto mb-6 text-white/90">
            Your Code One Drop Away
          </h2>
          <p className="text-lg md:text-2xl text-white/70 max-w-xl font-doto">
            Effortlessly organize your workspace — just drag and drop your code files, projects, or entire folders to start building instantly.
          </p>
        </div>
      </section>

      {/* ---------- PAGE 2 ---------- */}
      <section className="w-full h-screen flex flex-col md:flex-row items-center justify-center relative">
        {/* Video Section - top on mobile, right on desktop */}
        <div className="relative order-1 md:order-2 w-full md:w-[65%] h-1/2 md:h-full">
          <video
            src={publicVid}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            loading="lazy"
            className="w-full h-full object-cover"
            poster="https://via.placeholder.com/800x600/000000/FFFFFF?text=Loading+Video..."
          ></video>

          {/* Gradient overlay - same fade style as Page 1 */}
          <div
            className="absolute inset-0 pointer-events-none 
            bg-gradient-to-b md:bg-gradient-to-l 
            from-transparent to-black"
          ></div>
        </div>

        {/* Text Section - bottom on mobile, left on desktop */}
        <div className="order-2 md:order-1 w-full md:w-[35%] h-1/2 md:h-full flex flex-col items-center md:items-end justify-center text-center md:text-left px-6 md:px-12">
          <h2 className="text-4xl md:text-6xl font-bold font-doto mb-6 text-white/90">
            Code Sharing Made Effortless
          </h2>
          <p className="text-lg md:text-2xl text-white/70 max-w-xl font-doto">
            Publish your files for everyone to access — no login needed. You can also log in to download your code files or even the entire project as a ZIP with a single click.
          </p>
        </div>
      </section>

        {/* ---------- PAGE 3 ---------- */}
      <section className="w-full h-screen flex flex-col md:flex-row items-center justify-center relative">
        {/* Video Section - 65% width on desktop */}
        <div className="relative w-full md:w-[65%] h-1/2 md:h-full">
          <video
            src={pdfimage}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            loading="lazy"
            className="w-full h-full object-cover"
            poster="https://via.placeholder.com/800x600/000000/FFFFFF?text=Loading+Video..."
          ></video>

          {/* Gradient overlay for fade effect */}
          <div
            className="absolute inset-0 pointer-events-none 
            bg-gradient-to-b md:bg-gradient-to-r 
            from-transparent to-black"
          ></div>
        </div>

        {/* Text Section - 35% width on desktop */}
        <div className="w-full md:w-[35%] h-1/2 md:h-full flex flex-col items-center md:items-start justify-center text-center md:text-right px-6 md:px-12">
    <h2 className="text-4xl md:text-6xl font-bold font-doto mb-6 text-white/90">
      Upload PDF & Image
    </h2>
    <p className="text-lg md:text-2xl text-white/70 max-w-xl font-doto leading-relaxed">
      Effortlessly upload your <span className="text-white font-semibold">PDFs</span> (max <span className="text-white font-semibold">3&nbsp;MB</span> each)
      and <span className="text-white font-semibold">images</span> (max <span className="text-white font-semibold">1&nbsp;MB</span> per file).  
      Instantly preview your documents and pictures — right inside the website with our built-in PDF & image viewer.
    </p>
  </div>
      </section>


     {/* ---------- PAGE 4 ---------- */}
<section className="w-full h-screen flex flex-col md:flex-row items-center justify-center relative">
  {/* Video Section - top on mobile, right on desktop */}
  <div className="relative order-1 md:order-2 w-full md:w-[70%] h-1/2 md:h-full">
    <video
      src={note}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      crossOrigin="anonymous"
      loading="lazy"
      className="w-full h-full object-cover"
      poster="https://via.placeholder.com/800x600/000000/FFFFFF?text=Loading+Video..."
    ></video>

    {/* Gradient overlay */}
    <div
      className="absolute inset-0 pointer-events-none 
      bg-gradient-to-b md:bg-gradient-to-l 
      from-transparent to-black"
    ></div>
  </div>

  {/* Text Section - bottom on mobile, left on desktop */}
  <div className="order-2 md:order-1 w-full md:w-[30%] h-1/2 md:h-full flex flex-col items-center md:items-end justify-center text-center md:text-left px-6 md:px-12">
    <h2 className="text-4xl md:text-6xl font-bold font-doto mb-6 text-white/90">
      Create Instant Notes
    </h2>
    <p className="text-lg md:text-2xl text-white/70 max-w-xl font-doto">
      Write or paste your code and save it instantly — no setup, no delay. Perfect for quick snippets, ideas, or debugging notes you can revisit anytime.
    </p>
  </div>
</section>


 {/* ---------- PAGE 5 ---------- */}
<section className="w-full h-screen flex flex-col items-center justify-center text-center px-6 md:px-12">
  <h2 className="text-4xl md:text-7xl font-bold font-doto mb-6 text-white/90">
    Website in Beta Stage
  </h2>

  <p className="text-lg md:text-2xl text-white/70 font-doto max-w-2xl mb-6">
    Explore and try out{" "}
    <span className="text-white/90 font-semibold">CODESPACEXO</span> — we’re
    still in beta, so your feedback and bug reports help us make it better for
    everyone.
  </p>

  {/* 🔥 Added Line for Total Users */}
  {userCount !== null && (
    <p className="text-white/80 font-doto text-xl mb-10">
      🔥 <span className="font-semibold">{userCount}</span>{" "}
      {userCount === 1 ? "user is" : "users are"} already using it.
    </p>
  )}

  {/* --- 3. UPDATED BUTTON SECTION (What's New + Feedback) --- */}
  <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-10 w-full max-w-xs md:max-w-none">
    {/* What's New Button */}
    <button
      onClick={() => navigate("/update")}
      className="font-doto font-bold w-full md:w-auto px-12 py-3 md:px-20 md:py-3 rounded-full bg-gray-100 text-black text-xl transition border border-transparent hover:bg-black hover:text-white hover:border-white"
    >
      What's New?
    </button>

    {/* Feedback Button */}
    <button
      onClick={() => navigate("/feedback")}
      className="font-doto font-bold w-full md:w-auto px-12 py-3 md:px-20 md:py-3 rounded-full bg-gray-100 text-black text-xl transition border border-transparent hover:bg-black hover:text-white hover:border-white"
    >
      Feedback?
    </button>
  </div>
  {/* --- END OF BUTTON SECTION --- */}

  {/* Mayvrix Link */}
  <a
    href="https://mayvrixstudio.web.app/"
    target="_blank"
    rel="noopener noreferrer"
    className="text-white/60 hover:text-white transition-colors text-lg font-doto"
  >
    Made by MAYVRIX
  </a>
</section>




    </div>
  );
}