import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { supabase } from "../supabase";
import { themes } from "./themes";
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  writeBatch,
  updateDoc
} from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// import icons
import BackLeftIcon from "../assets/backLeft.svg";
import UserIcon from "../assets/user.svg";
import FolderIcon from "../assets/folder.svg";
import DownloadIcon from "../assets/download.svg";
import DeleteIcon from "../assets/delete.svg";
import BackIcon from "../assets/back.svg";
import StarOnIcon from "../assets/star on.svg";
import StarOffIcon from "../assets/star off.svg";
import AddFolderIcon from '../assets/addFolder.svg';
import AddNoteIcon from '../assets/addNote.svg';
import AddFileIcon from '../assets/addFile.svg';
import CopyIcon from '../assets/copy.svg';
import RenameIcon from '../assets/addNote.svg';
import EditIcon from '../assets/edit.svg';
import XOIcon from '../assets/xoMod.png';

// --- ADDED FOR DATE SORTING ---
const monthMap = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
};
// Regex finds: (day)(month) OR (month)(day) with optional separators
const dateRegex = /\b(?:(\d{1,2})[.\s\-_]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:ember|uary|ch|il|e|y|t|ust)?|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:ember|uary|ch|il|e|y|t|ust)?[.\s\-_]?(\d{1,2}))\b/i;

const parseDateFromName = (name) => {
    const match = name.match(dateRegex);
    if (!match) return null;

    const dayStr = match[1] || match[4];
    let monthStr = (match[2] || match[3])?.toLowerCase();
    
    if (!dayStr || !monthStr) return null;

    // Find the full month name key (e.g., "oct" -> "october")
    let monthKey = Object.keys(monthMap).find(key => key.startsWith(monthStr));
    const month = monthMap[monthKey];
    const day = parseInt(dayStr, 10);
    
    if (month === undefined || isNaN(day) || day < 1 || day > 31) {
        return null;
    }
    
    // Use a consistent year (e.g., 2000) for stable sorting
    // We only care about month/day order
    return new Date(2000, month, day).getTime();
};
// --- END ADDED FOR DATE SORTING ---


export default function Home() {
  const [currentTheme, setCurrentTheme] = useState(themes[0]); // Default theme

  // --- INTRO / SPLASH SCREEN STATE ---
  const [showIntro, setShowIntro] = useState(true); // Is the intro visible?
  const [introOpacity, setIntroOpacity] = useState(1); // For the fade-out effect
  const [introName, setIntroName] = useState(""); // To store "Tanmay"
  const [splashProgress, setSplashProgress] = useState(0); // NEW: For the progress bar

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(""); // empty = root
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [folderContextMenu, setFolderContextMenu] = useState(null); // For folder-specific actions
  const [user, setUser] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState(""); // <-- ADDED for PDF/Image URLs
  const [starred, setStarred] = useState({});
  const [snackbar, setSnackbar] = useState({ message: "", show: false });
  const navigate = useNavigate();
  // --- REPLACEMENT FOR OLD SNACKBAR & NEW PROGRESS STATE ---
  const [toasts, setToasts] = useState([]); // Stores multiple notifications
  // activeProgress example: { type: 'Upload', current: 5, total: 10, label: 'Uploading files...' }
  const [activeProgress, setActiveProgress] = useState(null); 

  // Helper to determine icon color based on theme (0-8 are Dark, 9+ are Light)
  const isDarkTheme = currentTheme.id < 9;
  const iconFilter = isDarkTheme ? 'invert(1)' : 'none';

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, completed: 0 });

  const [showDeleteDialog, setShowDeleteDialog] = useState({ show: false, item: null, type: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ total: 0, completed: 0 });

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ total: 0, completed: 0 });

  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  const [showCreateFileDialog, setShowCreateFileDialog] = useState(false);
  const [createFileStep, setCreateFileStep] = useState('name');
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [validatedFileName, setValidatedFileName] = useState("");

  //rename
  const [showRenameDialog, setShowRenameDialog] = useState({ show: false, item: null, type: '' });
  const [newName, setNewName] = useState("");
  const [fileContextMenu, setFileContextMenu] = useState(null); // For file-specific actions
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameProgress, setRenameProgress] = useState({ total: 0, completed: 0 });

  // --- Removed all state and refs for pinch-to-zoom ---

  const touchTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const fileInputRef = useRef(null);

