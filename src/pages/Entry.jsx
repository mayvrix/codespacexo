import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import Logo from "../assets/xo.png";

// --- Helper Components for Icons ---
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

// --- Helper Function for Name Formatting ---
const toTitleCase = (str) => {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

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
  
  // --- ADDED LOADING STATE ---
  const [loading, setLoading] = useState(false);

  const listRef = useRef(null);

  // Fetch and prepare users
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

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter((user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Keyboard navigation
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
            prev < filteredUsers.length - 1
              ? prev + 1
              : filteredUsers.length - 1
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
  }, [filteredUsers, selectedIndex, confirmedUser, password]); // Added password to deps

  // Auto-scroll user list
  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIndex]) {
      listRef.current.children[selectedIndex].scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex, filteredUsers]);

  // --- MODIFIED LOGIN HANDLER ---
  const handleLogin = async () => {
    if (!confirmedUser || !password) {
      setError("Enter password!");
      setShowResetLink(false);
      return;
    }
    
    setLoading(true); // <-- Set loading true
    
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
      setLoading(false); // <-- Set loading false
    }
  };

  // Forgot Password Handler
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
      console.error("Password Reset Error:", err);
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
    <div
      className="bg-black text-white font-press flex flex-col items-center 
               min-h-screen p-4 
               justify-center sm:justify-center
               pb-16"
    >
      {/* --- ADDED STYLE TAG FOR SPINNER --- */}
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

      <div className="w-full max-w-md">
        {!confirmedUser ? (
          <>
            <input
              type="text"
              placeholder="SEARCH USER..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="font-press border-2 border-white p-2 w-full text-left outline-none focus:bg-gray-800 mb-2 text-sm bg-black text-white"
            />
            <div
              ref={listRef}
              className="border-2 border-white h-52 overflow-y-auto relative scrollbar-thin scrollbar-thumb-white scrollbar-track-black"
            >
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => (
                  <div
                    key={user.uid}
                    onClick={() => setConfirmedUser(user)}
                    className={`p-2 cursor-pointer select-none ${
                      selectedIndex === index ? "bg-white text-black" : ""
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
                className="bg-white text-black px-4 py-2 text-sm"
              >
                SIGN UP
              </button>
              <button
                onClick={() => navigate("/public")}
                className="animated-gradient px-4 py-2 text-sm hover:brightness-110 transition"
              >
                PUBLIC
              </button>
            </div>
          </>
        ) : (
          <div className="border-2 border-white p-6 flex flex-col items-center">
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
                  
                  {/* --- MODIFIED LOADING BUTTON --- */}
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="bg-white text-black px-4 py-2 text-sm flex items-center justify-center disabled:opacity-75"
                  >
                    {loading ? (
                      <div className="spinner"></div>
                    ) : (
                      "ENTER"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}