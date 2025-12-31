import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { supabase } from "../supabase";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Reusing your existing assets
import BackIcon from "../assets/backLeft.svg"; // Assuming you have the left pointing back icon
import DownloadIcon from "../assets/download.svg";
import DeleteIcon from "../assets/delete.svg";
import FolderIcon from "../assets/folder.svg";

export default function Bin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const navigate = useNavigate();

  // 1. Check Auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) navigate("/login");
      else setUser(u);
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. Fetch Bin Items
  useEffect(() => {
    if (user) fetchBinItems();
  }, [user]);

  // --- RECURSIVE ITEM RESOLVER ---
  const resolveBinItem = async (item, expandMultiple = false) => {
    if (!item.isFolder) return [item];

    const { data, error } = await supabase.storage
      .from("recycle")
      .list(item.fullPath);

    if (error) {
      console.error("Error peeking folder:", item.name, error);
      return [item];
    }

    const children = data.filter((c) => c.name !== ".placeholder");

    if (children.length === 0) return [item];

    if (children.length === 1) {
      const child = children[0];
      const newItem = {
        ...child,
        name: `${item.name}/${child.name}`,
        fullPath: `${item.fullPath}/${child.name}`,
        isFolder: !child.id,
      };
      return resolveBinItem(newItem, expandMultiple);
    }

    if (children.length > 1) {
      if (expandMultiple) {
        const promises = children.map((child) => {
          const newItem = {
            ...child,
            name: `${item.name}/${child.name}`,
            fullPath: `${item.fullPath}/${child.name}`,
            isFolder: !child.id,
          };
          return resolveBinItem(newItem, false);
        });

        const results = await Promise.all(promises);
        return results.flat();
      } else {
        return [item];
      }
    }
    
    return [item];
  };

  const fetchBinItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("recycle")
        .list(user.uid + "/");

      if (error) throw error;

      const rootItems = data
        .filter((item) => item.name !== ".placeholder")
        .map((item) => ({
          ...item,
          fullPath: `${user.uid}/${item.name}`,
          isFolder: !item.id,
        }));

      const promises = rootItems.map((item) => resolveBinItem(item, true));
      const resolvedArrays = await Promise.all(promises);
      
      setItems(resolvedArrays.flat());

    } catch (error) {
      console.error("Error fetching bin:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPER: Recursively list all files ---
  const listAllFiles = async (path) => {
    let files = [];
    const { data, error } = await supabase.storage.from("recycle").list(path);
    if (error) throw error;

    for (const item of data) {
      const itemPath = `${path}/${item.name}`;
      if (item.id === null) {
        const subFiles = await listAllFiles(itemPath);
        files = files.concat(subFiles);
      } else {
        files.push(itemPath);
      }
    }
    return files;
  };

  // 3. Permanent Delete
  const handlePermanentDelete = async (item) => {
    if (!window.confirm(`Permanently delete "${item.name}"?`)) return;

    setProcessing(true);
    setStatusMsg(`Deleting ${item.name}...`);

    try {
      let pathsToDelete = [];

      if (item.isFolder) {
        const nestedFiles = await listAllFiles(item.fullPath);
        pathsToDelete = [...nestedFiles, `${item.fullPath}/.placeholder`];
      } else {
        pathsToDelete = [item.fullPath];
      }

      const { error } = await supabase.storage.from("recycle").remove(pathsToDelete);
      if (error) throw error;

      setItems((prev) => prev.filter((i) => i.fullPath !== item.fullPath));
      setStatusMsg("");
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete item.");
    } finally {
      setProcessing(false);
    }
  };

  // 4. Download
  const handleDownload = async (item) => {
    setProcessing(true);
    setStatusMsg(`Preparing "${item.name}"...`);

    try {
      if (!item.isFolder) {
        const { data, error } = await supabase.storage.from("recycle").download(item.fullPath);
        if (error) throw error;
        const saveName = item.name.split('/').pop(); 
        saveAs(data, saveName);
      } else {
        const zip = new JSZip();
        const allPaths = await listAllFiles(item.fullPath);
        
        if (allPaths.length === 0) {
            alert("Folder is empty.");
            setProcessing(false);
            return;
        }

        setStatusMsg(`Zipping ${allPaths.length} files...`);

        const downloadPromises = allPaths.map(async (path) => {
            const relativePath = path.substring(item.fullPath.length + 1);
            const { data } = await supabase.storage.from("recycle").download(path);
            if (data) zip.file(relativePath, data);
        });

        await Promise.all(downloadPromises);

        const content = await zip.generateAsync({ type: "blob" });
        const zipName = item.name.split('/').pop();
        saveAs(content, `${zipName}.zip`);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download item.");
    } finally {
      setProcessing(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-press flex flex-col p-4 md:p-6 overflow-hidden">
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
                onClick={() => navigate(-1)} 
                className="px-6 py-2 rounded-full border border-white/20 hover:bg-white/10 transition group flex items-center justify-center"
            >
                <img src={BackIcon} className="w-4 h-4 filter invert group-hover:scale-110 transition" alt="Back" />
            </button>
        </div>
        
        {/* Center: Title */}
        <h1 className="hidden md:block text-2xl tracking-widest text-white">RECYCLE BIN</h1>
        
        {/* Mobile: Title */}
        <div className="md:hidden flex justify-center">
             <span className="text-xl tracking-widest">BIN</span>
        </div>
        
        {/* Right: Spacer */}
        <div className="justify-self-end"></div>
      </div>

      {/* --- MAIN CONTAINER --- */}
      <div className="flex flex-1 flex-col overflow-hidden gap-6">
        
        {/* File List Panel */}
        <div className="w-full flex-1 rounded-[20px] border border-white/20 p-4 overflow-y-auto bg-[#0a0a0a] relative">
          
          {loading ? (
            <div className="flex h-full items-center justify-center opacity-50">
               <p className="text-sm animate-pulse">Loading bin...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center opacity-30">
               <p className="text-sm">Bin is empty</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
               {items.map((item) => (
                 <div
                   key={item.fullPath}
                   className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-[#111] hover:bg-[#1a1a1a] hover:border-white/20 transition-all group"
                 >
                    {/* Icon & Name */}
                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                            {item.isFolder ? (
                                <img src={FolderIcon} alt="folder" className="w-5 h-5 filter invert opacity-70" />
                            ) : (
                                <div className="text-[10px] text-gray-500 font-bold  rounded px-1">XO</div>
                            )}
                        </div>
                        <span className="truncate text-xs md:text-sm text-gray-300 font-sans tracking-wide group-hover:text-white transition-colors font-press">
                            {item.name}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pl-2">
                        <button
                            onClick={() => handleDownload(item)}
                            disabled={processing}
                            className="p-2 rounded-full hover:bg-blue-500/20 border border-transparent hover:border-blue-500 transition disabled:opacity-30 group/btn"
                            title="Download / Restore"
                        >
                            <img src={DownloadIcon} alt="Restore" className="w-4 h-4 filter invert group-hover/btn:scale-110 transition" />
                        </button>
                        
                        <button
                            onClick={() => handlePermanentDelete(item)}
                            disabled={processing}
                            className="p-2 rounded-full hover:bg-red-500/20 border border-transparent hover:border-red-500 transition disabled:opacity-30 group/btn"
                            title="Delete Permanently"
                        >
                            <img src={DeleteIcon} alt="Delete" className="w-4 h-4 filter invert group-hover/btn:scale-110 transition" />
                        </button>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Processing Indicator */}
      {processing && (
        <div className="fixed bottom-8 left-8 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-2xl animate-fade-in bg-black/80 z-50">
           <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-xs font-bold tracking-wide text-white">{statusMsg || "Processing..."}</span>
           </div>
        </div>
      )}
    </div>
  );
}