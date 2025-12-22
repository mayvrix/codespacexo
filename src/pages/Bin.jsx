import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { supabase } from "../supabase";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Reusing your existing assets
import BackIcon from "../assets/back.svg";
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
  // expandMultiple: true for the top-level deleted item (e.g. "adcode"), 
  // false for sub-folders (e.g. "assignment1") so they stay grouped.
  const resolveBinItem = async (item, expandMultiple = false) => {
    // If it's a file, we are done
    if (!item.isFolder) return [item];

    // List contents
    const { data, error } = await supabase.storage
      .from("recycle")
      .list(item.fullPath);

    if (error) {
      console.error("Error peeking folder:", item.name, error);
      return [item];
    }

    // Filter placeholders
    const children = data.filter((c) => c.name !== ".placeholder");

    // Case A: Empty Folder -> Show it as is
    if (children.length === 0) return [item];

    // Case B: Single Child -> ALWAYS Drill down (merge path)
    // "adcode/assign5" (1 child) -> "adcode/assign5/q1"
    if (children.length === 1) {
      const child = children[0];
      const newItem = {
        ...child,
        name: `${item.name}/${child.name}`, // Visual path: "adcode/assign5/q1"
        fullPath: `${item.fullPath}/${child.name}`, // Storage path
        isFolder: !child.id,
      };
      // Recursively resolve the child, keeping the current expansion permission
      return resolveBinItem(newItem, expandMultiple);
    }

    // Case C: Multiple Children
    if (children.length > 1) {
      if (expandMultiple) {
        // If we are allowed to expand (e.g., at Root "adcode"), 
        // we return ALL children as separate items.
        const promises = children.map((child) => {
          const newItem = {
            ...child,
            name: `${item.name}/${child.name}`, // "adcode/assign1"
            fullPath: `${item.fullPath}/${child.name}`,
            isFolder: !child.id,
          };
          // IMPORTANT: Pass false here. We expanded the root, but we usually 
          // don't want to explode the sub-folders (like "assign1") into loose files.
          return resolveBinItem(newItem, false);
        });

        const results = await Promise.all(promises);
        return results.flat();
      } else {
        // If expansion is off (sub-folder level), keep it grouped
        // e.g., "adcode/assign1" stays as a Folder
        return [item];
      }
    }
    
    return [item];
  };

  const fetchBinItems = async () => {
    setLoading(true);
    try {
      // 1. Get Root Items (The actual deleted items)
      const { data, error } = await supabase.storage
        .from("recycle")
        .list(user.uid + "/");

      if (error) throw error;

      // 2. Prepare Root Objects
      const rootItems = data
        .filter((item) => item.name !== ".placeholder")
        .map((item) => ({
          ...item,
          fullPath: `${user.uid}/${item.name}`,
          isFolder: !item.id,
        }));

      // 3. Resolve Items (Parallel)
      // We pass `true` to allow expanding the root folders (like "adcode")
      const promises = rootItems.map((item) => resolveBinItem(item, true));
      const resolvedArrays = await Promise.all(promises);
      
      // Flatten the array of arrays
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
    <div className="min-h-screen bg-black text-white font-press flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-white">
        <h1 className="text-2xl">RECYCLE BIN</h1>
        <button
          onClick={() => navigate("/")}
          className="flex items-center bg-white text-black px-3 py-1 text-sm hover:bg-gray-200"
        >
          <img src={BackIcon} alt="back" className="w-6 h-6" />
          <span className="ml-2 hidden md:inline">Back</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <p>Loading bin...</p>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            Bin is empty
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.fullPath}
                className="flex justify-between items-center bg-gray-900 border border-white p-3 hover:bg-gray-800 transition"
              >
                {/* Name & Icon */}
                <div className="flex items-center truncate flex-1 mr-4">
                    {item.isFolder ? (
                         



                        <img src={FolderIcon} alt="folder" className="w-5 h-5 mr-3 filter invert opacity-50" />
                    ) : (
                         



                        <div className="w-5 h-5 mr-3 flex items-center justify-center text-gray-500 text-xs border border-gray-600 rounded-sm">
                            
                        </div>
                    )}
                    <span className="truncate text-gray-300" title={item.name}>
                        {item.name}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(item)}
                    disabled={processing}
                    className="p-2 hover:bg-blue-900 rounded border border-transparent hover:border-blue-500 transition disabled:opacity-30"
                    title="Download / Restore"
                  >
                    <img src={DownloadIcon} alt="Download" className="w-5 h-5 filter invert" />
                  </button>
                  
                  <button
                    onClick={() => handlePermanentDelete(item)}
                    disabled={processing}
                    className="p-2 hover:bg-red-900 rounded border border-transparent hover:border-red-500 transition disabled:opacity-30"
                    title="Delete Permanently"
                  >
                    <img src={DeleteIcon} alt="Delete" className="w-5 h-5 filter invert" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processing Indicator */}
      {processing && (
        <div className="fixed bottom-5 right-5 bg-blue-600 text-white px-4 py-2 rounded shadow-lg animate-pulse">
          {statusMsg || "Processing..."}
        </div>
      )}
    </div>
  );
}