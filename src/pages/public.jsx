// src/pages/Public.jsx
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

export default function Public() {
  const [userData, setUserData] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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

    const isNumber = (str) => /^\d+$/.test(str);

    return lines.map((line, lineIndex) => {
      // --- PYTHON (.py) ---
      if (ext === ".py") {
        // Regex Priority: Comments (#.*) capture the REST of the line
        const regex = /(#.*)|("[^"]*")|('[^']*')|([\(\)])|([\[\]\{\}])|([.,;])|([+\-*/%=<>!&|^~]+)|(\b\w+\b)|(\s+)/g;
        const tokens = line.split(regex).filter((t) => t !== undefined && t !== "");

        return (
          <div key={lineIndex} className="min-h-[1.2em]">
            {tokens.map((token, i) => {
              // 1. Comments: Pure White (Absolute Priority)
              if (token.startsWith("#")) {
                return <span key={i} className="text-white">{token}</span>;
              }
              // 2. Strings: Neon Blue
              if (token.startsWith('"') || token.startsWith("'")) {
                return <span key={i} className="text-blue-300">{token}</span>;
              }
              // 3. Arguments (Parens): Red
              if (token === "(" || token === ")") {
                return <span key={i} className="text-red-500">{token}</span>;
              }
              // 4. Operators: Dark Green
              if (/^[+\-*/%=<>!&|^~]+$/.test(token)) {
                return <span key={i} className="text-green-600">{token}</span>;
              }
              
              // 5. Keywords & Variables
              if (/^\w+$/.test(token) && !isNumber(token)) {
                 const pyKeywords = [
                   "if", "elif", "else", "for", "while", "return", "def", "class", 
                   "import", "from", "try", "except", "break", "continue", "pass", 
                   "in", "is", "not", "and", "or", "with", "as", "global", "lambda"
                 ];
                 
                 // Control Flow / Keywords: Dark Green
                 if (pyKeywords.includes(token)) {
                    return <span key={i} className="text-green-600">{token}</span>;
                 }

                 // Method Name Detection (Purple)
                 let isMethod = false;
                 for(let j=i+1; j < tokens.length; j++){
                    if(tokens[j].trim() === "") continue; 
                    if(tokens[j] === "(") isMethod = true;
                    break;
                 }
                 if (isMethod) {
                     return <span key={i} className="text-purple-500">{token}</span>;
                 }

                 // Variable Names: Cream
                 return <span key={i} className="text-[#ffe4c4]">{token}</span>; 
              }

              // All other (Numbers, punctuation): Yellow
              return <span key={i} className="text-yellow-300">{token}</span>;
            })}
          </div>
        );
      } 
      
      // --- JAVA / C++ / C (.java, .cpp, .c, .h) ---
      else if ([".java", ".cpp", ".c", ".h", ".hpp", ".cc"].includes(ext)) {
        // Regex Priority: Comments (//.*) capture the REST of the line
        const regex = /(\/\/.*)|("[^"]*")|([\(\)])|([\[\]\{\}])|([.,;])|([+\-*/%=<>!&|^~]+)|(\b\w+\b)|(\s+)/g;
        const tokens = line.split(regex).filter((t) => t !== undefined && t !== "");

        return (
          <div key={lineIndex} className="min-h-[1.2em]">
            {tokens.map((token, i) => {
              // 1. Comments: Pure White (Absolute Priority)
              if (token.trim().startsWith("//")) {
                return <span key={i} className="text-white">{token}</span>;
              }
              // 2. Strings: Neon Blue
              if (token.startsWith('"')) {
                return <span key={i} className="text-blue-300">{token}</span>;
              }
              // 3. Arguments (Parens): Red
              if (token === "(" || token === ")") {
                return <span key={i} className="text-red-500">{token}</span>;
              }
              // 4. Operators: Dark Green
              if (/^[+\-*/%=<>!&|^~]+$/.test(token)) {
                return <span key={i} className="text-green-600">{token}</span>;
              }

              // 5. Word Analysis
              if (/^\w+$/.test(token) && !isNumber(token)) {
                // Control Flow / Access Modifiers: Dark Green
                const greenKeywords = [
                    "if", "else", "for", "while", "do", "switch", "case", 
                    "default", "break", "continue", "return", "catch", "try",
                    "public", "private", "protected", "static", "class", 
                    "struct", "namespace", "using", "include", "import", "void"
                ];

                if (greenKeywords.includes(token)) {
                    return <span key={i} className="text-green-600">{token}</span>;
                }

                // Types: Pink
                const types = [
                  "int", "float", "double", "char", "long", "short", 
                  "bool", "boolean", "String", "auto", "const", "final", 
                  "unsigned", "signed"
                ];

                if (types.includes(token)) {
                   return <span key={i} className="text-pink-500">{token}</span>;
                }
                
                // Method Name Detection (Purple)
                let isMethod = false;
                for(let j=i+1; j < tokens.length; j++){
                    if(tokens[j].trim() === "") continue; 
                    if(tokens[j] === "(") isMethod = true;
                    break;
                }
                if (isMethod) {
                     return <span key={i} className="text-purple-500">{token}</span>;
                }

                // Variable Name: Cream Skin Color
                return <span key={i} className="text-[#ffe4c4]">{token}</span>;
              }

              // All other (Numbers, punctuation, etc): Yellow
              return <span key={i} className="text-yellow-300">{token}</span>;
            })}
          </div>
        );
      } 
      
      // --- DEFAULT (Other Languages) ---
      else {
        return <div key={lineIndex} className="text-white min-h-[1.2em]">{line}</div>;
      }
    });
  };

  return (
    <div className="min-h-screen bg-black text-white font-press flex flex-col">
      <div className="flex justify-center items-center p-4 border-b border-white">
        <h1 className="text-2xl">CODESPACEXO</h1>
      </div>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* --- PANEL 1: FILE LIST (LEFT) --- */}
        <div
          className={`
            ${previewFile ? "hidden md:block" : "w-full"} 
            md:w-1/3 border-r border-white p-4 overflow-y-auto space-y-4 flex-shrink-0
          `}
        >
          <button
            onClick={() => window.history.back()}
            className="bg-white text-black px-3 py-1 text-sm hover:bg-gray-300 mb-4"
          >
            Back
          </button>

          {loading ? (
            <p>Loading public files...</p>
          ) : userData.length === 0 ? (
            <p>No public files available right now.</p>
          ) : (
            userData.map((user) => (
              <div key={user.id}>
                <div className="text-yellow-400">{user.name}</div>
                {user.files.map((file) => (
                  <div
                    key={file.path}
                    className="pl-2 flex items-center cursor-pointer group"
                    onClick={() => handlePreview(file)}
                  >
                    <span className="text-gray-500 mr-2">| </span>
                    <span className="truncate group-hover:underline">
                      {file.name}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* --- PANEL 2: PREVIEW (RIGHT) --- */}
        {previewFile && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex flex-col items-start gap-3 mb-4 md:flex-row md:items-center md:justify-between">
              <span className="w-full truncate text-left md:w-auto md:order-2">
                {previewFile.name}
              </span>
              <div className="flex items-center justify-start gap-2 md:order-1">
                <button
                  onClick={() => {
                    setPreviewFile(null);
                    setPreviewContent("");
                    setPreviewUrl("");
                  }}
                  className="bg-white text-black px-3 py-1 text-sm hover:bg-gray-300 md:hidden"
                >
                  Back
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="bg-blue-500 text-white px-3 py-1 text-sm hover:bg-blue-600 disabled:opacity-50"
                >
                  {isDownloading ? "..." : "Save"}
                </button>
                <button
                  onClick={handleCopy}
                  disabled={isCopied || !!previewUrl}
                  className="bg-orange-500 text-white px-3 py-1 text-sm hover:bg-orange-600 disabled:opacity-50"
                >
                  {isCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* FIXED, RESPONSIVE PREVIEW AREA */}
            <div className="flex-1 border border-white text-sm bg-neutral-900 max-h-[75vh] md:max-h-full overflow-auto">
              {previewUrl.endsWith(".pdf") ? (
                <div className="w-full h-full flex justify-center items-start p-2 overflow-auto">
                  <iframe
                    src={previewUrl}
                    title={previewFile.name}
                    className="w-full rounded-none"
                    style={{
                      border: "none",
                      minHeight: "80vh",
                    }}
                  />
                </div>
              ) : previewUrl.endsWith(".png") ||
                previewUrl.endsWith(".jpeg") ||
                previewUrl.endsWith(".svg") ||
                previewUrl.endsWith(".jpg") ? (
                <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
                  <img
                    src={previewUrl}
                    alt={previewFile.name}
                    className="max-w-full max-h-[70vh] md:max-h-full object-contain bg-white rounded-none"
                  />
                </div>
              ) : (
                <div className="p-2 overflow-auto h-full">
                  <pre className="font-space !font-space whitespace-pre-wrap">
                    {renderHighlightedCode(previewContent, previewFile.name)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- PANEL 3: PLACEHOLDER (RIGHT) --- */}
        {!previewFile && (
          <div className="hidden md:flex flex-1 items-center justify-center p-4">
            <p className="text-gray-500">Select a file to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}