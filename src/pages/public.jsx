import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

// Icons
import BackLeftIcon from "../assets/backLeft.svg";
import DownloadIcon from "../assets/download.svg";
import CopyIcon from "../assets/copy.svg"; 
import XOIcon from '../assets/xoMod.png'; 

export default function Public() {
  const [userData, setUserData] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
   
  const navigate = useNavigate();

  // Fetch Public Files
  useEffect(() => {
    const fetchFilesAndUsers = async () => {
      setLoading(true);
      const publicFilesRef = collection(db, "publicFiles");
      const q = query(publicFilesRef, where("expiresAt", ">", Date.now()));
      const filesSnap = await getDocs(q);

      if (filesSnap.empty) {
        setUserData([]);
        setLoading(false);
        return;
      }

      const filesByUserId = {};
      const userIds = new Set();

      filesSnap.forEach((doc) => {
        const data = doc.data();
        if (data.usr && data.name && data.path) {
          userIds.add(data.usr);
          if (!filesByUserId[data.usr]) {
            filesByUserId[data.usr] = [];
          }
          filesByUserId[data.usr].push({ name: data.name, path: data.path });
        }
      });

      const userNamesMap = {};
      if (userIds.size > 0) {
        const usersRef = collection(db, "users");
        const userIdArray = [...userIds];
        const userChunks = [];
        for (let i = 0; i < userIdArray.length; i += 30) {
          userChunks.push(userIdArray.slice(i, i + 30));
        }

        for (const chunk of userChunks) {
          const usersQuery = query(usersRef, where(documentId(), "in", chunk));
          const usersSnap = await getDocs(usersQuery);
          usersSnap.forEach((doc) => {
            userNamesMap[doc.id] =
              doc.data().name || `user: ${doc.id.substring(0, 8)}...`;
          });
        }
      }

      const combinedData = Object.entries(filesByUserId).map(
        ([userId, files]) => ({
          id: userId,
          name: userNamesMap[userId] || `user: ${userId.substring(0, 8)}...`,
          files,
        })
      );

      setUserData(combinedData);
      setLoading(false);
    };

    fetchFilesAndUsers();
    const interval = setInterval(fetchFilesAndUsers, 60000);
    return () => clearInterval(interval);
  }, []);

  const handlePreview = async (file) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const path = file.path;
    setPreviewFile(file);

    if (
      ext === ".png" ||
      ext === ".jpeg" ||
      ext === ".svg" ||
      ext === ".jpg"
    ) {
      const { data } = supabase.storage.from("files").getPublicUrl(path);
      setPreviewUrl(data.publicUrl);
      setPreviewContent("");
    } else if (ext === ".pdf") {
      const { data } = supabase.storage.from("files").getPublicUrl(path);
      setPreviewUrl(data.publicUrl);
      setPreviewContent("");
    } else {
      setPreviewUrl("");
      try {
        const { data, error } = await supabase.storage
          .from("files")
          .download(path);
        if (error) throw error;
        if (data) {
          const text = await data.text();
          setPreviewContent(text);
        } else {
          setPreviewContent("Could not load file content.");
        }
      } catch (error) {
        console.error("Error downloading file content:", error);
        setPreviewContent(
          `Error: Could not load file content. ${error.message}`
        );
      }
    }
  };

  const handleDownload = async () => {
    if (!previewFile || isDownloading) return;
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("files")
        .download(previewFile.path);
      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", previewFile.name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!previewContent || isCopied) return;
    try {
      await navigator.clipboard.writeText(previewContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // --- CUSTOM SYNTAX HIGHLIGHTER ---
  const renderHighlightedCode = (code, fileName) => {
    if (!code) return "";
    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    const lines = code.split("\n");

    return lines.map((line, lineIndex) => {
      if (ext === ".py") {
        const regex = /(#.*)|("[^"]*")|('[^']*')|([\(\)])|([\[\]\{\}])|([.,;])|([+\-*/%=<>!&|^~]+)|(\b\w+\b)|(\s+)/g;
        const tokens = line.split(regex).filter((t) => t !== undefined && t !== "");
        return (
          <div key={lineIndex} className="min-h-[1.2em]">
            {tokens.map((token, i) => {
              if (token.startsWith("#")) return <span key={i} className="text-gray-500">{token}</span>;
              if (token.startsWith('"') || token.startsWith("'")) return <span key={i} className="text-blue-300">{token}</span>;
              if (token === "(" || token === ")") return <span key={i} className="text-red-400">{token}</span>;
              if (/^[+\-*/%=<>!&|^~]+$/.test(token)) return <span key={i} className="text-green-400">{token}</span>;
              if (/^\w+$/.test(token) && !/^\d+$/.test(token)) {
                 const pyKeywords = ["if", "elif", "else", "for", "while", "return", "def", "class", "import", "from", "try", "except"];
                 if (pyKeywords.includes(token)) return <span key={i} className="text-purple-400">{token}</span>;
                 return <span key={i} className="text-white">{token}</span>; 
              }
              return <span key={i} className="text-yellow-300">{token}</span>;
            })}
          </div>
        );
      } 
      else if ([".java", ".cpp", ".c", ".h", ".hpp", ".cc"].includes(ext)) {
        const regex = /(\/\/.*)|("[^"]*")|([\(\)])|([\[\]\{\}])|([.,;])|([+\-*/%=<>!&|^~]+)|(\b\w+\b)|(\s+)/g;
        const tokens = line.split(regex).filter((t) => t !== undefined && t !== "");
        return (
          <div key={lineIndex} className="min-h-[1.2em]">
            {tokens.map((token, i) => {
              if (token.trim().startsWith("//")) return <span key={i} className="text-gray-500">{token}</span>;
              if (token.startsWith('"')) return <span key={i} className="text-blue-300">{token}</span>;
              if (token === "(" || token === ")") return <span key={i} className="text-red-400">{token}</span>;
              if (/^[+\-*/%=<>!&|^~]+$/.test(token)) return <span key={i} className="text-green-400">{token}</span>;
              if (/^\w+$/.test(token) && !/^\d+$/.test(token)) {
                const greenKeywords = ["if", "else", "for", "while", "return", "public", "private", "class", "void", "int", "boolean"];
                if (greenKeywords.includes(token)) return <span key={i} className="text-green-500">{token}</span>;
                return <span key={i} className="text-white">{token}</span>;
              }
              return <span key={i} className="text-yellow-300">{token}</span>;
            })}
          </div>
        );
      } 
      else {
        return <div key={lineIndex} className="min-h-[1.2em] text-white">{line}</div>;
      }
    });
  };

  return (
    <div 
        className="min-h-screen font-press flex flex-col transition-colors duration-300 bg-black text-white p-4 md:p-6"
    >
      <style>
        {`
          .font-press { font-family: 'Press Start 2P', monospace; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #111; border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #555; }
        `}
      </style>

      {/* --- HEADER --- */}
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center mb-6 z-40 relative border-b border-white/10 pb-6">
        {/* Left: Back Button */}
        <div className="justify-self-start">
            <button 
                onClick={() => window.history.back()} 
                className="px-6 py-2 rounded-full border border-white/20 hover:bg-white/10 transition group flex items-center justify-center"
            >
                <img src={BackLeftIcon} className="w-4 h-6 filter invert group-hover:scale-110 transition" alt="Back" />
            </button>
        </div>
        
        {/* Center: Title / Logo */}
        {/* Desktop: Text "PUBLIC" */}
        <h1 className="hidden md:block text-2xl tracking-widest text-white">CODESPACEXO</h1>
        
        {/* Mobile: Logo "XOIcon" (Inverted because background is black) */}
        <div className="md:hidden flex justify-center">
             <img src={XOIcon} className="h-14 w-auto" alt="Logo" />
        </div>
        
        {/* Right: Spacer */}
        <div className="justify-self-end"></div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden gap-6">
        
        {/* --- PANEL 1: FILE LIST (LEFT) --- */}
        <div
          className={`
            ${previewFile ? "hidden md:block" : "w-full flex-1"} 
            md:w-1/3 rounded-[20px] border border-white/20 p-4 overflow-y-auto flex-shrink-0 bg-[#0a0a0a]
          `}
        >
          {loading ? (
            <p className="text-sm opacity-50 p-2 text-center">Loading public files...</p>
          ) : userData.length === 0 ? (
            <p className="text-sm opacity-50 p-2 text-center">No public files available.</p>
          ) : (
            userData.map((user) => (
              <div key={user.id} className="mb-6">
                
                {/* User Name */}
                <div className="text-sm font-bold tracking-wide text-white mb-2 px-2">
                    {user.name}
                </div>
                
                {/* File List with Vertical Line Indentation */}
                <div className="flex flex-col gap-2 border-l-2 border-white ml-3 pl-3">
                    {user.files.map((file) => (
                    <div
                        key={file.path}
                        className="flex items-center cursor-pointer group p-3 rounded-xl transition-all border border-white/5 hover:border-white/20 hover:bg-white/5"
                        onClick={() => handlePreview(file)}
                    >
                        <span className="text-xs truncate font-press w-full text-gray-300 group-hover:text-white">
                             {file.name}
                        </span>
                    </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* --- PANEL 2: PREVIEW (RIGHT) --- */}
        {previewFile && (
          <div 
             className="flex-1 flex flex-col rounded-[20px] border border-white/20 overflow-hidden bg-[#111]"
          >
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0a0a0a]">
              
              {/* Left Side: Mobile Back Button & File Name */}
              <div className="flex items-center gap-3 overflow-hidden flex-1 md:flex-none">
                  {/* Mobile Back Button (Mac Red Circle Design) */}
                  <button
                   onClick={() => {
                     setPreviewFile(null);
                     setPreviewContent("");
                     setPreviewUrl("");
                   }}
                   className="md:hidden w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 shadow-md ml-1"
                  >
                   {/* Icon removed for clean Mac circle look */}
                  </button>

                  {/* File Name */}
                  <span className="truncate font-press text-[10px] md:text-xs opacity-70 text-white tracking-wider flex-1 text-center md:text-left md:flex-none">
                     {previewFile.name}
                  </span>
              </div>
              
              {/* Right Side: Action Buttons (Hidden on Mobile) */}
              <div className="hidden md:flex items-center gap-3">
                 <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-6 py-2 rounded-full text-[10px] font-bold border-2 border-white/20 transition hover:opacity-100 text-white tracking-wider bg-black hover:border-[#2563eb]"
                >
                  {isDownloading ? "..." : "SAVE"}
                </button>

                <button
                  onClick={handleCopy}
                  disabled={isCopied || !!previewUrl}
                  className="px-6 py-2 rounded-full text-[10px] font-bold border-2 border-white/20 transition hover:opacity-100 bg-black text-white tracking-wider hover:border-[#ea580c]"
                >
                  {isCopied ? "COPIED" : "COPY"}
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto bg-black relative p-4">
              {previewUrl.endsWith(".pdf") ? (
                <iframe
                  src={previewUrl}
                  title={previewFile.name}
                  className="w-full h-full border-none rounded-xl"
                />
              ) : previewUrl.endsWith(".png") ||
                previewUrl.endsWith(".jpeg") ||
                previewUrl.endsWith(".svg") ||
                previewUrl.endsWith(".jpg") ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="h-full">
                  <pre className="font-mono text-xs whitespace-pre-wrap text-gray-300">
                    {renderHighlightedCode(previewContent, previewFile.name)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- PANEL 3: PLACEHOLDER (RIGHT) --- */}
        {!previewFile && (
          <div 
             className="hidden md:flex flex-1 items-center justify-center rounded-[20px] border border-dashed border-white/20"
          >
            <p className="opacity-50 text-sm animate-pulse text-white">Select a file to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}