// --- NEW STATE FOR SELECTION & WINDOW ---
  const [windows, setWindows] = useState([]);
  const [zCounter, setZCounter] = useState(100); 
  const [activeDrag, setActiveDrag] = useState(null); 
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  
  // New State for View Mode
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Refs
  const containerRef = useRef(null);

  // --- WINDOW MANAGEMENT ---
  
  const focusWindow = (id) => {
    setZCounter(prev => prev + 1);
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: zCounter + 1 } : w));
    setContextMenu(null);
    setFolderContextMenu(null);
    setFileContextMenu(null);
  };

  // OPEN FILE
  const openFile = async (file) => {
    setContextMenu(null);
    setFolderContextMenu(null);
    setFileContextMenu(null);

    const existing = windows.find(w => w.file.fullPath === file.fullPath);
    if (existing) {
        focusWindow(existing.id);
        return;
    }

    const docId = btoa(file.fullPath);
    const newZ = zCounter + 1;
    setZCounter(newZ);

    // --- MOBILE DETECTION LOGIC ---
    // If mobile, force full screen and locked position
    const isMobile = window.innerWidth < 768;

    const newWindow = {
        id: docId,
        file: file,
        x: isMobile ? 0 : 50 + (windows.length * 30),
        y: isMobile ? 0 : 50 + (windows.length * 30),
        w: isMobile ? '100%' : 600, 
        h: isMobile ? '100%' : 400,
        isMaximized: isMobile, // Force maximize on start for mobile
        isMobileMode: isMobile, // Flag to disable window controls
        zIndex: newZ,
        content: "Loading...",
        url: null
    };

    setWindows(prev => [...prev, newWindow]);

    // Fetch Content
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    let content = "";
    let url = null;

    if (['.png', '.jpeg', '.jpg', '.svg', '.gif', '.pdf'].includes(ext)) {
        const { data } = supabase.storage.from("files").getPublicUrl(file.fullPath);
        url = data.publicUrl;
    } else {
        try {
            const { data, error } = await supabase.storage.from("files").download(file.fullPath);
            if (!error && data) {
                content = await data.text();
            } else {
                content = "Error loading content.";
            }
        } catch (e) {
            content = "Error loading content.";
        }
    }

    setWindows(prev => prev.map(w => w.id === docId ? { ...w, content, url } : w));
  };

  const closeWindow = (id) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  const toggleMaximize = (id) => {
    // Prevent un-maximizing on mobile
    if (window.innerWidth < 768) return; 
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  };

  // --- MOUSE HANDLERS ---

  const handleMouseDown = (e, windowId, type) => {
    e.stopPropagation();
    e.preventDefault();
    
    // --- DISABLE DRAG/RESIZE ON MOBILE ---
    if (window.innerWidth < 768) return;

    setContextMenu(null);
    setFolderContextMenu(null);
    setFileContextMenu(null);
    focusWindow(windowId);
    
    const targetWindow = windows.find(w => w.id === windowId);
    if (!targetWindow) return;

    setActiveDrag({
        type: type,
        id: windowId,
        startX: e.clientX,
        startY: e.clientY,
        initX: targetWindow.x,
        initY: targetWindow.y,
        initW: targetWindow.w,
        initH: targetWindow.h
    });
  };

  const handleMouseMove = (e) => {
    if (!activeDrag) return;
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();

    const dx = e.clientX - activeDrag.startX;
    const dy = e.clientY - activeDrag.startY;

    setWindows(prev => prev.map(w => {
        if (w.id !== activeDrag.id) return w;
        if (w.isMaximized) return w;

        if (activeDrag.type === 'move') {
            let newX = activeDrag.initX + dx;
            let newY = activeDrag.initY + dy;

            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX + w.w > bounds.width) newX = bounds.width - w.w;
            if (newY + w.h > bounds.height) newY = bounds.height - w.h;

            return { ...w, x: newX, y: newY };
        } 
        else if (activeDrag.type === 'resize') {
            let newW = Math.max(300, activeDrag.initW + dx);
            let newH = Math.max(200, activeDrag.initH + dy);

            if (w.x + newW > bounds.width) newW = bounds.width - w.x;
            if (w.y + newH > bounds.height) newH = bounds.height - w.y;

            return { ...w, w: newW, h: newH };
        }
        return w;
    }));
  };

  const handleMouseUp = () => {
    setActiveDrag(null);
  };

  // This replaces your old showSnackbar so you don't have to change logic elsewhere
  const showSnackbar = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Helper to remove a specific toast manually (optional)
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- SYNC EXISTING LOADING STATES TO PROGRESS BAR ---
  // This effect listens to your existing upload/delete/download states 
  // and updates the bottom-left progress bar automatically.
  useEffect(() => {
    if (isUploading) {
        setActiveProgress({ 
            type: 'Upload', 
            current: uploadProgress.completed, 
            total: uploadProgress.total, 
            label: `Uploading ${uploadProgress.completed}/${uploadProgress.total}` 
        });
    } else if (isDownloading) {
        setActiveProgress({ 
            type: 'Download', 
            current: downloadProgress.completed, 
            total: downloadProgress.total, 
            label: `Downloading ${downloadProgress.completed}/${downloadProgress.total}` 
        });
    } else if (isDeleting) {
        setActiveProgress({ 
            type: 'Delete', 
            current: deleteProgress.completed, 
            total: deleteProgress.total, 
            label: `Deleting ${deleteProgress.completed}/${deleteProgress.total}` 
        });
    } else {
        setActiveProgress(null);
    }
  }, [isUploading, uploadProgress, isDownloading, downloadProgress, isDeleting, deleteProgress]);

  // --- HANDLE LAYOUT CHANGE & SAVE ---
  const changeViewMode = async (mode) => {
    setViewMode(mode); // Update UI immediately
    if (user) {
      try {
        // Save to Firestore users collection
        const docRef = doc(db, "users", user.uid);
        // Using setDoc with merge ensures it works even if the user doc doesn't exist yet
        await setDoc(docRef, { layout: mode }, { merge: true }); 
      } catch (error) {
        console.error("Failed to save layout preference:", error);
      }
    }
  };

 useEffect(() => {
  if (user) {
    const fetchTheme = async () => {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.theme !== undefined && themes[data.theme]) {
                setCurrentTheme(themes[data.theme]);
            }
            // (Optional) Restore layout preference here too if you want
            if (data.layout) {
                 setViewMode(data.layout);
            }
        }
        
        // --- ADD THIS TO FIX THE STUCK SPLASH SCREEN ---
        setTimeout(() => {
            setIntroOpacity(0); // Fade out
            setTimeout(() => setShowIntro(false), 500); // Remove from DOM
        }, 1000);
    };
    fetchTheme();
  }
}, [user]);

  // --- NEW: ANIMATE SPLASH PROGRESS BAR ---
  useEffect(() => {
    if (showIntro) {
      const interval = setInterval(() => {
        setSplashProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 1.5; // Adjust speed: higher number = faster
        });
      }, 20); // Runs every 20ms

      return () => clearInterval(interval);
    }
  }, [showIntro]);
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/login");
      else setUser(u);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);


  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: listData, error: listError } = await supabase.storage
      .from("files")
      .list(user.uid + "/" + (currentFolder ? currentFolder + "/" : ""), {
        limit: 1000, // <--- FIX 1: Increased limit from 100 to 1000
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      console.error("Fetch Folders Error:", listError);
    } else {
      const foldersOnly = listData.filter(
        (d) => d.id === null && !d.name.includes(".placeholder")
      );

      // --- FIX 2: ADDED FOLDER SORTING ---
      foldersOnly.sort((a, b) => {
        const dateA = parseDateFromName(a.name);
        const dateB = parseDateFromName(b.name);
  
        // Case 1: Both are dates
        if (dateA !== null && dateB !== null) {
            return dateA - dateB; // Sort chronologically
        }
        
        // Case 2: Only A is a date
        if (dateA !== null && dateB === null) {
            return 1; // Put dates after non-dates
        }
  
        // Case 3: Only B is a date
        if (dateA === null && dateB !== null) {
            return -1; // Put dates after non-dates
        }
  
        // Case 4: Neither is a date
        return a.name.localeCompare(b.name); // Sort alphabetically
      });
      // --- END ADDED FOLDER SORTING ---

      setFolders(foldersOnly);
    }

    // --- !! START CRUCIAL FIX FOR MISSING FILES !! ---
    // The original code only queried Firestore for files.
    // This new logic queries Supabase, then merges with Firestore metadata.
    
    // 1. Get files from Supabase list (which was already fetched in listData)
    const filesFromSupabase = listData
      .filter(d => d.id !== null && d.name !== '.placeholder') // d.id is null for folders
      .map(file => ({
        name: file.name,
        fullPath: `${user.uid}/${currentFolder ? currentFolder + "/" : ""}${file.name}`
      }));

    // 2. Get all corresponding metadata docs from Firestore
    const filesQuery = query(
      collection(db, 'files'),
      where('uid', '==', user.uid),
      where('folder', '==', currentFolder)
    );
    const querySnapshot = await getDocs(filesQuery);
    const firestoreDataMap = new Map();
    querySnapshot.forEach((doc) => {
      // doc.id is btoa(fullPath)
      firestoreDataMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // 3. Merge lists and self-heal missing Firestore docs
    const backgroundPromises = []; // To run setDoc in background
    const mergedFiles = filesFromSupabase.map(supaFile => {
      const docId = btoa(supaFile.fullPath);
      const firestoreFile = firestoreDataMap.get(docId);

      if (firestoreFile) {
        // Data is consistent, use the full data from Firestore
        return firestoreFile;
      } else {
        // File exists in Supabase but NOT Firestore.
        // Create the missing Firestore doc to "heal" data.
        const newDocRef = doc(db, "files", docId);
        const newDocData = {
          uid: user.uid,
          name: supaFile.name,
          folder: currentFolder,
          createdAt: Date.now(), // Best guess for creation time
          fullPath: supaFile.fullPath,
          isClipboard: false, // Assume old files aren't clipboards
        };
        
        // Add the "set" operation to background tasks
        backgroundPromises.push(
          setDoc(newDocRef, newDocData).catch(err => {
            console.error("Failed to auto-create missing Firestore doc:", err);
          })
        );
        
        // Return the new data so it appears in the UI immediately
        return { ...newDocData, id: docId };
      }
    });

    // We don't await this, let it run in the background
    Promise.all(backgroundPromises);
    
    // --- !! END CRUCIAL FIX !! ---
    
    // --- MODIFIED SORTING LOGIC (now uses mergedFiles) ---
    mergedFiles.sort((a, b) => {
        const dateA = parseDateFromName(a.name);
        const dateB = parseDateFromName(b.name);

        // Case 1: Both are dates
        if (dateA !== null && dateB !== null) {
            return dateA - dateB; // Sort chronologically
        }
        
        // Case 2: Only A is a date
        if (dateA !== null && dateB === null) {
            return 1; // Put dates after non-dates
        }

        // Case 3: Only B is a date
        if (dateA === null && dateB !== null) {
            return -1; // Put dates after non-dates
        }

        // Case 4: Neither is a date
        return a.name.localeCompare(b.name); // Sort alphabetically
    });
    // --- END MODIFIED SORTING LOGIC ---

    setFiles(mergedFiles); // <-- Set the corrected, merged list

    await fetchStarred();
    setLoading(false);
  };

  const fetchStarred = async () => {
    // --- MODIFIED FUNCTION TO PREVENT CONFLICTS ---
    if (!user) return; // Add guard
    const q = query(collection(db, "publicFiles"), where("usr", "==", user.uid));
    const snap = await getDocs(q);
    let stars = {};
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.expiresAt > Date.now()) {
        // docSnap.id is the btoa(file.fullPath), which is unique
        stars[docSnap.id] = true;
      }
    });
    setStarred(stars);
    // --- END MODIFIED FUNCTION ---
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user, currentFolder]);

  const handleTouchStart = (e, folder) => {
    longPressTriggeredRef.current = false;
    clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        const touch = e.touches[0];
        setContextMenu(null);
        setFolderContextMenu({ x: touch.pageX, y: touch.pageY, folder });
    }, 700);
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimerRef.current);
  };

  const handleLogout = async () => {
    await auth.signOut();
    window.location.href = "/";
  };

  const handleBack = () => {
    if (!currentFolder) return;
    const parts = currentFolder.split("/").filter(Boolean);
    parts.pop();
    setCurrentFolder(parts.join("/"));
  };

  const allowedExt = [
      ".html", ".htm", ".css", ".scss", ".sass", ".less", ".js", ".jsx",
      ".ts", ".tsx", ".json", ".json5", ".xml", ".yaml", ".yml", ".vue",
      ".py", ".rb", ".php", ".java", ".c", ".cpp", ".cs", ".go", ".rs",
      ".kt", ".kts", ".dart", ".swift", ".m", ".mm", ".sh", ".bash",
      ".ps1", ".pl", ".r", ".jl", ".sql", ".sqlite", ".db", ".mdb", ".accdb",
      ".md", ".markdown", ".toml", ".ini", ".cfg", ".config", ".env",
      ".dockerfile", ".gitignore", ".gitattributes", ".editorconfig",
      ".yarnrc", ".npmrc", ".babelrc", ".txt", ".rtf",
      ".odt", ".gradle", ".gradle.kts", ".makefile", ".mk", ".bat", ".cmd",
      ".lock", ".log", ".ipynb", ".csv", ".tsv", ".jsonc",
      ".asm", ".s", ".inc",
      // --- ADDED ---
      ".pdf", ".png", ".jpeg", ".svg", ".jpg",
  ];

  const countEntries = async (entry) => {
    if (entry.isFile) {
      try {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        
        if (!file.name.includes('.')) return 1; 
        
        if (!allowedExt.includes(ext)) return 0;

        if (ext === '.png' || ext === '.jpeg' || ext === '.jpg') {
            if (file.size > 1048576) return 0;
        }
        
        return 1;
      } catch (e) {
        return 0;
      }
    } else if (entry.isDirectory) {
      let count = 0;
      const reader = entry.createReader();
      const readEntriesPromise = () => new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      let entries;
      while ((entries = await readEntriesPromise()).length > 0) {
        const counts = await Promise.all(entries.map(e => countEntries(e)));
        count += counts.reduce((acc, val) => acc + val, 0);
      }
      return count;
    }
    return 0;
  };

  const uploadEntry = async (entry, basePath) => {
    if (entry.isFile) {
      try {
        const file = await new Promise((resolve, reject) =>
          entry.file(resolve, reject)
        );
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        
        if (file.name.includes('.') && !allowedExt.includes(ext)) return;
        
        if (ext === '.png' || ext === '.jpeg' || ext === '.jpg') {
            if (file.size > 1048576) {
                showSnackbar(`Skipped ${file.name}: Image > 1MB`);
                return;
            }
        }
        
        const path = user.uid + "/" + basePath + file.name;
        const docId = btoa(path);
        await setDoc(doc(db, "files", docId), {
          uid: user.uid,
          name: file.name,
          folder: basePath.replace(/\/$/, ""),
          createdAt: Date.now(),
          fullPath: path,
          isClipboard: false,
        });

        const { error } = await supabase.storage.from("files").upload(path, file, { upsert: true });
        if (error) {
            console.error(`Upload error for ${file.name}:`, error.message);
            await deleteDoc(doc(db, "files", docId));
        } else {
            setUploadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        }
      } catch (err) {
        console.error("Error processing file entry:", err);
      }
    } else if (entry.isDirectory) {
      const newBasePath = basePath + entry.name + "/";
      const folderPath = user.uid + "/" + newBasePath;
      const docId = btoa(folderPath);

      await setDoc(doc(db, "folders", docId), {
        uid: user.uid,
        name: entry.name,
        parent: basePath.replace(/\/$/, ""),
        fullPath: folderPath,
      });

      const { error } = await supabase.storage.from("files").upload(folderPath + ".placeholder", new Blob([""]), { upsert: true });
      if (error) {
          console.error(`Placeholder upload error for ${folderPath}:`, error.message);
          await deleteDoc(doc(db, "folders", docId));
      }

      const reader = entry.createReader();
      const readEntriesPromise = () => new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      let entries;
      while ((entries = await readEntriesPromise()).length > 0) {
        await Promise.all(entries.map((e) => uploadEntry(e, newBasePath)));
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    if (!user || isUploading) return;
    const items = e.dataTransfer.items;
    if (!items) return;

    const entries = [];
    for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
    }
    
    const counts = await Promise.all(entries.map(entry => countEntries(entry)));
    const totalFiles = counts.reduce((a, b) => a + b, 0);

    if (totalFiles === 0) {
        showSnackbar("No valid files found to upload.");
        return;
    }

    setIsUploading(true);
    setUploadProgress({ total: totalFiles, completed: 0 });

    try {
        const uploadPromises = entries.map(entry =>
            uploadEntry(entry, currentFolder ? currentFolder + "/" : "")
        );
        await Promise.all(uploadPromises);
        showSnackbar("Upload complete!");
    } catch (error) {
        console.error("An error occurred during drop:", error);
        showSnackbar("Upload failed. Check console for details.");
    } finally {
        setIsUploading(false);
        fetchData();
    }
  };
  
  const handleFileSelectClick = () => {
    setContextMenu(null);
    fileInputRef.current.click();
  };
  
  const handleFileSelectChange = async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
  
      let validFiles = [];
      let oversizedImages = 0;
      let invalidExtensions = 0;

      Array.from(files).forEach(file => {
          if (!file.name.includes('.')) {
              validFiles.push(file);
              return;
          }
          const ext = `.${file.name.split('.').pop()}`.toLowerCase();
          if (!allowedExt.includes(ext)) {
              invalidExtensions++;
              return;
          }
          if (ext === '.png' || ext === '.jpeg' || ext === '.jpg') {
              if (file.size > 1048576) {
                  oversizedImages++;
                  return;
              }
          }
          validFiles.push(file);
      });
      
      let snackMessage = "";
      if (oversizedImages > 0) {
          snackMessage += `${oversizedImages} image(s) skipped (> 1MB). `;
      }
      if (invalidExtensions > 0) {
          snackMessage += `${invalidExtensions} file(s) skipped (invalid type). `;
      }

      if (validFiles.length === 0) {
          if (!snackMessage) snackMessage = "No valid files selected.";
          showSnackbar(snackMessage.trim());
          e.target.value = null;
          return;
      }
      
      if (snackMessage) {
          showSnackbar(snackMessage.trim());
      }
      
      setIsUploading(true);
      setUploadProgress({ total: validFiles.length, completed: 0 });
  
      try {
          const uploadPromises = validFiles.map(file =>
              uploadSingleFile(file, currentFolder ? currentFolder + "/" : "")
          );
          await Promise.all(uploadPromises);
          showSnackbar("Upload complete!");
      } catch (error) {
          console.error("An error occurred during upload:", error);
          showSnackbar("Upload failed. Check console.");
      } finally {
          setIsUploading(false);
          fetchData();
          e.target.value = null;
      }
  };
  
  const uploadSingleFile = async (file, basePath) => {
      const path = `${user.uid}/${basePath}${file.name}`;
      const docId = btoa(path);
      
      const { error } = await supabase.storage.from("files").upload(path, file, { upsert: true });
  
      if (error) {
          console.error(`Upload error for ${file.name}:`, error.message);
          throw new Error(error.message);
      }
      
      await setDoc(doc(db, "files", docId), {
          uid: user.uid,
          name: file.name,
          folder: basePath.replace(/\/$/, ""),
          createdAt: Date.now(),
          fullPath: path,
          isClipboard: false,
      });
      
      setUploadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
  };

  const requestDeleteFile = (file) => {
    setShowDeleteDialog({ show: true, item: file, type: 'file' });
  };
  
  const requestDeleteFolder = (folder) => {
    setFolderContextMenu(null);
    setShowDeleteDialog({ show: true, item: folder, type: 'folder' });
  };

 const handleConfirmDelete = async () => {
    const { item, type } = showDeleteDialog;
    if (!item) return;

    setShowDeleteDialog({ show: false, item: null, type: "" });
    setIsDeleting(true);

    try {
      if (type === "file") {
        setDeleteProgress({ total: 1, completed: 0 });
        const path = `${user.uid}/${currentFolder ? currentFolder + "/" : ""}${item.name}`;
        
        // --- STEP 1: MOVE TO RECYCLE BIN ---
        showSnackbar(`Moving "${item.name}" to recycle bin...`);
        await backupToRecycleBin(path);

        // --- STEP 2: DELETE AS USUAL ---
        await supabase.storage.from("files").remove([path]);
        await deleteDoc(doc(db, "files", btoa(path)));
        
        setDeleteProgress({ total: 1, completed: 1 });
        showSnackbar(`File "${item.name}" deleted.`);
      } 
      else if (type === "folder") {
        const folderRootPath = `${currentFolder ? currentFolder + "/" : ""}${item.name}`;
        const supabaseRootPath = `${user.uid}/${folderRootPath}`;
        
        const firestoreBatch = writeBatch(db);
        const supabasePathsToDelete = new Set();
        
        // --- FIX STARTS HERE: Add the UPPER BOUND ('\uf8ff') to strictly limit deletion ---
        
        // 1. Files: strictly inside this folder or its subfolders
        const filesQuery = query(
            collection(db, 'files'), 
            where('uid', '==', user.uid), 
            where('folder', '>=', folderRootPath),
            where('folder', '<=', folderRootPath + '\uf8ff') // <--- CRITICAL FIX
        );
        const filesSnapshot = await getDocs(filesQuery);
        
        // 2. Sub-folders: strictly inside this folder structure
        const foldersQuery = query(
            collection(db, 'folders'), 
            where('uid', '==', user.uid), 
            where('fullPath', '>=', `${supabaseRootPath}/`),
            where('fullPath', '<=', `${supabaseRootPath}/` + '\uf8ff') // <--- CRITICAL FIX
        );
        const foldersSnapshot = await getDocs(foldersQuery);

        // --- FIX ENDS HERE ---

        const totalDeletions = filesSnapshot.size + foldersSnapshot.size;
        
        setDeleteProgress({ total: totalDeletions, completed: 0 });
        showSnackbar(`Moving contents of "${item.name}" to recycle bin...`);

        // --- PREPARE DATA ---
        filesSnapshot.forEach(doc => {
          firestoreBatch.delete(doc.ref);
          supabasePathsToDelete.add(doc.data().fullPath);
        });
        
        foldersSnapshot.forEach(doc => {
          firestoreBatch.delete(doc.ref);
          supabasePathsToDelete.add(doc.data().fullPath + '.placeholder');
        });

        // Add the root folder placeholder itself
        supabasePathsToDelete.add(`${supabaseRootPath}/.placeholder`);
        
        // Delete root folder doc from Firestore
        const rootFolderDocId = btoa(`${supabaseRootPath}/`);
        const rootFolderDocRef = doc(db, "folders", rootFolderDocId);
        const rootFolderDocSnap = await getDoc(rootFolderDocRef);
        if (rootFolderDocSnap.exists()) {
            firestoreBatch.delete(rootFolderDocRef);
        }

        // --- BACKUP TO RECYCLE BIN ---
        const pathsArray = Array.from(supabasePathsToDelete);
        
        if (pathsArray.length > 0) {
            const backupPromises = pathsArray.map(async (path) => {
                await backupToRecycleBin(path);
                setDeleteProgress(prev => ({ ...prev, completed: prev.completed + 0.5 })); 
            });
            await Promise.all(backupPromises);
        }

        // --- EXECUTE DELETE ---
        showSnackbar(`Deleting "${item.name}"...`);

        await firestoreBatch.commit();
        
        if (pathsArray.length > 0) {
            const { error: removeError } = await supabase.storage.from("files").remove(pathsArray);
            if (removeError) {
                console.error("Supabase bulk delete failed:", removeError);
                throw removeError;
            }
        }
        
        setDeleteProgress({ total: totalDeletions, completed: totalDeletions });
        showSnackbar(`Folder "${item.name}" deleted.`);
      }
    } catch (error) {
        console.error("Critical error during deletion:", error);
        showSnackbar("Deletion failed. Check console.");
    } finally {
        setIsDeleting(false);
        fetchData(); 
    }
  };

 // --- HELPER: Move file to 'recycle' bucket ---
  const backupToRecycleBin = async (path) => {
    // FIX: Skip placeholder files. They are 0 bytes and cause 400 errors.
    // We don't need to back them up.
    if (path.endsWith(".placeholder")) return;

    try {
      // 1. Download from 'files'
      const { data, error: downloadError } = await supabase.storage
        .from("files")
        .download(path);
      
      if (downloadError) throw downloadError;

      // 2. Upload to 'recycle'
      const { error: uploadError } = await supabase.storage
        .from("recycle")
        .upload(path, data, { upsert: true });

      if (uploadError) throw uploadError;
      
    } catch (err) {
      // We log the error but don't stop the process. 
      // This ensures if one file fails to backup, the deletion still happens.
      console.warn(`Failed to move ${path} to recycle bin:`, err);
    }
  };

  const requestCreateFolder = () => {
    setContextMenu(null);
    setShowCreateFolderDialog(true);
  };

  const handleConfirmCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName) return;
  
    const name = newFolderName.trim();
    setShowCreateFolderDialog(false);
    setNewFolderName("");
  
    const path = user.uid + "/" + (currentFolder ? currentFolder + "/" : "") + name + "/";
  
    if (folders.find((f) => f.name === name)) {
      showSnackbar("Folder already exists!");
      return;
    }
  
    const { error } = await supabase.storage.from("files").upload(path + ".placeholder", new Blob([""]), { upsert: true });
  
    if (!error) {
      const docId = btoa(path);
      await setDoc(doc(db, "folders", docId), {
        uid: user.uid,
        name,
        parent: currentFolder || "",
        fullPath: path,
      });
      fetchData();
    } else {
        console.error(error.message);
        showSnackbar("Failed to create folder.");
    }
  };

  const requestCreateFile = () => {
    setContextMenu(null);
    setNewFileName("");
    setNewFileContent("");
    setValidatedFileName("");
    setCreateFileStep('name');
    setShowCreateFileDialog(true);
  };

  const handleNameToContentStep = (e) => {
    e.preventDefault();
    let name = newFileName.trim();

    if (!name) {
      let i = 1;
      while (files.some(f => f.name === `file${i}`)) {
        i++;
      }
      name = `file${i}`;
    }

    if (files.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      showSnackbar("File with this name already exists!");
      return;
    }

    setValidatedFileName(name);
    setCreateFileStep('content');
  };

  const handleSaveNewFile = async (e) => {
    e.preventDefault();
    const name = validatedFileName;

    if (!name) {
      showSnackbar("An error occurred: file name is missing.");
      handleCancelCreateFile();
      return;
    }

    setShowCreateFileDialog(false);

    const path = `${user.uid}/${currentFolder ? currentFolder + "/" : ""}${name}`;
    const fileContentBlob = new Blob([newFileContent], { type: "text/plain" });

    const { error } = await supabase.storage.from("files").upload(path, fileContentBlob);

    if (!error) {
      const docId = btoa(path);
      await setDoc(doc(db, "files", docId), {
        uid: user.uid,
        name,
        folder: currentFolder || "",
        createdAt: Date.now(),
        fullPath: path,
        isClipboard: true,
      });
      showSnackbar(`Note "${name}" created.`);
      fetchData();
    } else {
      console.error(error.message);
      showSnackbar("Failed to create note.");
    }
    
    handleCancelCreateFile();
  };
  
  const handleCancelCreateFile = () => {
    setShowCreateFileDialog(false);
    setNewFileName("");
    setNewFileContent("");
    setValidatedFileName("");
  };


  // --- ADD FOR RENAME ---

  const requestRename = (item, type) => {
    setFileContextMenu(null);
    setFolderContextMenu(null);
    setNewName(item.name); // Pre-fill the input with the old name
    setShowRenameDialog({ show: true, item: item, type: type });
  };

  const handleConfirmRename = async (e) => {
    e.preventDefault();
    const { item, type } = showRenameDialog;
    const finalName = newName.trim();

    // Abort if name is empty, unchanged, or invalid
    if (!finalName || finalName === item.name) {
      setShowRenameDialog({ show: false, item: null, type: "" });
      setNewName("");
      return;
    }

    // Check for duplicates
    if (type === "file" && files.some(f => f.name.toLowerCase() === finalName.toLowerCase())) {
      showSnackbar("A file with this name already exists.");
      return;
    }
    if (type === "folder" && folders.some(f => f.name.toLowerCase() === finalName.toLowerCase())) {
      showSnackbar("A folder with this name already exists.");
      return;
    }

    setIsRenaming(true);
    setShowRenameDialog({ show: false, item: null, type: "" });
    setNewName("");

    try {
      if (type === "file") {
        setRenameProgress({ total: 1, completed: 0 });

        // Check if file is starred (public)
        if (starred[btoa(item.fullPath)]) {
          throw new Error("Cannot rename a public file. Make it private first.");
        }

        const oldPath = item.fullPath;
        const newPath = `${user.uid}/${currentFolder ? currentFolder + "/" : ""}${finalName}`;
        const oldDocId = btoa(oldPath);
        const newDocId = btoa(newPath);

        // 1. Move in Supabase Storage
        const { error: moveError } = await supabase.storage.from('files').move(oldPath, newPath);
        if (moveError) throw moveError;

        // 2. Get old Firestore doc
        const docSnap = await getDoc(doc(db, "files", oldDocId));
        if (!docSnap.exists()) throw new Error("Original file metadata not found.");
        const oldData = docSnap.data();

        // 3. Create new Firestore doc and delete old one
        const batch = writeBatch(db);
        const newDocRef = doc(db, "files", newDocId);
        batch.set(newDocRef, { 
          ...oldData, 
          name: finalName, 
          fullPath: newPath,
          createdAt: Date.now() // Update timestamp
        });
        batch.delete(docSnap.ref);
        await batch.commit();

        setRenameProgress({ total: 1, completed: 1 });
        showSnackbar(`Renamed "${item.name}" to "${finalName}".`);

      } else if (type === "folder") {
        const oldFolderName = item.name;
        const oldFolderPathPrefix = `${currentFolder ? currentFolder + "/" : ""}${oldFolderName}`;
        const newFolderPathPrefix = `${currentFolder ? currentFolder + "/" : ""}${finalName}`;
        
        const oldSupabasePathPrefix = `${user.uid}/${oldFolderPathPrefix}`;
        const newSupabasePathPrefix = `${user.uid}/${newFolderPathPrefix}`;

        const firestoreBatch = writeBatch(db);
        const supabaseMovePromises = [];
        
        // --- 1. Query all descendant files ---
        const filesQuery = query(collection(db, 'files'), where('uid', '==', user.uid), where('folder', '>=', oldFolderPathPrefix));
        const filesSnapshot = await getDocs(filesQuery);

        // --- 2. Query all descendant folders ---
        const foldersQuery = query(collection(db, 'folders'), where('uid', '==', user.uid), where('fullPath', '>=', `${oldSupabasePathPrefix}/`));
        const foldersSnapshot = await getDocs(foldersQuery);

        const totalItems = filesSnapshot.size + foldersSnapshot.size + 2; // +2 for root folder doc and placeholder
        setRenameProgress({ total: totalItems, completed: 0 });

        // --- 3. Process Files ---
        filesSnapshot.forEach((docSnap) => {
          const oldData = docSnap.data();
          const oldPath = oldData.fullPath; // e.g., uid/projects/old/a/b.txt
          
          // Check for starred files inside
          if (starred[btoa(oldPath)]) {
            throw new Error(`Cannot rename folder: contains a public file (${oldData.name}). Make it private first.`);
          }

          const relativePath = oldPath.substring(oldSupabasePathPrefix.length); // e.g., /a/b.txt
          const newPath = `${newSupabasePathPrefix}${relativePath}`; // e.g., uid/projects/new/a/b.txt
          const newFolder = newPath.substring(user.uid.length + 1).split('/').slice(0, -1).join('/');

          const newDocId = btoa(newPath);
          const newData = { 
            ...oldData, 
            fullPath: newPath, 
            folder: newFolder 
          };

          firestoreBatch.set(doc(db, "files", newDocId), newData);
          firestoreBatch.delete(docSnap.ref);
          supabaseMovePromises.push(supabase.storage.from('files').move(oldPath, newPath));
          setRenameProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        });

        // --- 4. Process Sub-Folders ---
        foldersSnapshot.forEach((docSnap) => {
          const oldData = docSnap.data();
          const oldPath = oldData.fullPath; // e.g., uid/projects/old/sub/
          
          const relativePath = oldPath.substring(oldSupabasePathPrefix.length); // e.g., /sub/
          const newPath = `${newSupabasePathPrefix}${relativePath}`; // e.g., uid/projects/new/sub/
          const newParent = newPath.replace(/\/$/, "").split('/').slice(0, -1).join('/');

          const newDocId = btoa(newPath);
          const newData = { 
            ...oldData, 
            fullPath: newPath, 
            parent: newParent
          };

          firestoreBatch.set(doc(db, "folders", newDocId), newData);
          firestoreBatch.delete(docSnap.ref);
          supabaseMovePromises.push(supabase.storage.from('files').move(`${oldPath}.placeholder`, `${newPath}.placeholder`));
          setRenameProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        });
        
        // --- 5. Process Root Folder Doc ---
        const rootFolderDocId = btoa(`${oldSupabasePathPrefix}/`);
        const rootFolderDocRef = doc(db, "folders", rootFolderDocId);
        const rootFolderDocSnap = await getDoc(rootFolderDocRef);
        if (rootFolderDocSnap.exists()) {
          const newRootDocId = btoa(`${newSupabasePathPrefix}/`);
          firestoreBatch.set(doc(db, "folders", newRootDocId), {
            ...rootFolderDocSnap.data(),
            name: finalName,
            fullPath: `${newSupabasePathPrefix}/`
          });
          firestoreBatch.delete(rootFolderDocRef);
        }
        setRenameProgress(prev => ({ ...prev, completed: prev.completed + 1 }));

        // --- 6. Process Root Placeholder ---
        supabaseMovePromises.push(supabase.storage.from('files').move(`${oldSupabasePathPrefix}/.placeholder`, `${newSupabasePathPrefix}/.placeholder`));
        
        // --- 7. Execute all operations ---
        await firestoreBatch.commit();
        await Promise.all(supabaseMovePromises);
        
        setRenameProgress(prev => ({ ...prev, completed: totalItems }));
        showSnackbar(`Folder "${item.name}" renamed to "${finalName}".`);
      }
    } catch (error) {
      console.error("A critical error occurred during rename:", error);
      showSnackbar(`Rename failed: ${error.message}`);
    } finally {
      setIsRenaming(false);
      fetchData();
    }
  };

  // --- END ADD FOR RENAME ---



  const handleCopyContent = async (file) => {
    const path = file.fullPath;
    const { data, error } = await supabase.storage.from("files").download(path);
    if (error) {
        console.error("Error downloading file content for copy:", error);
        showSnackbar("Could not copy content.");
        return;
    }
    if (data) {
        const text = await data.text();
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`Content of "${file.name}" copied to clipboard!`);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showSnackbar("Failed to copy content.");
        }
    }
  };
  
  const handlePreviewFile = async (file) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const path = file.fullPath;
    setPreviewFile(file);

    if (ext === '.png' || ext === '.jpeg' || ext === '.svg' || ext === '.jpg') {
        const { data } = supabase.storage.from("files").getPublicUrl(path);
        setPreviewUrl(data.publicUrl);
        setPreviewContent("");
    } else if (ext === '.pdf') {
        const { data } = supabase.storage.from("files").getPublicUrl(path);
        setPreviewUrl(data.publicUrl);
        setPreviewContent("");
    } else {
        const nonPreviewableExt = ['.doc', '.docx'];
        if (nonPreviewableExt.includes(ext)) {
            showSnackbar("Preview not available for this file type.");
            setPreviewFile(null);
            return;
        }
        
        setPreviewUrl("");
        try {
            const { data, error } = await supabase.storage.from("files").download(path);
            if (error) throw error;
            if (data) {
                const text = await data.text();
                setPreviewContent(text);
            } else {
                setPreviewContent("Could not load file content.");
            }
        } catch (error) {
            console.error("Error downloading file content:", error);
            setPreviewContent(`Error: Could not load file content. ${error.message}`);
        }
    }
  };

  const handleStarFile = async (file) => {
    // --- MODIFIED TO PREVENT CONFLICTS ---
    const docId = btoa(file.fullPath); // Use unique ID (btoa of user.uid/path/file.name)
    const docRef = doc(db, "publicFiles", docId);
    const supabasePublicPath = "public/" + file.fullPath; // Use unique public path
    // --- END MODIFIED ---

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().expiresAt > Date.now()) {
        await supabase.storage.from("files").remove([supabasePublicPath]);
        await deleteDoc(docRef);
        showSnackbar(`"${file.name}" is no longer public.`);
      } else {
        const userPath = file.fullPath;
        const { data, error: downloadError } = await supabase.storage.from("files").download(userPath);
        if (downloadError) throw new Error("Failed to download your file to make it public.");
        await supabase.storage.from("files").upload(supabasePublicPath, data, { upsert: true });

        const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
        await setDoc(docRef, {
          name: file.name,
          createdAt: Date.now(),
          expiresAt: expiryTime,
          path: supabasePublicPath,
          usr: user.uid,
        });
        showSnackbar(`"${file.name}" is public for 24 hours.`);

        setTimeout(async () => {
          const latestSnap = await getDoc(docRef);
          if (latestSnap.exists() && latestSnap.data().expiresAt <= Date.now()) {
            await supabase.storage.from("files").remove([supabasePublicPath]);
            await deleteDoc(docRef);
            await fetchStarred();
          }
        }, 24 * 60 * 60 * 1000 + 2000);
      }
    } catch (error) {
      console.error("Star/Un-star operation failed:", error.message);
      showSnackbar(`Error: ${error.message}`);
    }
    await fetchStarred();
  };

  const handleDownloadFolder = async (folder) => {
    setFolderContextMenu(null);
    if (!user) return;
    
    setIsDownloading(true);
    showSnackbar(`Preparing "${folder.name}" for download...`);
    
    try {
        const filePaths = [];
        const folderRootPath = `${user.uid}/${currentFolder ? currentFolder + "/" : ""}${folder.name}`;

        const listAllFiles = async (path) => {
            const { data, error } = await supabase.storage.from("files").list(path);
            if (error) throw error;

            for (const item of data) {
                const currentPath = `${path}/${item.name}`;
                if (item.id !== null && !item.name.includes('.placeholder')) {
                    filePaths.push(currentPath);
                } else if (item.id === null) {
                    await listAllFiles(currentPath);
                }
            }
        };

        await listAllFiles(folderRootPath);
        
        if (filePaths.length === 0) {
            showSnackbar("Folder is empty, nothing to download.");
            setIsDownloading(false);
            return;
        }

        setDownloadProgress({ total: filePaths.length, completed: 0 });
        showSnackbar(`Downloading ${filePaths.length} files...`);

        const zip = new JSZip();
        
        for (const filePath of filePaths) {
            const { data: fileBlob, error } = await supabase.storage.from("files").download(filePath);
            if (error) {
                console.error(`Failed to download ${filePath}:`, error);
                continue;
            }
            
            const relativePath = filePath.substring(folderRootPath.length + 1);
            zip.file(relativePath, fileBlob, { binary: true });
            
            setDownloadProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${folder.name}.zip`);
        showSnackbar("Download complete!");

    } catch (error) {
        console.error("Failed to download folder:", error);
        showSnackbar("Error downloading folder. Check console.");
    } finally {
        setIsDownloading(false);
    }
  };
useEffect(() => {
  if (user) {
    const fetchTheme = async () => {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.theme !== undefined && themes[data.theme]) {
                setCurrentTheme(themes[data.theme]);
            }
        }
    };
    fetchTheme();
  }
}, [user]);

const handleDownloadFile = async (file) => {
    setFileContextMenu(null); // Close menu
    setIsDownloading(true);
    showSnackbar(`Downloading "${file.name}"...`);

    try {
      // Download data as a Blob from Supabase using auth
      const { data, error } = await supabase.storage
        .from("files")
        .download(file.fullPath);

      if (error) throw error;

      // Use file-saver to save the Blob
      saveAs(data, file.name);
      showSnackbar("Download complete!");
    } catch (error) {
      console.error("Download failed:", error);
      showSnackbar("Error downloading file.");
    } finally {
      setIsDownloading(false);
    }
  };

  // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  
return (
    <div 
      className="min-h-screen font-press flex flex-col p-4 md:p-6 overflow-hidden select-none transition-colors duration-300"
      style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => {
        setContextMenu(null);
        setFolderContextMenu(null);
        setFileContextMenu(null);
      }}
    >
      <style>
        {`
          .font-press { font-family: 'Press Start 2P', monospace; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: ${currentTheme.container}; border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #555; }
          @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
          
          .action-btn:hover::after {
             content: attr(data-tooltip);
             position: absolute;
             bottom: 100%;
             left: 50%;
             transform: translateX(-50%);
             background: #333;
             color: white;
             padding: 4px 8px;
             border-radius: 4px;
             font-size: 10px;
             white-space: nowrap;
             pointer-events: none;
             margin-bottom: 5px;
             border: 1px solid #555;
             z-index: 100;
          }
        `}
      </style>
      {/* --- INTRO / SPLASH SCREEN --- */}
      {showIntro && (
        <div 
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ease-in-out"
            style={{ opacity: introOpacity }}
        >
            {/* Logo */}
            <img 
              src={XOIcon} 
              alt="CODESPACEXO" 
              className="w-32 md:w-48 h-auto mb-8 animate-fade-in"
            />
            
            {/* Progress Bar Container */}
            <div className="w-48 md:w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden animate-fade-in">
              {/* Progress Bar Filler */}
              <div 
                className="h-full bg-pink-600 transition-all duration-75 ease-linear" 
                style={{ width: `${splashProgress}%` }}
              ></div>
            </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-6 z-40 relative">
        
        {/* Logo Section */}
        <h1 className="text-xl md:text-3xl tracking-widest cursor-pointer font-bold" style={{ color: currentTheme.accent }} onClick={() => navigate("/")}>
          {/* Mobile Logo */}
        <img 
        src={XOIcon} 
        alt="XO" 
        className="md:hidden h-14 w-auto" 
        style={{ filter: isDarkTheme ? 'none' : 'invert(1)' }} 
        />          {/* Desktop Text */}
          <span className="hidden md:inline">CODESPACEXO</span>
        </h1>

        {/* Desktop Menu - Profile + Pills */}
        <div className="hidden md:flex items-center gap-4">
          
          {/* Profile Button */}
          <button 
            onClick={() => navigate("/control")} 
            className="w-14 h-14 rounded-full flex items-center justify-center border border-transparent hover:opacity-80 transition" 
            style={{ backgroundColor: currentTheme.panel }}
          >
             <img src={UserIcon} className="w-6 h-6" style={{ filter: iconFilter }} alt="profile" />
          </button>

         {/* Animated Gradient Wrapper */}
<div className="animated-gradient-border rounded-full p-[2px]">
  <button 
    onClick={() => navigate("/public")} 
    className="px-6 py-4 rounded-full transition text-xs tracking-widest font-bold hover:opacity-80 h-full w-full" 
    style={{ backgroundColor: currentTheme.panel, color: currentTheme.text }}
  >
    PUBLIC
  </button>
</div>
          <button 
            onClick={() => navigate("/bin")} 
            className="px-6 py-4 rounded-full border border-transparent transition text-xs tracking-widest font-bold hover:bg-opacity-80" 
            style={{ backgroundColor: currentTheme.panel, color: currentTheme.text }}
          >
            BIN
          </button>
          <button 
            onClick={handleLogout} 
            className="px-6 py-4 rounded-full border border-transparent hover:border-red-500 hover:text-red-400 transition text-xs tracking-widest font-bold" 
            style={{ backgroundColor: currentTheme.panel, color: currentTheme.text }}
          >
            EXIT
          </button>
        </div>

        {/* Mobile Right Side Group */}
        <div className="flex md:hidden gap-3">
            {/* Mobile Profile Button */}
            <button 
                onClick={() => navigate("/control")}
                className="px-4 py-4 rounded-full hover:opacity-80 transition flex items-center justify-center" 
                style={{ backgroundColor: currentTheme.panel }}
            >
                <img src={UserIcon} className="w-6 h-6" style={{ filter: iconFilter }} alt="profile" />
            </button>

            {/* Mobile Hamburger */}
            <button 
                className="px-4 py-4 rounded-full hover:opacity-80 transition" 
                style={{ backgroundColor: currentTheme.panel, color: currentTheme.text }} 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
            >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                 </svg>
            </button>
        </div>

        {isMenuOpen && (
  <>
    {/* Backdrop */}
    <div 
      className="fixed inset-0 bg-black/50 z-40 md:hidden" 
      onClick={() => setIsMenuOpen(false)}
    />
    
    {/* Sidebar */}
    <div 
      className="fixed inset-y-0 right-0 w-64 z-50 flex flex-col items-center py-12 md:hidden shadow-2xl transition-transform duration-300 ease-out"
      style={{ backgroundColor: currentTheme.panel, borderLeft: `1px solid ${currentTheme.border}` }}
    >
      {/* Title */}
      <h2 className="text-2xl tracking-widest mb-auto" style={{ color: currentTheme.text }}>CSXO</h2>

      {/* Buttons Container */}
      <div className="flex flex-col gap-4 w-full px-8 pb-8">
        
        {/* Public Button (Gradient Border) */}
        <div className="animated-gradient-border rounded-full p-[2px] w-full">
          <button 
            onClick={() => { navigate("/public"); setIsMenuOpen(false); }}
            className="w-full py-4 rounded-full font-bold tracking-widest text-sm hover:opacity-80 transition"
            style={{ backgroundColor: currentTheme.panel, color: currentTheme.text }}
          >
            Public
          </button>
        </div>

        {/* Bin Button */}
        <button 
          onClick={() => { navigate("/bin"); setIsMenuOpen(false); }}
          className="w-full py-4 rounded-full border font-bold tracking-widest text-sm hover:bg-white/10 transition"
          style={{ borderColor: currentTheme.text, color: currentTheme.text }}
        >
          Bin
        </button>

        {/* Exit Button */}
        <button 
          onClick={handleLogout}
          className="w-full py-4 rounded-full border font-bold tracking-widest text-sm hover:bg-red-500/20 transition"
          style={{ borderColor: currentTheme.text, color: currentTheme.text }}
        >
          Exit
        </button>

      </div>
    </div>
  </>
)}
      </div>

      {/* --- MAIN OS CONTAINER --- */}
      <div 
        ref={containerRef}
        className="os-container flex-1 border rounded-[20px] relative overflow-hidden os-bg-layer"
        style={{ backgroundColor: currentTheme.container, borderColor: currentTheme.border }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        onDragLeave={(e) => { 
             e.preventDefault(); e.stopPropagation();
             if (e.currentTarget.contains(e.relatedTarget)) return;
             setDragging(false); 
        }}
        onDrop={(e) => {
            e.preventDefault(); e.stopPropagation();
            setDragging(false);
            handleDrop(e);
        }}
        onContextMenu={(e) => { 
          e.preventDefault(); 
          if(e.target === e.currentTarget || e.target.classList.contains('os-bg-layer')) { 
             setFolderContextMenu(null); 
             setFileContextMenu(null);
             setContextMenu({ x: e.pageX, y: e.pageY }); 
          }
        }}
        onClick={(e) => {
            if(e.target === e.currentTarget || e.target.classList.contains('os-bg-layer')) {
               setContextMenu(null);
               setFolderContextMenu(null);
               setFileContextMenu(null);
            }
        }}
      >
        
        {dragging && (
          <div className="absolute inset-0 bg-opacity-10 z-[200] flex items-center justify-center border-4 border-dashed rounded-[30px] pointer-events-none" style={{ backgroundColor: `${currentTheme.accent}20`, borderColor: currentTheme.accent }}>
            <p className="animate-pulse text-xl" style={{ color: currentTheme.accent }}>DROP FILES HERE</p>
          </div>
        )}

        {/* --- CONTENT AREA (Grid vs List) --- */}
<div className="absolute inset-0 p-6 overflow-auto z-10 os-bg-layer">            
            {/* Back Button */}
{currentFolder && (
  <div className="mb-4">
      <div 
        onClick={(e) => { e.stopPropagation(); handleBack(); }}
        // Changed classes: Added 'justify-center', increased padding (px-6 py-2) for pill shape
        className="inline-flex items-center justify-center px-8 py-3 rounded-full cursor-pointer transition hover:opacity-80 group border"
        style={{ 
            backgroundColor: currentTheme.border, // Background matches theme
            borderColor: currentTheme.border     // Border matches theme
        }}
      >
        <img 
          src={BackLeftIcon} 
          className="w-4 h-4 transition group-hover:scale-110" 
          style={{ filter: iconFilter }} // Icon color adapts to theme
          alt="Back" 
        />
        {/* Text removed to match the visual design provided */}
      </div>
  </div>
)}

            {viewMode === 'grid' ? (
                // --- GRID VIEW ---
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-4 content-start">
                    {folders.map((folder) => (
                      <div 
                        key={folder.name}
                        onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu(null); setFolderContextMenu(null); setFileContextMenu(null);
                            setCurrentFolder(currentFolder ? currentFolder + "/" + folder.name : folder.name);
                        }}
                        onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); setContextMenu(null); setFolderContextMenu({ x: e.pageX, y: e.pageY, folder }); }}
                        className="flex flex-col items-center gap-3 group cursor-pointer p-4 rounded-xl hover:bg-white/5 transition"
                      >
                        <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center relative group-hover:scale-105 transition shadow-lg">
                           <img src={FolderIcon} className="w-8 h-8 opacity-80" alt="folder"/>
                        </div>
                        <span className="text-[10px] text-center truncate w-full font-sans tracking-wide font-space" style={{ color: currentTheme.text }}>{folder.name}</span>
                      </div>
                    ))}

                    {files.map((file) => {
    const docId = btoa(file.fullPath);
    const isOpen = windows.some(w => w.id === docId);
    // Check if it's a note (no extension or .txt)
    const isNote = !file.name.includes('.') || file.name.endsWith('.txt');

    return (
    <div 
        key={file.id || file.name}
        className={`file-item flex flex-col items-center gap-3 group cursor-pointer p-4 rounded-xl transition border`}
        style={{ 
            borderColor: isOpen ? currentTheme.accent : 'transparent',
            backgroundColor: isOpen ? `${currentTheme.accent}20` : 'transparent'
        }}
        onClick={(e) => { e.stopPropagation(); openFile(file); }}
        onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); setContextMenu(null); setFolderContextMenu(null); setFileContextMenu({ x: e.pageX, y: e.pageY, file }); }}
    >
        {isNote ? (
            // --- NOTE STYLE ---
            <div className="w-14 h-14 bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm flex flex-col p-2 group-hover:scale-105 transition relative overflow-hidden">
                {/* Lines to look like text */}
                <div className="w-full h-1 bg-gray-500 mb-1 rounded-full opacity-50"></div>
                <div className="w-3/4 h-1 bg-gray-500 mb-1 rounded-full opacity-50"></div>
                <div className="w-full h-1 bg-gray-400 mb-1 rounded-full opacity-50"></div>
                {/* Folded corner effect */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-yellow-200 shadow-[-1px_-1px_2px_rgba(0,0,0,0.1)]" style={{clipPath: 'polygon(100% 0, 0 100%, 100% 100%)'}}></div>
            </div>
        ) : (
            // --- FILE STYLE (Original) ---
            <div className="w-14 h-14 bg-[#222] border border-gray-700 rounded-lg flex items-center justify-center group-hover:scale-105 transition relative pointer-events-none">
                <span className="text-[8px] absolute top-1 right-1 text-gray-500">{file.name.split('.').pop()}</span>
                <div className="w-6 h-8 bg-gray-400 rounded-sm"></div>
            </div>
        )}
        
        {/* Name Label (Hidden for Notes inside the icon, but shown below as normal label) */}
        {/* You said "dont show name as you are doing with file icon in note". I assume you mean don't show extension inside? 
            Or do you mean hide the text label below? usually you still need the name below to identify it. 
            If you want to hide the name *inside* the icon (like "txt" in top right), the Note Style above already removes that.
        */}
        <span className={`text-[10px] text-center w-full truncate font-sans tracking-wide pointer-events-none`} style={{ color: starred[docId] ? "#facc15" : currentTheme.text }}>
            {file.name}
        </span>
    </div>
    );
})}
                </div>
            ) : (
                // --- LIST VIEW ---
                <div className="flex flex-col gap-2 max-w-5xl mx-auto pl-2">
                    {folders.map((folder) => (
                        <div 
                            key={folder.name}
                            onClick={(e) => {
                                e.stopPropagation();
                                setContextMenu(null); setFolderContextMenu(null); setFileContextMenu(null);
                                setCurrentFolder(currentFolder ? currentFolder + "/" + folder.name : folder.name);
                            }}
                            onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); setContextMenu(null); setFolderContextMenu({ x: e.pageX, y: e.pageY, folder }); }}
                            className="flex items-center justify-between p-4 border rounded-xl hover:bg-white/5 cursor-pointer group transition-all"
                            style={{ borderColor: currentTheme.border }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                                    <img src={FolderIcon} className="w-5 h-5 opacity-90" alt="folder"/>
                                </div>
                                <span className="text-sm font-sans tracking-wide font-space" style={{ color: currentTheme.text }}>{folder.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <button onClick={(e) => { e.stopPropagation(); handleDownloadFolder(folder); }} className="relative action-btn p-2 hover:bg-white/10 rounded-full transition" data-tooltip="Download">
                                    <img src={DownloadIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="dl"/>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); requestRename(folder, 'folder'); }} className="relative action-btn p-2 hover:bg-white/10 rounded-full transition" style={{ color: currentTheme.text }} data-tooltip="Rename">
                                    <img src={EditIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="edit"/>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); requestDeleteFolder(folder); }} className="relative action-btn p-2 hover:bg-white/10 rounded-full transition" data-tooltip="Delete">
                                    <img src={DeleteIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="del"/>
                                </button>
                            </div>
                        </div>
                    ))}

                    {files.map((file) => {
                       const docId = btoa(file.fullPath);
                       const isOpen = windows.some(w => w.id === docId);
                       return (
                        <div 
                           key={file.id || file.name}
                           onClick={(e) => { e.stopPropagation(); openFile(file); }}
                           onContextMenu={(e) => { e.stopPropagation(); e.preventDefault(); setContextMenu(null); setFolderContextMenu(null); setFileContextMenu({ x: e.pageX, y: e.pageY, file }); }}
                           className="flex items-center justify-between p-4 border rounded-xl cursor-pointer group transition-all hover:bg-white/5"
                           style={{ 
                               borderColor: isOpen ? currentTheme.accent : currentTheme.border,
                               backgroundColor: isOpen ? `${currentTheme.accent}10` : 'transparent'
                           }}
                        >
                            <div className="flex items-center gap-4">
                                {(!file.name.includes('.') || file.name.endsWith('.txt')) ? (
    // Note Icon (List View)
    <div className="w-8 h-8 flex items-center justify-center bg-yellow-50 border border-yellow-300 rounded relative overflow-hidden">
        <div className="w-4 h-4 border-b-2 border-gray-300 opacity-30"></div>
    </div>
) : (
    // File Icon (List View)
    <div className="w-8 h-8 flex items-center justify-center bg-[#222] border border-gray-700 rounded">
        <div className="w-4 h-5 bg-gray-400 rounded-sm"></div>
    </div>
)}
                                <span className="text-sm font-sans tracking-wide font-space" style={{ color: starred[docId] ? "#facc15" : currentTheme.text }}>
                                    {file.name}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <a href={supabase.storage.from("files").getPublicUrl(file.fullPath).data.publicUrl} download={file.name} onClick={e => e.stopPropagation()} className="relative action-btn p-2 hover:bg-white/10 rounded-full transition" data-tooltip="Download">
                                    <img src={DownloadIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="dl"/>
                                </a>
                                <button onClick={(e) => { e.stopPropagation(); handleStarFile(file); }} className="relative action-btn p-2 hover:bg-white/10 rounded-full transition" data-tooltip={starred[docId] ? 'Private' : 'Public'}>
<img src={starred[docId] ? StarOnIcon : StarOffIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="star"/>                                </button>
                                <button onClick={(e) => { e.stopPropagation(); requestDeleteFile(file); }} className="relative action-btn p-2 hover:bg-white/10 rounded-full transition" data-tooltip="Delete">
                                    <img src={DeleteIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="del"/>
                                </button>
                            </div>
                        </div>
                       );
                    })}
                </div>
            )}
        </div>
        
       {/* --- BOTTOM RIGHT VIEW TOGGLES --- */}
        <div className="absolute bottom-6 right-6 z-30 flex gap-2">
            <button 
                onClick={() => changeViewMode('list')} // <--- UPDATED
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition`} 
                style={{ backgroundColor: viewMode === 'list' ? currentTheme.text : currentTheme.panel, borderColor: viewMode === 'list' ? currentTheme.text : '#333' }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={viewMode === 'list' ? currentTheme.panel : 'gray'} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>
            <button 
                onClick={() => changeViewMode('grid')} // <--- UPDATED
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition`} 
                style={{ backgroundColor: viewMode === 'grid' ? currentTheme.text : currentTheme.panel, borderColor: viewMode === 'grid' ? currentTheme.text : '#333' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={viewMode === 'grid' ? currentTheme.panel : 'gray'} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
            </button>
        </div>

        {/* --- MULTIPLE WINDOWS RENDER --- */}
        {windows.map((win) => (
          <div 
            key={win.id}
            className="absolute shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col transition-[box-shadow] duration-75"
            style={{ 
              width: win.isMaximized ? '100%' : `${win.w}px`, 
              height: win.isMaximized ? '100%' : `${win.h}px`,
              left: win.isMaximized ? 0 : `${win.x}px`, 
              top: win.isMaximized ? 0 : `${win.y}px`,
              zIndex: win.zIndex
            }}
            onMouseDown={() => focusWindow(win.id)} 
          >
            {/* Window Container - Fix: Rounded Corners + Overflow Hidden to clip children */}
            <div 
                className={`w-full h-full flex flex-col relative ${win.isMaximized ? '' : 'rounded-xl'} overflow-hidden border`} 
                style={{ backgroundColor: currentTheme.container, borderColor: currentTheme.border }}
            >
                
                {/* Window Header */}
                <div 
                   onMouseDown={(e) => handleMouseDown(e, win.id, 'move')}
                   className="h-10 border-b flex items-center px-4 cursor-default select-none relative justify-between window-header"
                   style={{ backgroundColor: currentTheme.panel, borderColor: currentTheme.border }}
                >
                    <div className="flex gap-2 items-center" onMouseDown={e => e.stopPropagation()}>
                        <button onClick={() => closeWindow(win.id)} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400" title="Close"></button>
                        {!win.isMobileMode && (
                            <button onClick={() => toggleMaximize(win.id)} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400" title="Maximize/Restore"></button>
                        )}
                    </div>
                    
                    <span className="text-xs tracking-widest font-mono pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ color: currentTheme.text, opacity: 0.7 }}>{win.file.name}</span>
                    <div className="w-10"></div>
                </div>

                {/* Window Body */}
                <div className="flex-1 overflow-auto p-4 select-text" style={{ backgroundColor: currentTheme.container }}>
                    {win.url ? (
                      (win.url.endsWith('.png') || win.url.endsWith('.jpg') || win.url.endsWith('.jpeg') || win.url.endsWith('.svg')) ? 
                        <img src={win.url} alt="preview" className="max-w-full h-auto mx-auto object-contain" /> :
                        <iframe src={win.url} className="w-full h-full border-none" title="pdf-preview" />
                    ) : (
                      <pre className="font-mono text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed" style={{ color: currentTheme.text }}>
                        {win.content}
                      </pre>
                    )}
                </div>

                {/* Resize Handle */}
                {!win.isMaximized && !win.isMobileMode && (
                    <div className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-50 flex items-end justify-end p-1 resize-handle" onMouseDown={(e) => handleMouseDown(e, win.id, 'resize')}>
                        <div className="w-2 h-2 border-r-2 border-b-2 pointer-events-none" style={{ borderColor: currentTheme.text }}></div>
                    </div>
                )}

                {/* Floating Actions - Icons Adaptive */}
                <div className="absolute bottom-4 right-4 border rounded-full px-4 py-2 flex items-center gap-4 shadow-xl backdrop-blur-sm z-40" style={{ backgroundColor: currentTheme.panel, borderColor: currentTheme.border }} onMouseDown={e => e.stopPropagation()}>
                    <a href={win.url || "#"} download={win.file.name} className="hover:opacity-70 transition"><img src={DownloadIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="dl"/></a>
                    <div className="w-[1px] h-4" style={{ backgroundColor: currentTheme.border }}></div>
                    <button onClick={() => requestDeleteFile(win.file)} className="hover:opacity-70 transition"><img src={DeleteIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="del"/></button>
                    <div className="w-[1px] h-4" style={{ backgroundColor: currentTheme.border }}></div>
                    <button onClick={() => handleStarFile(win.file)} className="hover:opacity-70 transition">
<img src={starred[btoa(win.file.fullPath)] ? StarOnIcon : StarOffIcon} className="w-4 h-4" style={{ filter: iconFilter }} alt="star"/>                    </button>
                </div>
            </div>
          </div>
        ))}

      </div>

      {/* --- NOTIFICATIONS & PROGRESS AREA (FLOATING) --- */}
      <div className="fixed bottom-8 left-8 z-[200] flex flex-col items-start gap-4">
          
          {/* Progress Bar - Float Design */}
          {activeProgress && (
              <div className="backdrop-blur-md border rounded-xl p-4 w-72 shadow-2xl animate-fade-in" style={{ backgroundColor: `${currentTheme.panel}E6`, borderColor: currentTheme.border }}>
                  <div className="flex justify-between text-xs mb-2 font-bold tracking-wide" style={{ color: currentTheme.text }}>
                      <span>{activeProgress.label}</span>
                      <span>{Math.round((activeProgress.current / activeProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${currentTheme.text}20` }}>
                      <div 
                          className="h-full transition-all duration-300 ease-out rounded-full" 
                          style={{ width: `${(activeProgress.current / activeProgress.total) * 100}%`, backgroundColor: currentTheme.accent }}
                      ></div>
                  </div>
              </div>
          )}

          {/* Toast Messages - Float Design */}
          {toasts.map((toast) => (
              <div 
                  key={toast.id} 
                  className="px-6 py-4 rounded-xl border shadow-2xl flex items-center gap-4 animate-fade-in text-sm font-bold tracking-wide backdrop-blur-md"
                  style={{ 
                      backgroundColor: `${currentTheme.panel}E6`, 
                      borderColor: currentTheme.border, 
                      color: currentTheme.text 
                  }}
              >
                  <div className="w-3 h-3 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 10px ${currentTheme.accent}` }}></div>
                  {toast.message}
              </div>
          ))}
      </div>

      {/* --- RETAIN MODALS AND INPUTS --- */}
      <input type="file" ref={fileInputRef} onChange={handleFileSelectChange} className="hidden" multiple />
      
      {/* Context Menus */}
      {[contextMenu, folderContextMenu, fileContextMenu].map((menu, i) => menu && (
        <div key={i} className="absolute border rounded-lg p-1 z-[999] shadow-xl" style={{ top: menu.y, left: menu.x, backgroundColor: currentTheme.panel, borderColor: currentTheme.border }} onClick={e => e.stopPropagation()}></div>
      ))}

      {/* Specific Menus Implementation */}
      {contextMenu && (
        <div className="absolute border rounded-lg p-1 z-[999] shadow-xl" style={{ top: contextMenu.y, left: contextMenu.x, backgroundColor: currentTheme.panel, borderColor: currentTheme.border }} onClick={e => e.stopPropagation()}>
           <button onClick={requestCreateFolder} className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/10 w-full text-left rounded" style={{ color: currentTheme.text }}>New Folder</button>
           <button onClick={requestCreateFile} className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/10 w-full text-left rounded" style={{ color: currentTheme.text }}>New Note</button>
<button onClick={handleFileSelectClick} className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/10 w-full text-left rounded" style={{ color: currentTheme.text }}>New File</button>        </div>
      )}
      
      {folderContextMenu && (
         <div className="absolute border rounded-lg p-1 z-[999] shadow-xl" style={{ top: folderContextMenu.y, left: folderContextMenu.x, backgroundColor: currentTheme.panel, borderColor: currentTheme.border }} onClick={e => e.stopPropagation()}>
           <button onClick={() => handleDownloadFolder(folderContextMenu.folder)} className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10 rounded" style={{ color: currentTheme.text }}>Download Zip</button>
           <button onClick={() => requestRename(folderContextMenu.folder, 'folder')} className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10 rounded" style={{ color: currentTheme.text }}>Rename</button>
           <button onClick={() => requestDeleteFolder(folderContextMenu.folder)} className="block w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/10 rounded">Delete</button>
         </div>
      )}

      {fileContextMenu && (
         <div className="absolute border rounded-lg p-1 z-[999] shadow-xl" style={{ top: fileContextMenu.y, left: fileContextMenu.x, backgroundColor: currentTheme.panel, borderColor: currentTheme.border }} onClick={e => e.stopPropagation()}>
           <button onClick={() => { openFile(fileContextMenu.file); setFileContextMenu(null); }} className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10 rounded font-bold" style={{ color: currentTheme.accent }}>Open</button>
           <button onClick={() => requestRename(fileContextMenu.file, 'file')} className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10 rounded" style={{ color: currentTheme.text }}>Rename</button>
           <button onClick={() => handleStarFile(fileContextMenu.file)} className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10 rounded" style={{ color: currentTheme.text }}>
                {starred[btoa(fileContextMenu.file.fullPath)] ? 'Private' : 'Public'}
           </button>
<button onClick={() => handleDownloadFile(fileContextMenu.file)} className="block w-full text-left px-4 py-2 text-xs hover:bg-white/10 rounded" style={{ color: currentTheme.text }}>Download</button>           <button onClick={() => requestDeleteFile(fileContextMenu.file)} className="block w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/10 rounded">Delete</button>
         </div>
      )}

      {/* --- MODALS (Keeping dark) --- */}
      {showDeleteDialog.show && (
       <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
         <div className="bg-[#111] border border-white/30 p-8 rounded-2xl text-center max-w-sm mx-auto shadow-2xl">
           <h2 className="text-lg font-bold mb-4 text-red-400">DELETE?</h2>
           <p className="mb-6 text-gray-300 text-xs">"{showDeleteDialog.item?.name}"</p>
           <div className="flex justify-center gap-4">
              <button onClick={() => setShowDeleteDialog({ show: false, item: null, type: '' })} className="px-6 py-2 rounded-full border border-white/20 text-xs hover:bg-white/10 text-white">Cancel</button>
              <button onClick={handleConfirmDelete} className="px-6 py-2 rounded-full bg-red-600 text-white text-xs hover:bg-red-500">Confirm</button>
           </div>
         </div>
       </div>
      )}

      {showCreateFolderDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <form onSubmit={handleConfirmCreateFolder} className="bg-[#111] border border-white/30 p-8 rounded-2xl text-center max-w-sm mx-auto shadow-2xl w-full">
            <h2 className="text-lg font-bold mb-6 text-white">NEW FOLDER</h2>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-full bg-[#222] border border-white/20 rounded-lg p-3 mb-6 text-white focus:outline-none focus:border-green-500 text-center" placeholder="Name..." autoFocus />
            <div className="flex justify-center gap-4">
               <button type="button" onClick={() => { setShowCreateFolderDialog(false); setNewFolderName(""); }} className="px-6 py-2 rounded-full border border-white/20 text-xs hover:bg-white/10 text-white">Cancel</button>
               <button type="submit" className="px-6 py-2 rounded-full bg-white text-black text-xs hover:bg-gray-200">Create</button>
            </div>
          </form>
        </div>
      )}

      {showRenameDialog.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <form onSubmit={handleConfirmRename} className="bg-[#111] border border-white/30 p-8 rounded-2xl text-center max-w-sm mx-auto shadow-2xl w-full">
            <h2 className="text-lg font-bold mb-6 text-white">RENAME</h2>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-[#222] border border-white/20 rounded-lg p-3 mb-6 text-white focus:outline-none focus:border-green-500 text-center" autoFocus onFocus={(e) => e.target.select()} />
            <div className="flex justify-center gap-4">
               <button type="button" onClick={() => { setShowRenameDialog({ show: false, item: null, type: '' }); setNewName(""); }} className="px-6 py-2 rounded-full border border-white/20 text-xs hover:bg-white/10 text-white">Cancel</button>
               <button type="submit" className="px-6 py-2 rounded-full bg-white text-black text-xs hover:bg-gray-200">Save</button>
            </div>
          </form>
        </div>
      )}

      {showCreateFileDialog && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
           <div className="bg-[#111] border border-white/30 p-6 rounded-2xl shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col">
             {createFileStep === 'name' ? (
                <form onSubmit={handleNameToContentStep} className="flex flex-col h-full justify-center items-center">
                   <h2 className="text-xl mb-8 text-white">NAME YOUR NOTE</h2>
                   <input type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} className="w-3/4 bg-[#222] border-b-2 border-white/20 p-4 text-center text-xl focus:outline-none focus:border-green-500 mb-10 text-white" placeholder="Untitled" autoFocus />
                   <div className="flex gap-4">
                      <button type="button" onClick={handleCancelCreateFile} className="px-8 py-3 rounded-full border border-white/20 hover:bg-white/10 text-white">Cancel</button>
                      <button type="submit" className="px-8 py-3 rounded-full bg-white text-black hover:bg-gray-200">Next</button>
                   </div>
                </form>
             ) : (
                <form onSubmit={handleSaveNewFile} className="flex flex-col h-full">
                   <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                      <span className="text-gray-400 text-xs">Editing: {validatedFileName}</span>
                      <button type="button" onClick={handleCancelCreateFile} className="text-red-400 hover:text-red-300 text-xs">Close</button>
                   </div>
                   <textarea value={newFileContent} onChange={(e) => setNewFileContent(e.target.value)} className="flex-1 bg-[#0f0f0f] p-4 rounded-xl font-mono text-sm focus:outline-none resize-none mb-4 text-white" placeholder="Start typing..." autoFocus />
                   <button type="submit" className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200">SAVE NOTE</button>
                </form>
             )}
           </div>
         </div>
      )}

    </div>
  );
}