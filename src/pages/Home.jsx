import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { supabase } from "../supabase";
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
} from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// import icons
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

  const showSnackbar = (message) => {
    setSnackbar({ message, show: true });
    setTimeout(() => {
      setSnackbar({ message: "", show: false });
    }, 3000);
  };

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
        
        const filesQuery = query(collection(db, 'files'), where('uid', '==', user.uid), where('folder', '>=', folderRootPath));
        const filesSnapshot = await getDocs(filesQuery);
        
        const foldersQuery = query(collection(db, 'folders'), where('uid', '==', user.uid), where('fullPath', '>=', `${supabaseRootPath}/`));
        const foldersSnapshot = await getDocs(foldersQuery);

        const totalDeletions = filesSnapshot.size + foldersSnapshot.size;
        setDeleteProgress({ total: totalDeletions, completed: 0 });

        filesSnapshot.forEach(doc => {
          firestoreBatch.delete(doc.ref);
          supabasePathsToDelete.add(doc.data().fullPath);
          setDeleteProgress(prev => ({...prev, completed: prev.completed + 1}));
        });
        
        foldersSnapshot.forEach(doc => {
          firestoreBatch.delete(doc.ref);
          supabasePathsToDelete.add(doc.data().fullPath + '.placeholder');
          setDeleteProgress(prev => ({...prev, completed: prev.completed + 1}));
        });

        supabasePathsToDelete.add(`${supabaseRootPath}/.placeholder`);
        const rootFolderDocId = btoa(`${supabaseRootPath}/`);
        const rootFolderDocRef = doc(db, "folders", rootFolderDocId);
        const rootFolderDocSnap = await getDoc(rootFolderDocRef);
        if (rootFolderDocSnap.exists()) {
            firestoreBatch.delete(rootFolderDocRef);
        }

        await firestoreBatch.commit();
        
        const paths = Array.from(supabasePathsToDelete);
        if (paths.length > 0) {
            const { error: removeError } = await supabase.storage.from("files").remove(paths);
            if (removeError) {
                console.error("Supabase bulk delete failed:", removeError);
                throw removeError;
            }
        }
        
        showSnackbar(`Folder "${item.name}" deleted.`);
      }
    } catch (error) {
        console.error("A critical error occurred during deletion:", error);
        showSnackbar("Deletion failed. Check console.");
    } finally {
        setIsDeleting(false);
        fetchData(); 
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

  return (
    <div className="min-h-screen bg-black text-white font-press flex flex-col">
      {/* --- ADDED STYLE TAG TO HIDE SCROLLBARS --- */}
      <style>
        {`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelectChange}
            className="hidden"
            multiple
        />
      <div className="flex justify-between items-center p-4 border-b border-white">
        <h1 className="text-2xl">CODESPACEXO</h1>
        <button
          onClick={handleLogout}
          className="flex items-center bg-white text-black px-3 py-1 text-sm hover:bg-gray-200 md:px-2"
        >
          <img src={BackIcon} alt="back" className="w-6 h-6" />
          <span className="ml-2 hidden md:inline">Exit</span>
        </button>
      </div>

      <div
        className={`flex-1 flex flex-col md:flex-row transition overflow-hidden ${
          dragging ? "bg-gray-800 border-4 border-dashed border-white" : ""
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onContextMenu={(e) => { e.preventDefault(); setFolderContextMenu(null); setContextMenu({ x: e.pageX, y: e.pageY }); }}
        onClick={() => { setContextMenu(null); setFolderContextMenu(null); }}
      >
        <div className="md:w-1/3 border-r border-white p-4 space-y-3 overflow-y-auto">
          {currentFolder && (
            <div
              className="flex items-center justify-center border-2 border-white text-white font-bold py-2 cursor-pointer hover:bg-gray-900"
              onClick={handleBack}
            >
              ◀ Back
            </div>
          )}
          {folders.map((folder) => (
            <div
              key={folder.name}
              className="flex items-center justify-center border-2 border-white text-white font-bold py-2 cursor-pointer hover:bg-gray-900"
              onClick={() => {
                if (longPressTriggeredRef.current) return;
                setCurrentFolder(currentFolder ? currentFolder + "/" + folder.name : folder.name);
              }}
              onTouchStart={(e) => handleTouchStart(e, folder)}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => { 
                e.stopPropagation(); 
                e.preventDefault(); 
                setContextMenu(null);
                setFolderContextMenu({ x: e.pageX, y: e.pageY, folder }); 
              }}
            >
              <img src={FolderIcon} alt="folder" className="w-5 h-5 mr-3 filter invert" />
              {folder.name}
            </div>
          ))}
        </div>

        <div 
          className={`flex-1 p-4 space-y-2 ${
            previewFile ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {previewFile ? (
            <div className="flex flex-col h-full">
             <div className="flex items-center justify-between border-b border-white pb-2 mb-2">
  <button
    onClick={() => { 
      setPreviewFile(null); 
      setPreviewContent("");
      setPreviewUrl("");
    }}
    className="flex items-center bg-white text-black px-2 py-1 text-sm hover:bg-gray-200 flex-shrink-0"
  >
    <img src={BackIcon} alt="back" className="w-4 h-4 mr-1" />
    Back
  </button>
  <span className="ml-2 font-bold truncate flex-1 min-w-0 text-right"> {previewFile.name} </span>
</div>
              
             {/* --- MODIFIED PREVIEW AREA --- */}
{/* --- REPLACEMENT: Preview area that fits on mobile with internal X/Y scroll --- */}
<div className="flex-1 border border-white text-sm bg-neutral-900 
                max-h-[70vh] md:max-h-[80vh] overflow-auto 
                no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
  {previewUrl.endsWith(".pdf") ? (
    <div className="w-full h-full p-2 flex justify-center items-start overflow-auto 
                   no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* iframe constrained so it won't push the page height; inner container scrolls if needed */}
      <iframe
        src={previewUrl}
        title={previewFile.name}
        className="w-full"
        style={{ border: "none", minHeight: "80vh", maxHeight: "80vh" }}
      />
    </div>
  ) : (previewUrl.endsWith('.png') || previewUrl.endsWith('.jpeg') || previewUrl.endsWith('.svg') || previewUrl.endsWith('.jpg')) ? (
    <div className="w-full h-full flex items-center justify-center p-2 overflow-auto 
                   no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* image limited to max height inside preview container so it won't force page scroll */}
      <img
        src={previewUrl}
        alt={previewFile.name}
        className="max-w-full max-h-[65vh] object-contain"
      />
    </div>
  ) : (
    // code / text preview — allow both horizontal and vertical scrolling inside this box
    <div className="w-full h-full overflow-auto p-2 
                   no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <pre className="whitespace-pre font-mono text-sm break-words overflow-auto 
                     no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {previewContent}
      </pre>
    </div>
  )}
</div>
{/* --------------------------- */}

              {/* --------------------------- */}

            </div>
          ) : loading ? (
            <p>Loading...</p>
          ) : files.length === 0 && folders.length === 0 ? (
            <p>Drag & drop or right-click to add content.</p>
          ) : files.length === 0 ? (
            <p>No files here. Drag & drop to upload.</p>
          ) : (
            files.map((file) => {
              const publicUrl = supabase.storage.from("files").getPublicUrl(file.fullPath).data.publicUrl;
              {/* --- ADDED UNIQUE ID FOR STARRING --- */}
              const docId = btoa(file.fullPath);
              return (
                <div
  key={file.id || file.name} // Use file.id which is the docId
  className="flex justify-between items-center bg-white text-black px-0 py-0 cursor-pointer"
  onClick={() => {
    setFileContextMenu(null);
    setFolderContextMenu(null);
    handlePreviewFile(file);
  }}
  onContextMenu={(e) => {
    e.stopPropagation();
    e.preventDefault();
    setContextMenu(null);
    setFolderContextMenu(null);
    setFileContextMenu({ x: e.pageX, y: e.pageY, file: file });
  }}
>
                  {/* FILES VIEW */}
                  <span className="truncate px-3 py-2 min-w-0 flex-1">{file.name}</span>
                  <div className="flex flex-shrink-0" onClick={(e) => e.stopPropagation()} >
                    <button onClick={() => requestDeleteFile(file)} className="px-3 py-2 hover:bg-red-600" title="Delete File" >
                      <img src={DeleteIcon} alt="delete" className="w-5 h-5" />
                    </button>
                    {/* --- MODIFIED STAR BUTTON TO USE UNIQUE ID --- */}
                    <button 
                        onClick={() => handleStarFile(file)} 
                        className="px-3 py-2 hover:bg-yellow-600" 
                        title={ starred[docId] ? "Make Private" : "Make Public (24h)" } 
                    >
                      <img src={starred[docId] ? StarOnIcon : StarOffIcon} alt="star" className="w-5 h-5 transition" />
                    </button>
                    {/* --- END MODIFIED --- */}
                    
                    {file.isClipboard ? (
  <button
    onClick={() => handleCopyContent(file)}
    className="px-3 py-2 hover:bg-blue-200"
    title="Copy Content"
  >
    <img src={CopyIcon} alt="Copy content" className="w-5 h-5" />
  </button>
) : (
  <a
    href={publicUrl}
    target="_blank"
    rel="noreferrer"
    className="px-3 py-2 hover:bg-gray-200"
    title="Download File"
  >
    <img src={DownloadIcon} alt="download" className="w-5 h-5" />
  </a>
)}

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="absolute bg-black border border-white shadow p-2 z-20"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={() => setContextMenu(null)}
        >
          <button onClick={requestCreateFolder} className="flex items-center gap-3 w-full text-left px-2 py-2 hover:bg-gray-900" >
            <img src={AddFolderIcon} alt="add folder" className="w-5 h-5 filter invert" />
            New Folder
          </button>
          <button onClick={requestCreateFile} className="flex items-center gap-3 w-full text-left px-2 py-2 hover:bg-gray-900" >
            <img src={AddNoteIcon} alt="add note" className="w-5 h-5 filter invert" />
            New Note
          </button>
          <button onClick={handleFileSelectClick} className="flex items-center gap-3 w-full text-left px-2 py-2 hover:bg-gray-900" >
            <img src={AddFileIcon} alt="add file" className="w-5 h-5 filter invert" />
            New File
          </button>
        </div>
      )}

     {folderContextMenu && (
        <div
          className="absolute bg-black border border-white shadow p-1 z-20"
          style={{ top: folderContextMenu.y, left: folderContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleDownloadFolder(folderContextMenu.folder)}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-900 flex items-center gap-2"
          >
            <img 
              src={DownloadIcon} 
              alt="download" 
              className="w-4 h-4 filter invert mr-3"
            />
            Download
          </button>
          
          {/* --- THIS BUTTON IS NOW FIXED --- */}
          <button
            onClick={() => {
              requestRename(folderContextMenu.folder, 'folder'); // <-- THE FIX IS HERE
            }}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-900 flex items-center gap-2"
          >
            <img 
              src={RenameIcon} 
              alt="rename" 
              className="w-4 h-4 filter invert mr-3"
            />
            Rename
          </button>
          {/* --- END FIX --- */}

          <button
            onClick={() => requestDeleteFolder(folderContextMenu.folder)}
            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-900 flex items-center gap-2"
          >
            <img 
              src={DeleteIcon} 
              alt="delete" 
              className="w-4 h-4 filter invert mr-3"
            />
            Delete
          </button>
        </div>
      )}


      {/* --- ADD FILE CONTEXT MENU --- */}
      {fileContextMenu && (
        <div
          className="absolute bg-black border border-white shadow p-1 z-20"
          style={{ top: fileContextMenu.y, left: fileContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setFileContextMenu(null);
              requestRename(fileContextMenu.file, 'file');
            }}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-900 flex items-center gap-2"
          >
            <img 
              src={RenameIcon} 
              alt="rename" 
              className="w-4 h-4 filter invert mr-3"
            />
            Rename
          </button>
          {/* <button
            onClick={() => {
              setFileContextMenu(null);
              requestDeleteFile(fileContextMenu.file);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-900 flex items-center gap-2"
          >
            <img 
              src={DeleteIcon} 
              alt="delete" 
              className="w-4 h-4 filter invert mr-3"
            />
            Delete
          </button> */}
        </div>
      )}
      {/* --- END FILE CONTEXT MENU --- */}

      

      {snackbar.show && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-lg shadow-lg text-center z-50 animate-pulse">
          {snackbar.message}
        </div>
      )}

      {isUploading && (
        <div className="fixed bottom-5 right-5 bg-gray-900 border border-white p-3 rounded-lg shadow-lg w-64 z-50">
            <p className="text-sm mb-2 text-white">
              Uploading {uploadProgress.completed} of {uploadProgress.total} files...
            </p>
            <div className="w-full bg-black border border-white h-4 p-[2px]">
                <div
                    className="bg-white h-full transition-all duration-150"
                    style={{
                        width: uploadProgress.total > 0 ? `${(uploadProgress.completed / uploadProgress.total) * 100}%` : '0%',
                    }}
                ></div>
            </div>
        </div>
      )}

      {isDownloading && (
        <div className="fixed bottom-5 right-5 bg-gray-900 border border-white p-3 rounded-lg shadow-lg w-64 z-50">
            <p className="text-sm mb-2 text-white">
                Downloading {downloadProgress.completed} of {downloadProgress.total} files...
            </p>
            <div className="w-full bg-black border border-white h-4 p-[2px]">
                <div
                    className="bg-blue-500 h-full transition-all duration-150"
                    style={{
                        width: downloadProgress.total > 0 ? `${(downloadProgress.completed / downloadProgress.total) * 100}%` : '0%',
                    }}
                ></div>
            </div>
        </div>
      )}

      {/* --- ADD RENAMING INDICATOR --- */}
    {isRenaming && (
      <div className="fixed bottom-5 right-5 bg-gray-900 border border-white p-3 rounded-lg shadow-lg w-64 z-50">
        <p className="text-sm mb-2 text-white">
          Renaming {renameProgress.completed} of {renameProgress.total} items...
        </p>
        <div className="w-full bg-black border border-white h-4 p-[2px]">
          <div
            className="bg-yellow-500 h-full transition-all duration-150"
            style={{
              width: renameProgress.total > 0 ? `${(renameProgress.completed / renameProgress.total) * 100}%` : '0%',
            }}
          ></div>
        </div>
      </div>
    )}

      {isDeleting && !isDownloading && (
        <div className="fixed bottom-5 right-5 bg-gray-900 border border-white p-3 rounded-lg shadow-lg w-64 z-50">
<p className="text-sm mb-2 text-white">
              Deleting {deleteProgress.completed} of {deleteProgress.total} items...
            </p>
            <div className="w-full bg-black border border-white h-4 p-[2px]">
                <div
                    className="bg-red-500 h-full transition-all duration-150"
                    style={{
                        width: deleteProgress.total > 0 ? `${(deleteProgress.completed / deleteProgress.total) * 100}%` : '0%',
                    }}
                ></div>
            </div>
        </div>
      )}
      
      {showDeleteDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]">
          <div className="bg-black border-2 border-white p-8 rounded-lg shadow-lg text-center max-w-sm mx-auto">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
<p className="mb-6 text-white">
              Are you sure you want to delete <span className="font-bold break-all">"{showDeleteDialog.item?.name}"</span>?
              {showDeleteDialog.type === 'folder' && <span className="block mt-2 text-sm text-yellow-400">All contents within this folder will be permanently removed.</span>}
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowDeleteDialog({ show: false, item: null, type: '' })}
                className="bg-white text-black px-6 py-2 hover:bg-gray-300"
              >
Cancel
              </button>
<button
                onClick={handleConfirmDelete}
                className="bg-red-600 text-white px-6 py-2 hover:bg-red-700 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
</button>
            </div>
          </div>
        </div>
      )}

      {showCreateFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]">
          <form onSubmit={handleConfirmCreateFolder} className="bg-black border-2 border-white p-8 rounded-lg shadow-lg text-center max-w-sm mx-auto">
            <h2 className="text-xl font-bold mb-4">Create New Folder</h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-gray-800 border border-white text-white p-2 mb-6 focus:outline-none focus:ring-2 focus:ring-white"
              placeholder="Enter folder name..."
              autoFocus
            />
            <div className="flex justify-center gap-4">
<button
                type="button"
                onClick={() => { setShowCreateFolderDialog(false); setNewFolderName(""); }}
                className="bg-gray-600 text-white px-6 py-2 hover:bg-gray-700"
              >
Cancel
              </button>
              <button
                type="submit"
                className="bg-white text-black px-6 py-2 hover:bg-gray-300 disabled:opacity-50"
                disabled={!newFolderName.trim()}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {showCreateFileDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
          <div className={`bg-black border-2 border-white p-8 rounded-lg shadow-lg text-center w-full max-w-lg mx-auto flex flex-col transition-all duration-300 ${createFileStep === 'name' ? 'h-auto' : 'h-[70vh]'}`}>
            {createFileStep === 'name' ? (
              <form onSubmit={handleNameToContentStep} className="flex flex-col">
                <h2 className="text-xl font-bold mb-4">Create New Note</h2>
                <p className="mb-6 text-gray-400">Step 1: Enter note name.</p>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full bg-gray-800 border border-white text-white p-2 mb-6 focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="eg: note (or leave blank)"
                  autoFocus
                />
<div className="mt-auto flex justify-center gap-4">
                  <button type="button" onClick={handleCancelCreateFile} className="bg-gray-600 text-white px-6 py-2 hover:bg-gray-700">
                    Cancel
                  </button>
                  <button type="submit" className="bg-white text-black px-6 py-2 hover:bg-gray-300">
Next
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveNewFile} className="flex flex-col h-full">
                <h2 className="text-xl font-bold mb-2 truncate" title={validatedFileName}>
                    Note: <span className="text-yellow-400">{validatedFileName}</span>
</h2>
                <p className="mb-4 text-gray-400">Step 2: Add note content.</p>
                <textarea
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  className="w-full flex-1 bg-gray-900 border border-white text-white p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-white resize-none font-mono"
                  placeholder="Type or paste content here..."
                  autoFocus
                />
                <div className="mt-auto flex justify-center gap-4">
                  <button type="button" onClick={handleCancelCreateFile} className="bg-gray-600 text-white px-6 py-2 hover:bg-gray-700">
Cancel
                  </button>
                  <button type="submit" className="bg-white text-black px-6 py-2 hover:bg-gray-300">
Save Note
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- ADD RENAME DIALOG --- */}
    {showRenameDialog.show && (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]">
        <form onSubmit={handleConfirmRename} className="bg-black border-2 border-white p-8 rounded-lg shadow-lg text-center max-w-sm mx-auto">
          <h2 className="text-xl font-bold mb-4">Rename {showRenameDialog.type}</h2>
          <p className="mb-2 text-sm text-gray-400">Change</p>
          <p className="mb-4 font-bold break-all">"{showRenameDialog.item?.name}"</p>
          <p className="mb-2 text-sm text-gray-400">To</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full bg-gray-800 border border-white text-white p-2 mb-6 focus:outline-none focus:ring-2 focus:ring-white"
            placeholder="Enter new name..."
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => { setShowRenameDialog({ show: false, item: null, type: '' }); setNewName(""); }}
              className="bg-gray-600 text-white px-6 py-2 hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-white text-black px-6 py-2 hover:bg-gray-300 disabled:opacity-50"
              disabled={!newName.trim() || newName.trim() === showRenameDialog.item?.name}
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    )}
    {/* --- END RENAME DIALOG --- */}
    </div>
  );
}