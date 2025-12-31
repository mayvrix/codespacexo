import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { themes } from "./themes";

// Images
import BackLeftIcon from "../assets/backLeft.svg";
import PencilIcon from "../assets/Pencil.svg";

export default function Control() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({ name: "", email: "", theme: 0 });
  
  // Edit State
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Password Reset State
  const [resetMessage, setResetMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        navigate("/login");
        return;
      }
      setUser(u);
      
      // Fetch User Data
      const docRef = doc(db, "users", u.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData({
            name: data.name || u.displayName || "User",
            email: data.email || u.email,
            theme: data.theme !== undefined ? data.theme : 0
        });
        setNewName(data.name || u.displayName || "User");
      } else {
        // Create default if not exists
        const initData = {
            name: u.displayName || "User",
            email: u.email,
            theme: 0,
            uid: u.uid
        };
        await setDoc(docRef, initData);
        setUserData(initData);
        setNewName(initData.name);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // --- REAL-TIME UNIQUENESS CHECK ---
  useEffect(() => {
    if (!showEditDialog || !newName.trim()) return;

    if (newName.trim().toLowerCase() === userData.name.toLowerCase()) {
        setNameError("");
        setIsChecking(false);
        return;
    }

    setIsChecking(true);
    setNameError("");

    const timeoutId = setTimeout(async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const targetName = newName.trim().toLowerCase();
            let isTaken = false;

            querySnapshot.forEach((doc) => {
                const existingName = (doc.data().name || "").toLowerCase();
                if (existingName === targetName && doc.id !== user.uid) {
                    isTaken = true;
                }
            });

            if (isTaken) {
                setNameError("Username already exists.");
            } else {
                setNameError("");
            }
        } catch (error) {
            console.error("Check failed:", error);
            setNameError("Error checking availability.");
        } finally {
            setIsChecking(false);
        }
    }, 500); 

    return () => clearTimeout(timeoutId);
  }, [newName, showEditDialog, userData.name, user]);

  const handleThemeChange = async (index) => {
    if (!user) return;
    setUserData(prev => ({ ...prev, theme: index }));
    await updateDoc(doc(db, "users", user.uid), { theme: index });
  };

  const handleOpenEdit = () => {
    setNewName(userData.name);
    setNameError("");
    setIsChecking(false);
    setShowEditDialog(true);
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    if (nameError || isChecking || !newName.trim()) return;

    setIsSaving(true);

    try {
        const trimmedName = newName.trim();
        await updateDoc(doc(db, "users", user.uid), { name: trimmedName });
        setUserData(prev => ({ ...prev, name: trimmedName }));
        setShowEditDialog(false);
    } catch (error) {
        console.error("Error saving name:", error);
        setNameError("Failed to save.");
    } finally {
        setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) return;
    try {
        await sendPasswordResetEmail(auth, user.email);
        setResetMessage("Reset link sent to email!");
        setTimeout(() => setResetMessage(""), 3000);
    } catch (error) {
        console.error(error);
        setResetMessage("Error sending email.");
    }
  };

  const currentTheme = themes[userData.theme] || themes[0];
  const isDarkTheme = userData.theme < 9;

  return (
    <div className="min-h-screen p-6 font-press flex flex-col items-center transition-colors duration-300" style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}>
      
      {/* Header */}
      <div className="w-full max-w-2xl grid grid-cols-[1fr_auto_1fr] items-center mb-10">
        <div className="justify-self-start">
            <button 
                onClick={() => window.history.back()} 
                className="p-3 rounded-full hover:opacity-80 transition group"
                style={{ backgroundColor: currentTheme.panel }}
            >
                <img src={BackLeftIcon} className="w-6 h-6 transition group-hover:scale-110" style={{ filter: isDarkTheme ? 'invert(1)' : 'none' }} alt="Back" />
            </button>
        </div>
        
        <div 
            className="px-8 py-3 rounded-full border tracking-widest text-lg font-bold shadow-lg" 
            style={{ backgroundColor: currentTheme.panel, color: currentTheme.accent, borderColor: currentTheme.border }}
        >
            CODESPACEXO
        </div>
        
        <div className="justify-self-end"></div>
      </div>

      {/* Profile Card */}
      <div 
        className="w-full max-w-2xl border rounded-3xl p-8 mb-12 relative overflow-hidden shadow-2xl transition-all"
        style={{ backgroundColor: currentTheme.panel, borderColor: currentTheme.border }}
      >
        <div className="absolute top-0 left-0 w-full h-3" style={{ backgroundColor: currentTheme.accent }}></div>
        
        <div className="flex justify-between items-start mt-4">
            <div className="flex flex-col gap-3">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-wide mb-2" style={{ color: currentTheme.text }}>{userData.name}</h2>
                    <p className="text-xs md:text-lg font-doto tracking-wider" style={{ color: currentTheme.text, opacity: 0.7 }}>{userData.email}</p>
                </div>
                
                {/* <div>
                    <button 
                        onClick={handlePasswordReset} 
                        className="text-[10px] md:text-xs px-4 py-2 rounded-lg border-2 transition-all hover:opacity-70 font-bold tracking-wider uppercase"
                        style={{ borderColor: currentTheme.accent, color: currentTheme.accent }}
                    >
                        Change Password
                    </button>
                    {resetMessage && <span className="block mt-2 text-[10px] animate-pulse" style={{ color: currentTheme.accent }}>{resetMessage}</span>}
                </div> */}
            </div>
            
            <button 
                onClick={handleOpenEdit}
                className="px-6 py-4 rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg hover:brightness-110"
                style={{ backgroundColor: currentTheme.accent }}
                title="Edit Profile"
            >
                <img src={PencilIcon} className="w-5 h-5" style={{ filter: isDarkTheme ? 'none' : 'invert(1)' }} alt="edit" />
            </button>
        </div>
      </div>

      {/* Themes Section */}
      <div className="w-full max-w-2xl">
        <h3 className="text-lg mb-6 tracking-widest" style={{ color: currentTheme.text }}>THEMES</h3>
        <div className="grid grid-cols-3 gap-4">
            {themes.map((t) => (
                <button
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className={`h-20 rounded-2xl border-2 transition-all relative overflow-hidden group`}
                    style={{ 
                        backgroundColor: t.bg, 
                        borderColor: userData.theme === t.id ? t.accent : (isDarkTheme ? '#333' : '#ddd')
                    }}
                >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition"></div>
                    
                    {userData.theme === t.id && (
                        <div className="absolute top-2 right-2 w-3 h-3 rounded-full" style={{ backgroundColor: t.accent, boxShadow: `0 0 10px ${t.accent}` }}></div>
                    )}
                    
                    <div className="absolute bottom-0 w-full h-1/2" style={{ backgroundColor: t.panel }}></div>
                </button>
            ))}
        </div>
      </div>

      {/* --- FLOATING EDIT DIALOG --- */}
      {showEditDialog && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[9999]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="border p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-fade-in" style={{ backgroundColor: currentTheme.panel, borderColor: currentTheme.border }}>
                <h3 className="text-lg mb-4 text-center tracking-wide" style={{ color: currentTheme.text }}>Change User Name?</h3>
                
                <form onSubmit={handleSaveName} className="flex flex-col gap-4">
                    <input 
                        type="text" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)}
                        className={`text-center text-lg rounded-full py-3 px-6 focus:outline-none focus:ring-2 font-bold transition-all`}
                        style={{ 
                            backgroundColor: currentTheme.container, 
                            color: currentTheme.text,
                            borderColor: nameError ? 'red' : currentTheme.border 
                        }}
                        placeholder="Enter name..."
                        autoFocus
                    />
                    
                    <div className="h-4 text-center">
                        {isChecking ? (
                            <span className="text-xs font-sans animate-pulse" style={{ color: currentTheme.accent }}>Checking availability...</span>
                        ) : nameError ? (
                            <span className="text-red-500 text-xs font-sans">{nameError}</span>
                        ) : null}
                    </div>

                    <div className="flex justify-end gap-3 mt-2">
                        <button 
                            type="button" 
                            onClick={() => setShowEditDialog(false)} 
                            className="px-6 py-2 rounded-full border transition text-xs"
                            style={{ 
                                borderColor: currentTheme.border, 
                                color: currentTheme.text,
                                opacity: 0.7 
                            }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving || isChecking || !!nameError || !newName.trim() || newName === userData.name}
                            className={`px-8 py-2 rounded-full border text-xs font-bold transition ${
                                (isSaving || isChecking || !!nameError || !newName.trim() || newName === userData.name)
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:opacity-80'
                            }`}
                            style={{ 
                                backgroundColor: currentTheme.accent, 
                                color: isDarkTheme ? 'black' : 'white',
                                borderColor: currentTheme.accent
                            }}
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}