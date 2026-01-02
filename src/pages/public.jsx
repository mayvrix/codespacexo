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
  
  // Viewer State
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  
  // Loading States
  const [loading, setLoading] = useState(true); 
  const [contentLoading, setContentLoading] = useState(false); 
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Responsive Check (Outside Return)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navigate = useNavigate();

  // --- 1. FETCH PUBLIC FILES ---
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

  // --- 2. HANDLE FILE PREVIEW ---
  const handlePreview = async (file) => {
    setPreviewFile(file);
    setPreviewContent("");
    setPreviewUrl("");
    setContentLoading(true);

    const ext = file.name.split('.').pop().toLowerCase();
    const path = file.path;

    try {
      if (['png', 'jpeg', 'jpg', 'svg', 'gif'].includes(ext)) {
        const { data } = supabase.storage.from("files").getPublicUrl(path);
        setPreviewUrl(data.publicUrl);
      } 
      else if (ext === 'pdf') {
        const { data } = supabase.storage.from("files").getPublicUrl(path);
        setPreviewUrl(data.publicUrl);
      } 
      else {
        const { data, error } = await supabase.storage.from("files").download(path);
        if (error) throw error;
        
        if (data) {
          const text = await data.text();
          setPreviewContent(text);
        } else {
          setPreviewContent("Error: File is empty.");
        }
      }
    } catch (error) {
      console.error("Error loading file:", error);
      setPreviewContent(`Error loading file: ${error.message}`);
    } finally {
      setContentLoading(false);
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

  // --- 3. SYNTAX HIGHLIGHTER ---
  const renderHighlightedCode = (code, fileName) => {
    if (!code) return <span className="text-gray-500">No content.</span>;
    // Keeping original extraction to maintain Markdown compatibility
    const ext = fileName.split('.').pop().toLowerCase(); 
    const lines = code.split("\n");

    return lines.map((line, lineIndex) => {
      
      // --- MARKDOWN (.md) ---
      if (ext === "md") {
        // 1. Headers
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
            let level = 0;
            for (let char of trimmed) {
                if (char === "#") level++;
                else break;
            }
            if (level >= 1 && level <= 6) {
                const content = trimmed.substring(level).trim();
                let fontSize = "text-base font-bold text-gray-200 mt-2 mb-1";
                if (level === 1) fontSize = "text-2xl font-press text-blue-400 border-b border-white/20 pb-2 mt-6 mb-4"; 
                if (level === 2) fontSize = "text-2xl font-bold font-doto text-blue-300 mt-5 mb-3"; 
                if (level === 3) fontSize = "text-xl font-bold font-doto text-purple-300 mt-4 mb-2";  
                if (level === 4) fontSize = "text-lg font-semibold font-doto text-white mt-3 mb-2";  
                return <div key={lineIndex} className={fontSize}>{content}</div>;
            }
        }
        // 2. Blockquotes
        if (trimmed.startsWith(">")) {
             const content = trimmed.substring(1).trim();
             return (
                <div key={lineIndex} className="font-doto min-h-[1.2em] italic text-gray-400 border-l-4 border-gray-600 pl-4 py-1 my-2 bg-white/5 rounded-r">
                    {content}
                </div>
             );
        }
        // 3. Horizontal Rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            return <div key={lineIndex} className="border-t border-white/20 my-6"></div>;
        }
        // 4. Tokenize Line
        const regex = /(\*\*.*?\*\*)|(`.*?`)|(\[.*?\]\(.*?\))|(^\s*[-*]\s)|(^\s*\d+\.\s)/g;
        const tokens = line.split(regex).filter((t) => t !== undefined && t !== "");
        return (
            <div key={lineIndex} className="min-h-[1.2em] leading-relaxed my-1">
                {tokens.map((token, i) => {
                    if (token.startsWith("**") && token.endsWith("**")) return <span key={i} className="font-doto text-orange-400 font-bold">{token.slice(2, -2)}</span>;
                    if (token.startsWith("`") && token.endsWith("`")) return <span key={i} className="text-green-400 bg-white/10 rounded px-1 font-doto text-[0.9em]">{token.slice(1, -1)}</span>;
                    if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
                        const linkText = token.match(/\[(.*?)\]/)[1];
                        return <span key={i} className="font-doto text-cyan-400 underline decoration-dotted cursor-pointer hover:text-cyan-300">{linkText}</span>;
                    }
                    if (/^\s*[-*]\s/.test(token) || /^\s*\d+\.\s/.test(token)) return <span key={i} className="text-yellow-400 mr-2 font-bold inline-block ml-1 select-none">{token.trim()}</span>;
                    return <span key={i} className="font-doto text-white">{token}</span>;
                })}
            </div>
        );
      }

      // --- PYTHON (.py) ---
      else if (ext === "py") {
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
      // --- C-LIKE LANGUAGES ---
      else if (["java", "cpp", "c", "h", "hpp", "cc", "js", "jsx", "ts", "tsx", "dart"].includes(ext)) {
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
                // Combined keywords to ensure JS/TS/Dart don't break while fixing Java/CPP
                const greenKeywords = ["if", "else", "for", "while", "return", "public", "private", "class", "void", "int", "boolean", "const", "let", "var", "function", "import", "export", "default"];
                if (greenKeywords.includes(token)) return <span key={i} className="text-green-500">{token}</span>;
                return <span key={i} className="text-white">{token}</span>;
              }
              return <span key={i} className="text-yellow-300">{token}</span>;
            })}
          </div>
        );
      } 
      // --- DEFAULT ---
      else {
        return <div key={lineIndex} className="min-h-[1.2em] text-white">{line}</div>;
      }
    });
  };

  // --- 4. RENDER HELPER FOR CONTENT ---
  const renderPreviewContent = () => {
    if (contentLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-green-400 animate-pulse font-press text-xs">LOADING DATA...</p>
            </div>
        );
    }

    const ext = previewFile.name.split('.').pop().toLowerCase();

    if (['png', 'jpeg', 'jpg', 'svg', 'gif'].includes(ext)) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <img src={previewUrl} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
        );
    }

    if (ext === 'pdf') {
        return (
            <iframe src={previewUrl} title={previewFile.name} className="w-full h-full border-none rounded-md" />
        );
    }

    // Default: Code/Text
    return (
        <div className="h-full">
            <pre className="font-space text-xs whitespace-pre-wrap text-gray-300">
                {renderHighlightedCode(previewContent, previewFile.name)}
            </pre>
        </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden font-press flex flex-col transition-colors duration-300 bg-black text-white p-4 md:p-6">
      <style>
        {`
          .font-press { font-family: 'Press Start 2P', monospace; }
          /* Global Scrollbar Hide */
          ::-webkit-scrollbar { display: none; }
          * { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>

      {/* --- HEADER --- */}
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center mb-6 z-40 relative border-b border-white/10 pb-6 flex-shrink-0">
        <div className="justify-self-start">
            <button 
                onClick={() => window.history.back()} 
                className="px-6 py-2 rounded-full border border-white/20 hover:bg-white/10 transition group flex items-center justify-center"
            >
                <img src={BackLeftIcon} className="w-4 h-6 filter invert group-hover:scale-110 transition" alt="Back" />
            </button>
        </div>
        
        {/* Toggle based on isDesktop state */}
        {isDesktop ? (
            <h1 className="text-2xl tracking-widest text-white text-center">CODESPACEXO</h1>
        ) : (
            <div className="flex justify-center">
                 <img src={XOIcon} className="h-14 w-auto" alt="Logo" />
            </div>
        )}
        
        <div className="justify-self-end"></div>
      </div>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden gap-6 relative h-full">
        
        {/* --- PANEL 1: FILE LIST (LEFT) --- */}
        { (isDesktop || !previewFile) && (
            <div
            className="flex flex-col md:w-1/3 w-full rounded-[20px] border border-white/20 p-4 overflow-y-auto flex-shrink-0 bg-[#0a0a0a]"
            >
            {loading ? (
                <p className="text-sm opacity-50 p-2 text-center">Loading public files...</p>
            ) : userData.length === 0 ? (
                <p className="text-sm opacity-50 p-2 text-center">No public files available.</p>
            ) : (
                userData.map((user) => (
                <div key={user.id} className="mb-6">
                    <div className="text-base font-bold tracking-wide text-lime-400 mb-2 px-2">
                        {user.name}
                    </div>
                    <div className="flex flex-col gap-2 border-l-2 border-white ml-3 pl-3">
                        {user.files.map((file) => (
                        <div
                            key={file.path}
                            className={`flex items-center cursor-pointer group p-3 rounded-xl transition-all border 
                                    ${previewFile?.path === file.path ? "bg-white/10 border-white/40" : "border-white/5 hover:border-white/20 hover:bg-white/5"}`}
                            onClick={() => handlePreview(file)}
                        >
                            <span className="text-sm truncate font-space w-full text-gray-300 group-hover:text-white">
                                {file.name}
                            </span>
                        </div>
                        ))}
                    </div>
                </div>
                ))
            )}
            </div>
        )}

        {/* --- PANEL 2: PREVIEW WINDOW (RIGHT) --- */}
        { isDesktop ? (
            // DESKTOP: Full Height Match
            <div className="flex-1 flex flex-col bg-transparent overflow-hidden h-full">
                {previewFile ? (
                    <div className="w-full h-full flex flex-col rounded-[12px] border border-white/20 overflow-hidden bg-[#111] shadow-2xl relative">
                         {/* Window Header */}
                        <div className="h-10 bg-[#1a1a1a] border-b border-white/10 flex items-center px-4 relative justify-center flex-shrink-0">
                            {/* Close Button */}
                            <div className="absolute left-4 flex items-center z-10">
                                <button
                                onClick={() => {
                                    setPreviewFile(null);
                                    setPreviewContent("");
                                    setPreviewUrl("");
                                }}
                                className="w-3.5 h-3.5 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 shadow-md transition-transform active:scale-90"
                                title="Close File"
                                ></button>
                            </div>

                            {/* File Name */}
                            <span className="font-space text-[10px] md:text-xs text-gray-400 tracking-wider truncate max-w-[50%]">
                                {previewFile.name}
                            </span>

                            {/* Actions */}
                            <div className="absolute right-4 flex items-center gap-3">
                                <button 
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="opacity-60 hover:opacity-100 transition"
                                    title="Download"
                                >
                                    <img src={DownloadIcon} className="w-4 h-4 filter invert" alt="DL" />
                                </button>
                                <button 
                                    onClick={handleCopy}
                                    disabled={isCopied || (['png', 'jpg', 'jpeg', 'pdf', 'svg'].includes(previewFile.name.split('.').pop().toLowerCase()))}
                                    className="opacity-60 hover:opacity-100 transition"
                                    title="Copy"
                                >
                                    {isCopied ? (
                                        <span className="text-[8px] text-green-400">OK</span>
                                    ) : (
                                        <img src={CopyIcon} className="w-4 h-4 filter invert" alt="CP" />
                                    )}
                                </button>
                            </div>
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-auto bg-black relative p-4">
                            {renderPreviewContent()}
                        </div>
                    </div>
                ) : (
                    // DESKTOP PLACEHOLDER
                    <div className="w-full h-full flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/20">
                         <p className="opacity-50 text-sm animate-pulse text-white">Select a file to preview</p>
                    </div>
                )}
            </div>
        ) : (
            // MOBILE: FULL SCREEN OVERLAY
            previewFile && (
                <div className="flex-1 flex flex-col rounded-[12px] border border-white/20 overflow-hidden bg-[#111] shadow-2xl relative">
                    <div className="h-10 bg-[#1a1a1a] border-b border-white/10 flex items-center px-4 relative justify-center flex-shrink-0">
                         {/* Close Button Mobile */}
                         <div className="absolute left-4 flex items-center z-10">
                            <button
                                onClick={() => {
                                    setPreviewFile(null);
                                    setPreviewContent("");
                                    setPreviewUrl("");
                                }}
                                className="w-3.5 h-3.5 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 shadow-md transition-transform active:scale-90"
                            ></button>
                        </div>
                        <span className="font-space text-[10px] text-gray-400 tracking-wider truncate max-w-[50%]">
                            {previewFile.name}
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto bg-black relative p-4">
                        {renderPreviewContent()}
                    </div>
                </div>
            )
        )}
      </div>
    </div>
  );
}