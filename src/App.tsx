import { JSX, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, Database, Usb, Folder, File, ArrowLeft, RefreshCw, FileText, FileImage, FileVideo, FileAudio, FileCode, FileArchive, FileSpreadsheet, Presentation, FileJson } from "lucide-react";
import "./App.css";

interface DriveInfo {
  name: string;
  mount_point: string;
  total_space: number;
  available_space: number;
  used_space: number;
  usage_percent: number;
  file_system: string;
  is_removable: boolean;
}

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  
  const iconMap: Record<string, JSX.Element> = {
    // Images
    png: <FileImage className="w-5 h-5 text-green-400" />,
    jpg: <FileImage className="w-5 h-5 text-green-400" />,
    jpeg: <FileImage className="w-5 h-5 text-green-400" />,
    gif: <FileImage className="w-5 h-5 text-green-400" />,
    webp: <FileImage className="w-5 h-5 text-green-400" />,
    svg: <FileImage className="w-5 h-5 text-green-400" />,
    
    // Videos
    mp4: <FileVideo className="w-5 h-5 text-purple-400" />,
    mkv: <FileVideo className="w-5 h-5 text-purple-400" />,
    avi: <FileVideo className="w-5 h-5 text-purple-400" />,
    mov: <FileVideo className="w-5 h-5 text-purple-400" />,
    
    // Audio
    mp3: <FileAudio className="w-5 h-5 text-pink-400" />,
    wav: <FileAudio className="w-5 h-5 text-pink-400" />,
    flac: <FileAudio className="w-5 h-5 text-pink-400" />,
    
    // Documents
    pdf: <FileText className="w-5 h-5 text-red-400" />,
    doc: <FileText className="w-5 h-5 text-blue-400" />,
    docx: <FileText className="w-5 h-5 text-blue-400" />,
    txt: <FileText className="w-5 h-5 text-gray-300" />,
    
    // Spreadsheets
    xls: <FileSpreadsheet className="w-5 h-5 text-green-500" />,
    xlsx: <FileSpreadsheet className="w-5 h-5 text-green-500" />,
    csv: <FileSpreadsheet className="w-5 h-5 text-green-500" />,
    
    // Presentations
    ppt: <Presentation className="w-5 h-5 text-orange-400" />,
    pptx: <Presentation className="w-5 h-5 text-orange-400" />,
    
    // Code
    js: <FileCode className="w-5 h-5 text-yellow-400" />,
    ts: <FileCode className="w-5 h-5 text-blue-400" />,
    jsx: <FileCode className="w-5 h-5 text-cyan-400" />,
    tsx: <FileCode className="w-5 h-5 text-cyan-400" />,
    py: <FileCode className="w-5 h-5 text-yellow-300" />,
    rs: <FileCode className="w-5 h-5 text-orange-500" />,
    java: <FileCode className="w-5 h-5 text-red-400" />,
    html: <FileCode className="w-5 h-5 text-orange-400" />,
    css: <FileCode className="w-5 h-5 text-blue-400" />,
    
    // Data
    json: <FileJson className="w-5 h-5 text-yellow-400" />,
    xml: <FileCode className="w-5 h-5 text-orange-300" />,
    
    // Archives
    zip: <FileArchive className="w-5 h-5 text-yellow-500" />,
    rar: <FileArchive className="w-5 h-5 text-yellow-500" />,
    "7z": <FileArchive className="w-5 h-5 text-yellow-500" />,
    tar: <FileArchive className="w-5 h-5 text-yellow-500" />,
    gz: <FileArchive className="w-5 h-5 text-yellow-500" />,
  };
  
  return iconMap[ext] || <File className="w-5 h-5 text-gray-400" />;
}

