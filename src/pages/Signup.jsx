import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";

// import logo
import Logo from "../assets/xo.png";

// --- ADDED SVG ICON COMPONENTS ---

// This is the "Eye" (On) icon
const EyeIcon = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

// This is the "Eye Slash" (Off) icon you provided
const EyeSlashIcon = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228"
    />
  </svg>
);
// --- END SVG ICONS ---


export default function SignUp() {
  const navigate = useNavigate();

  // State for form inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // State for UI feedback
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null); // To track focus for blue border
  
  // State for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault(); // Prevent form reload

    // --- Validation ---
    if (!name || !email || !password || !confirmPassword) {
      setError("All fields are required.");
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

    // --- Firebase Logic ---
    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save user details in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
      });

      // 3. Navigate to the home page on success
      navigate("/home");

    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError("Email is already registered.");
      } else {
        setError("Failed to create account. Please try again.");
      }
      console.error("Signup Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="text-white font-press flex flex-col items-center justify-center min-h-screen p-4"
      style={{ backgroundColor: "#000000ff" }} // GitHub black
    >
      {/* --- MODIFIED STYLE TAG --- */}
      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          .spinner {
            border: 3px solid rgba(0, 0, 0, 0.3); /* Light black/grey border */
            border-top-color: #000; /* Solid black for the spinning part */
            border-radius: 50%;
            width: 1.25rem; /* 20px */
            height: 1.25rem; /* 20px */
            animation: spin 1s linear infinite;
          }
        `}
      </style>

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-6">
        <img 
          src={Logo} 
          alt="XO Logo" 
          className="w-24 h-24 md:w-32 md:h-32 mb-0 object-contain"
        />
        <h1 className="text-2xl md:text-4xl tracking-wider text-center">CODESPACEXO</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSignUp} className="w-full max-w-xs sm:max-w-sm">
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Enter Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setFocusedInput('name')}
            onBlur={() => setFocusedInput(null)}
            className={`p-3 w-full text-sm outline-none border-2 ${focusedInput === 'name' ? 'border-blue-500' : 'border-white'}`}
            style={{ backgroundColor: "#0d1117", color: "white" }}
          />
          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
            className={`p-3 w-full text-sm outline-none border-2 ${focusedInput === 'email' ? 'border-blue-500' : 'border-white'}`}
            style={{ backgroundColor: "#000000ff", color: "white" }}
          />

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              className={`p-3 w-full text-sm outline-none border-2 pr-12 ${focusedInput === 'password' ? 'border-blue-500' : 'border-white'}`}
              style={{ backgroundColor: "#0d1117", color: "white" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center justify-center w-12 h-full text-white"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Confirm Password Input */}
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => setFocusedInput('confirm')}
              onBlur={() => setFocusedInput(null)}
              className={`p-3 w-full text-sm outline-none border-2 pr-12 ${focusedInput === 'confirm' ? 'border-blue-500' : 'border-white'}`}
              style={{ backgroundColor: "#0d1117", color: "white" }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 flex items-center justify-center w-12 h-full text-white"
              title={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && <p className="text-red-400 text-xs mt-4 text-center">{error}</p>}

        {/* Buttons (Increased gap) */}
        <div className="flex justify-between items-center mt-8">
          <button
            type="button"
            onClick={() => navigate("/")} // Navigate to login page
            className="bg-white text-black px-4 py-2 text-sm"
          >
            LOG IN?
          </button>
          
          {/* --- MODIFIED LOADING BUTTON --- */}
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black px-4 py-2 text-sm flex items-center justify-center disabled:opacity-75"
            // Set a min-width to match the text, or just let padding handle it
            // The spinner is small, so the py-2 and px-4 will keep the size consistent
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              "ENTER"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}