function DriveCard({ drive, onClick }: { drive: DriveInfo; onClick: () => void }) {
  const getIcon = () => {
    if (drive.is_removable) return <Usb className="w-8 h-8" />;
    if (drive.mount_point === "/") return <Database className="w-8 h-8" />;
    return <HardDrive className="w-8 h-8" />;
  };

  const getBarColor = () => {
    if (drive.usage_percent > 90) return "bg-red-500";
    if (drive.usage_percent > 70) return "bg-yellow-500";
    return "bg-blue-500";
  };

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 cursor-pointer transition-all border border-gray-700 hover:border-blue-500"
    >
      <div className="flex items-center gap-4">
        <div className="text-blue-400">{getIcon()}</div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-white">
              {drive.name || "Local Disk"} ({drive.mount_point.replace("\\", "")})
            </span>
            <span className="text-sm text-gray-400">{drive.file_system}</span>
          </div>

          <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${getBarColor()} transition-all`}
              style={{ width: `${drive.usage_percent}%` }}
            />
          </div>

          <div className="flex justify-between text-sm text-gray-400">
            <span>{formatBytes(drive.available_space)} free</span>
            <span>{formatBytes(drive.total_space)} total</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileEntryRow({ entry, onClick }: { entry: FileEntry; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
        entry.is_dir
          ? "hover:bg-gray-700 cursor-pointer"
          : "hover:bg-gray-800 cursor-default"
      }`}
    >
      {entry.is_dir ? (
  <Folder className="w-5 h-5 text-yellow-400" />
) : (
  getFileIcon(entry.name)
)}
      <span className="flex-1 text-white truncate">{entry.name}</span>
      <span className="text-sm text-gray-500">
        {entry.is_dir ? "Folder" : formatBytes(entry.size)}
      </span>
    </div>
  );
}
function Breadcrumbs({ 
  path, 
  onNavigate 
}: { 
  path: string; 
  onNavigate: (path: string) => void;
}) {
  // Split path into parts: "C:\Users\Asus" → ["C:", "Users", "Asus"]
  const parts = path.replace(/\\+$/, "").split("\\").filter(Boolean);
  
  return (
    <div className="mt-2 flex items-center gap-1 text-sm">
      {parts.map((part, index) => {
        // Build path up to this point: C:\Users\Asus
        const pathToHere = parts.slice(0, index + 1).join("\\") + "\\";
        const isLast = index === parts.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-gray-600">›</span>}
            <button
              onClick={() => onNavigate(pathToHere)}
              className={`hover:text-blue-400 transition-colors px-1 py-0.5 rounded ${
                isLast ? "text-gray-200 font-medium" : "text-gray-400"
              }`}
            >
              {part}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDrives();
  }, []);

  async function loadDrives() {
    try {
      setLoading(true);
      const result = await invoke<DriveInfo[]>("get_drives");
      setDrives(result);
    } catch (err) {
      console.error("Failed to load drives:", err);
    } finally {
      setLoading(false);
    }
  }

  async function navigateTo(path: string) {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<FileEntry[]>("list_directory", { path });
      
      // Sort: folders first, then files, both alphabetically
      result.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setEntries(result);
      setCurrentPath(path);
    } catch (err) {
      setError(err as string);
      console.error("Failed to list directory:", err);
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (!currentPath) return;
    
    // Get parent directory
    const parts = currentPath.replace(/\\+$/, "").split("\\");
    
    if (parts.length <= 1) {
      // We're at drive root, go back to drive list
      setCurrentPath(null);
      setEntries([]);
    } else {
      // Go to parent folder
      parts.pop();
      const parentPath = parts.join("\\") + "\\";
      navigateTo(parentPath);
    }
  }

  function handleEntryClick(entry: FileEntry) {
    if (entry.is_dir) {
      navigateTo(entry.path);
    }
    // For files, we'll add actions later (Day 5+)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center gap-4">
          {currentPath && (
            <button
              onClick={goBack}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
          )}
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-blue-400" />
            FileForge
          </h1>
          <button
            onClick={() => currentPath ? navigateTo(currentPath) : loadDrives()}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all ml-auto"
          >
            <RefreshCw className="w-5 h-5 text-gray-300" />
          </button>
        </div>
        
        {/* Breadcrumb / Path */}
        {currentPath && (
          <Breadcrumbs path={currentPath} onNavigate={navigateTo} />
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-red-400">Error: {error}</div>
        ) : currentPath === null ? (
          // Drive list view
          <>
            <h2 className="text-lg font-semibold text-gray-300 mb-4">
              Drives & Storage
            </h2>
            <div className="grid gap-4">
              {drives.map((drive, index) => (
                <DriveCard
                  key={index}
                  drive={drive}
                  onClick={() => navigateTo(drive.mount_point)}
                />
              ))}
            </div>
          </>
        ) : (
          // Directory listing view
          <>
            {entries.length === 0 ? (
              <div className="text-gray-400">This folder is empty</div>
            ) : (
              <div className="grid gap-1">
                {entries.map((entry, index) => (
                  <FileEntryRow
                    key={index}
                    entry={entry}
                    onClick={() => handleEntryClick(entry)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Status bar */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm text-gray-400">
        {currentPath === null
          ? `${drives.length} drive(s) detected`
          : `${entries.length} item(s)`}
      </footer>
    </div>
  );
}

export default App;