import { JSX, useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  HardDrive, Database, Usb, Folder, File, ArrowLeft, RefreshCw,
  FileText, FileImage, FileVideo, FileAudio, FileCode, FileArchive,
  FileSpreadsheet, Presentation, FileJson, Download, X, FolderOpen,
  AlertCircle, Check, Trash2, Settings, History, Info
} from "lucide-react";
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

interface NewFileEvent {
  name: string;
  path: string;
  size: number;
}

interface DownloadHistoryEntry {
  name: string;
  original_path: string;
  size: number;
  timestamp: string;
  action: string;
  destination: string | null;
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
    png: <FileImage className="w-5 h-5 text-green-400" />,
    jpg: <FileImage className="w-5 h-5 text-green-400" />,
    jpeg: <FileImage className="w-5 h-5 text-green-400" />,
    gif: <FileImage className="w-5 h-5 text-green-400" />,
    webp: <FileImage className="w-5 h-5 text-green-400" />,
    svg: <FileImage className="w-5 h-5 text-green-400" />,
    mp4: <FileVideo className="w-5 h-5 text-purple-400" />,
    mkv: <FileVideo className="w-5 h-5 text-purple-400" />,
    avi: <FileVideo className="w-5 h-5 text-purple-400" />,
    mov: <FileVideo className="w-5 h-5 text-purple-400" />,
    mp3: <FileAudio className="w-5 h-5 text-pink-400" />,
    wav: <FileAudio className="w-5 h-5 text-pink-400" />,
    flac: <FileAudio className="w-5 h-5 text-pink-400" />,
    pdf: <FileText className="w-5 h-5 text-red-400" />,
    doc: <FileText className="w-5 h-5 text-blue-400" />,
    docx: <FileText className="w-5 h-5 text-blue-400" />,
    txt: <FileText className="w-5 h-5 text-gray-300" />,
    xls: <FileSpreadsheet className="w-5 h-5 text-green-500" />,
    xlsx: <FileSpreadsheet className="w-5 h-5 text-green-500" />,
    csv: <FileSpreadsheet className="w-5 h-5 text-green-500" />,
    ppt: <Presentation className="w-5 h-5 text-orange-400" />,
    pptx: <Presentation className="w-5 h-5 text-orange-400" />,
    js: <FileCode className="w-5 h-5 text-yellow-400" />,
    ts: <FileCode className="w-5 h-5 text-blue-400" />,
    jsx: <FileCode className="w-5 h-5 text-cyan-400" />,
    tsx: <FileCode className="w-5 h-5 text-cyan-400" />,
    py: <FileCode className="w-5 h-5 text-yellow-300" />,
    rs: <FileCode className="w-5 h-5 text-orange-500" />,
    java: <FileCode className="w-5 h-5 text-red-400" />,
    html: <FileCode className="w-5 h-5 text-orange-400" />,
    css: <FileCode className="w-5 h-5 text-blue-400" />,
    json: <FileJson className="w-5 h-5 text-yellow-400" />,
    xml: <FileCode className="w-5 h-5 text-orange-300" />,
    zip: <FileArchive className="w-5 h-5 text-yellow-500" />,
    rar: <FileArchive className="w-5 h-5 text-yellow-500" />,
    "7z": <FileArchive className="w-5 h-5 text-yellow-500" />,
    tar: <FileArchive className="w-5 h-5 text-yellow-500" />,
    gz: <FileArchive className="w-5 h-5 text-yellow-500" />,
    exe: <File className="w-5 h-5 text-blue-300" />,
    msi: <File className="w-5 h-5 text-blue-300" />,
  };

  return iconMap[ext] || <File className="w-5 h-5 text-gray-400" />;
}

function Breadcrumbs({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (path: string) => void;
}) {
  const parts = path.replace(/\\+$/, "").split("\\").filter(Boolean);

  return (
    <div className="mt-2 flex items-center gap-1 text-sm">
      {parts.map((part, index) => {
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

function DriveCard({ drive, onClick }: { drive: DriveInfo; onClick: () => void }) {
  const getIcon = () => {
    if (drive.is_removable) return <Usb className="w-8 h-8" />;
    if (drive.mount_point === "C:\\") return <Database className="w-8 h-8" />;
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

function FileEntryRow({
  entry,
  onClick,
}: {
  entry: FileEntry;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
        entry.is_dir
          ? "hover:bg-gray-700 cursor-pointer"
          : "hover:bg-gray-800 cursor-pointer"
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

// Move File Modal Component
function MoveFileModal({
  file,
  onClose,
  onMove,
  onDelete,
}: {
  file: FileEntry | NewFileEvent;
  onClose: () => void;
  onMove: (destination: string) => void;
  onDelete?: () => void;
}) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentDestinations, setRecentDestinations] = useState<string[]>([]);

  useEffect(() => {
    loadDrives();
    loadRecentDestinations();
  }, []);

  async function loadDrives() {
    const result = await invoke<DriveInfo[]>("get_drives");
    setDrives(result);
  }

  async function loadRecentDestinations() {
    try {
      const recent = await invoke<string[]>("get_recent_destinations");
      setRecentDestinations(recent);
    } catch (err) {
      console.error("Failed to load recent destinations:", err);
    }
  }

  async function navigateTo(path: string) {
    setLoading(true);
    try {
      const result = await invoke<FileEntry[]>("list_directory", { path });
      const folders = result
        .filter((e) => e.is_dir)
        .sort((a, b) => a.name.localeCompare(b.name));
      setEntries(folders);
      setCurrentPath(path);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function createFolder() {
    if (!newFolderName || !currentPath) return;
    const pathSep = currentPath.endsWith("\\") ? "" : "\\";
    const folderPath = `${currentPath}${pathSep}${newFolderName}`;
    try {
      await invoke("create_folder", { path: folderPath });
      setNewFolderName("");
      setShowNewFolder(false);
      navigateTo(currentPath);
    } catch (err) {
      console.error(err);
    }
  }

  function getDisplayPath(path: string) {
    // Show last 2 parts of path for readability
    const parts = path.replace(/\\+$/, "").split("\\");
    if (parts.length <= 2) return path;
    return "...\\" + parts.slice(-2).join("\\");
  }

  const destinationPath = currentPath || "";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-[500px] max-h-[600px] flex flex-col border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Move File</h2>
              <p className="text-sm text-gray-400 truncate max-w-[350px]">
                {file.name} ({formatBytes(file.size)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Recent Destinations */}
        {recentDestinations.length > 0 && currentPath === null && (
          <div className="p-4 border-b border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Recent:</p>
            <div className="grid gap-1">
              {recentDestinations.map((dest, i) => (
                <button
                  key={i}
                  onClick={() => onMove(dest)}
                  className="flex items-center gap-2 p-2 bg-gray-700 hover:bg-blue-600 rounded-lg text-left transition-all group"
                >
                  <Folder className="w-4 h-4 text-yellow-400" />
                  <span className="text-white text-sm truncate flex-1">
                    {getDisplayPath(dest)}
                  </span>
                  <span className="text-xs text-gray-400 group-hover:text-white">
                    Quick move
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="p-4 border-b border-gray-700">
          <p className="text-sm text-gray-400 mb-2">
            {recentDestinations.length > 0 && currentPath === null ? "Or browse:" : "Select destination:"}
          </p>
          {currentPath && (
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => {
                  setCurrentPath(null);
                  setEntries([]);
                }}
                className="text-sm text-blue-400 hover:underline"
              >
                ← Back to drives
              </button>
            </div>
          )}
          <div className="bg-gray-900 rounded-lg p-2 text-sm font-mono text-gray-300">
            {currentPath || "Select a drive..."}
          </div>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-auto p-4">
          {currentPath === null ? (
            <div className="grid gap-2">
              {drives.map((drive, i) => (
                <button
                  key={i}
                  onClick={() => navigateTo(drive.mount_point)}
                  className="flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-all"
                >
                  <HardDrive className="w-5 h-5 text-blue-400" />
                  <span className="text-white">
                    {drive.name || "Local Disk"} ({drive.mount_point.replace("\\", "")})
                  </span>
                </button>
              ))}
            </div>
          ) : loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="grid gap-1">
              {entries.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => navigateTo(entry.path)}
                  className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded-lg text-left transition-all"
                >
                  <Folder className="w-5 h-5 text-yellow-400" />
                  <span className="text-white truncate">{entry.name}</span>
                </button>
              ))}
              {entries.length === 0 && (
                <div className="text-gray-500 text-sm">No subfolders</div>
              )}
            </div>
          )}
        </div>

        {/* New folder */}
        {currentPath && (
          <div className="p-4 border-t border-gray-700">
            {showNewFolder ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createFolder()}
                />
                <button
                  onClick={createFolder}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewFolder(false)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
              >
                <FolderOpen className="w-4 h-4" />
                Create new folder
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-gray-700 flex justify-between">
          <button
            onClick={() => onDelete?.()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-all"
            >
              Keep in Downloads
            </button>
            <button
              onClick={() => onMove(destinationPath)}
              disabled={!currentPath}
              className={`px-4 py-2 rounded-lg text-white transition-all flex items-center gap-2 ${
                currentPath
                  ? "bg-blue-600 hover:bg-blue-500"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
            >
              <Check className="w-4 h-4" />
              Move Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkMoveModal({
  files,
  onClose,
  onMove,
}: {
  files: FileEntry[];
  onClose: () => void;
  onMove: (destination: string) => void;
}) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentDestinations, setRecentDestinations] = useState<string[]>([]);

  useEffect(() => {
    loadDrives();
    loadRecentDestinations();
  }, []);

  async function loadDrives() {
    const result = await invoke<DriveInfo[]>("get_drives");
    setDrives(result);
  }

  async function loadRecentDestinations() {
    try {
      const recent = await invoke<string[]>("get_recent_destinations");
      setRecentDestinations(recent);
    } catch (err) {
      console.error("Failed to load recent destinations:", err);
    }
  }

  async function navigateTo(path: string) {
    setLoading(true);
    try {
      const result = await invoke<FileEntry[]>("list_directory", { path });
      const folders = result
        .filter((e) => e.is_dir)
        .sort((a, b) => a.name.localeCompare(b.name));
      setEntries(folders);
      setCurrentPath(path);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function createFolder() {
    if (!newFolderName || !currentPath) return;
    const pathSep = currentPath.endsWith("\\") ? "" : "\\";
    const folderPath = `${currentPath}${pathSep}${newFolderName}`;
    try {
      await invoke("create_folder", { path: folderPath });
      setNewFolderName("");
      setShowNewFolder(false);
      navigateTo(currentPath);
    } catch (err) {
      console.error(err);
    }
  }

  function getDisplayPath(path: string) {
    const parts = path.replace(/\\+$/, "").split("\\");
    if (parts.length <= 2) return path;
    return "...\\" + parts.slice(-2).join("\\");
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-[500px] max-h-[600px] flex flex-col border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-6 h-6 text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Move {files.length} Files</h2>
                <p className="text-sm text-gray-400">
                  Total size: {formatBytes(totalSize)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* File preview */}
          <div className="mt-3 max-h-20 overflow-auto text-sm text-gray-400">
            {files.slice(0, 5).map((f, i) => (
              <div key={i} className="truncate">{f.name}</div>
            ))}
            {files.length > 5 && (
              <div className="text-gray-500">...and {files.length - 5} more</div>
            )}
          </div>
        </div>

        {/* Recent Destinations */}
        {recentDestinations.length > 0 && currentPath === null && (
          <div className="p-4 border-b border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Recent:</p>
            <div className="grid gap-1">
              {recentDestinations.map((dest, i) => (
                <button
                  key={i}
                  onClick={() => onMove(dest)}
                  className="flex items-center gap-2 p-2 bg-gray-700 hover:bg-blue-600 rounded-lg text-left transition-all group"
                >
                  <Folder className="w-4 h-4 text-yellow-400" />
                  <span className="text-white text-sm truncate flex-1">
                    {getDisplayPath(dest)}
                  </span>
                  <span className="text-xs text-gray-400 group-hover:text-white">
                    Quick move
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="p-4 border-b border-gray-700">
          <p className="text-sm text-gray-400 mb-2">
            {recentDestinations.length > 0 && currentPath === null ? "Or browse:" : "Select destination:"}
          </p>
          {currentPath && (
            <button
              onClick={() => {
                setCurrentPath(null);
                setEntries([]);
              }}
              className="text-sm text-blue-400 hover:underline mb-2"
            >
              ← Back to drives
            </button>
          )}
          <div className="bg-gray-900 rounded-lg p-2 text-sm font-mono text-gray-300">
            {currentPath || "Select a drive..."}
          </div>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-auto p-4">
          {currentPath === null ? (
            <div className="grid gap-2">
              {drives.map((drive, i) => (
                <button
                  key={i}
                  onClick={() => navigateTo(drive.mount_point)}
                  className="flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-all"
                >
                  <HardDrive className="w-5 h-5 text-blue-400" />
                  <span className="text-white">
                    {drive.name || "Local Disk"} ({drive.mount_point.replace("\\", "")})
                  </span>
                </button>
              ))}
            </div>
          ) : loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="grid gap-1">
              {entries.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => navigateTo(entry.path)}
                  className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded-lg text-left transition-all"
                >
                  <Folder className="w-5 h-5 text-yellow-400" />
                  <span className="text-white truncate">{entry.name}</span>
                </button>
              ))}
              {entries.length === 0 && (
                <div className="text-gray-500 text-sm">No subfolders</div>
              )}
            </div>
          )}
        </div>

        {/* New folder */}
        {currentPath && (
          <div className="p-4 border-t border-gray-700">
            {showNewFolder ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createFolder()}
                />
                <button
                  onClick={createFolder}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewFolder(false)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
              >
                <FolderOpen className="w-4 h-4" />
                Create new folder
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => currentPath && onMove(currentPath)}
            disabled={!currentPath}
            className={`px-4 py-2 rounded-lg text-white transition-all flex items-center gap-2 ${
              currentPath
                ? "bg-blue-600 hover:bg-blue-500"
                : "bg-gray-600 cursor-not-allowed"
            }`}
          >
            <Check className="w-4 h-4" />
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const fileListRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryEntry[]>([]);
  const [showHelp, setShowHelp] = useState(false);

// Load autostart setting on mount
useEffect(() => {
  loadAutoStartSetting();
}, []);

async function loadAutoStartSetting() {
  try {
    const enabled = await invoke<boolean>("get_autostart_enabled");
    setAutoStartEnabled(enabled);
  } catch (err) {
    console.error("Failed to get autostart setting:", err);
  }
}

async function toggleAutoStart() {
  try {
    const newValue = !autoStartEnabled;
    await invoke("set_autostart_enabled", { enabled: newValue });
    setAutoStartEnabled(newValue);
  } catch (err) {
    console.error("Failed to set autostart:", err);
    alert("Failed to update auto-start setting: " + err);
  }
}
async function loadDownloadHistory() {
  try {
    const history = await invoke<DownloadHistoryEntry[]>("get_download_history");
    setDownloadHistory(history);
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}

async function clearDownloadHistory() {
  const confirmed = window.confirm("Clear all download history?");
  if (!confirmed) return;
  
  try {
    await invoke("clear_history");
    setDownloadHistory([]);
  } catch (err) {
    console.error("Failed to clear history:", err);
  }
}
  
  // Downloads manager state
  const [downloadsPath, setDownloadsPath] = useState<string>("");
  const [downloadFiles, setDownloadFiles] = useState<FileEntry[]>([]);
  const [showDownloads, setShowDownloads] = useState(false);
  
  // Single file selection (for double-click / single move modal)
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  
  // Multi-select state
  const [selectedFiles, setSelectedFiles] = useState<FileEntry[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  
  // New download popup
  const [newDownload, setNewDownload] = useState<NewFileEvent | null>(null);

  useEffect(() => {
    loadDrives();
    loadDownloadsPath();
    
    // Listen for new downloads
    const unlisten = listen<NewFileEvent>("new-download", (event) => {
      console.log("New download detected:", event.payload);
      setNewDownload(event.payload);
      loadDownloadFiles();
    });
    
    return () => {
      unlisten.then((fn) => fn());
    };
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

  async function loadDownloadsPath() {
    const path = await invoke<string>("get_downloads_path");
    setDownloadsPath(path);
    loadDownloadFiles(path);
  }

  async function loadDownloadFiles(path?: string) {
    const downloadPath = path || downloadsPath;
    if (!downloadPath) return;
    
    try {
      const result = await invoke<FileEntry[]>("list_directory", { path: downloadPath });
      const files = result
        .filter((e) => !e.is_dir)
        .sort((a, b) => a.name.localeCompare(b.name));
      setDownloadFiles(files);
    } catch (err) {
      console.error("Failed to load downloads:", err);
    }
  }

  async function navigateTo(path: string) {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<FileEntry[]>("list_directory", { path });
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
    const parts = currentPath.replace(/\\+$/, "").split("\\");
    if (parts.length <= 1) {
      setCurrentPath(null);
      setEntries([]);
    } else {
      parts.pop();
      const parentPath = parts.join("\\") + "\\";
      navigateTo(parentPath);
    }
  }

  function handleEntryClick(entry: FileEntry) {
    if (entry.is_dir) {
      navigateTo(entry.path);
    }
  }

  // Single file move (from double-click modal)
  async function handleMoveFile(destination: string) {
    if (!selectedFile) return;
    
    const fileName = selectedFile.name;
    const sourcePath = selectedFile.path;
    const destFolder = destination.endsWith("\\") ? destination : destination + "\\";
    const destPath = `${destFolder}${fileName}`;
    
    console.log("Moving:", sourcePath, "→", destPath);
    
    try {
      await invoke("move_file", { source: sourcePath, destination: destPath });
      await invoke("add_recent_destination", { path: destFolder });
      await invoke("add_to_history", {
      name: fileName,
      originalPath: sourcePath,
      size: selectedFile.size,
      action: "moved",
      destination: destFolder,
    });
      setSelectedFile(null);
      loadDownloadFiles();
    } catch (err) {
      console.error("Failed to move file:", err);
      alert("Failed to move file: " + err);
    }
  }

  // New download move
  async function handleMoveNewDownload(destination: string) {
    if (!newDownload) return;
    
    const destFolder = destination.endsWith("\\") ? destination : destination + "\\";
    const destPath = `${destFolder}${newDownload.name}`;
    
    console.log("Moving new download:", newDownload.path, "→", destPath);
    
    try {
      await invoke("move_file", { source: newDownload.path, destination: destPath });
      await invoke("add_recent_destination", { path: destFolder });
      await invoke("add_to_history", {
      name: newDownload.name,
      originalPath: newDownload.path,
      size: newDownload.size,
      action: "moved",
      destination: destFolder,
    });
      setNewDownload(null);
      loadDownloadFiles();
    } catch (err) {
      console.error("Failed to move file:", err);
      alert("Failed to move file: " + err);
    }
  }

  // Delete single file
  async function handleDeleteFile(file: FileEntry | NewFileEvent) {
    const confirmed = window.confirm(`Send "${file.name}" to Recycle Bin?`);
    if (!confirmed) return;
    
    try {
      await invoke("delete_file", { path: file.path });
      await invoke("add_to_history", {
      name: file.name,
      originalPath: file.path,
      size: file.size,
      action: "deleted",
      destination: null,
    });
      setSelectedFile(null);
      setNewDownload(null);
      loadDownloadFiles();
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert("Failed to delete file: " + err);
    }
  }

  // Multi-select click handler
  function handleFileClick(file: FileEntry, index: number, event: React.MouseEvent) {
    // Ctrl/Cmd + Click: Toggle individual selection
    if (event.ctrlKey || event.metaKey) {
      setSelectedFiles((prev) => {
        const exists = prev.find((f) => f.path === file.path);
        if (exists) {
          return prev.filter((f) => f.path !== file.path);
        } else {
          return [...prev, file];
        }
      });
      setLastSelectedIndex(index);
    }
    // Shift + Click: Range selection
    else if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const range = downloadFiles.slice(start, end + 1);
      setSelectedFiles(range);
    }
    // Regular click: Single selection
    else {
      setSelectedFiles([file]);
      setLastSelectedIndex(index);
    }
  }

  // Keyboard handler
  // Keyboard handler
function handleKeyDown(event: React.KeyboardEvent) {
  if (downloadFiles.length === 0) return;
  
  // Ctrl/Cmd + A: Select all
  if ((event.ctrlKey || event.metaKey) && event.key === "a") {
    event.preventDefault();
    setSelectedFiles([...downloadFiles]);
    return;
  }
  
  // Get current focus position (last item in selection or lastSelectedIndex)
  const currentFocus = selectedFiles.length > 0
    ? downloadFiles.findIndex(f => f.path === selectedFiles[selectedFiles.length - 1].path)
    : lastSelectedIndex ?? -1;
  
  // Arrow Down
  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = Math.min(currentFocus + 1, downloadFiles.length - 1);
    
    if (event.shiftKey) {
      // Extend selection from anchor
      const anchor = lastSelectedIndex ?? 0;
      const start = Math.min(anchor, nextIndex);
      const end = Math.max(anchor, nextIndex);
      setSelectedFiles(downloadFiles.slice(start, end + 1));
    } else {
      // Move to next, reset anchor
      setSelectedFiles([downloadFiles[nextIndex]]);
      setLastSelectedIndex(nextIndex);
    }
    // Auto-scroll to selected item
    const element = fileListRef.current?.children[nextIndex] as HTMLElement;
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  
  // Arrow Up
  if (event.key === "ArrowUp") {
    event.preventDefault();
    const prevIndex = Math.max(currentFocus - 1, 0);
    
    if (event.shiftKey) {
      // Extend selection from anchor
      const anchor = lastSelectedIndex ?? 0;
      const start = Math.min(anchor, prevIndex);
      const end = Math.max(anchor, prevIndex);
      setSelectedFiles(downloadFiles.slice(start, end + 1));
    } else {
      // Move to prev, reset anchor
      setSelectedFiles([downloadFiles[prevIndex]]);
      setLastSelectedIndex(prevIndex);
    }
    // Auto-scroll to selected item
    const element = fileListRef.current?.children[prevIndex] as HTMLElement;
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  
  // Delete key
  if (event.key === "Delete" && selectedFiles.length > 0) {
    event.preventDefault();
    handleBulkDelete();
  }
  
  // Enter key: Open move modal
  if (event.key === "Enter" && selectedFiles.length > 0) {
    event.preventDefault();
    if (selectedFiles.length === 1) {
      setSelectedFile(selectedFiles[0]);
    } else {
      setShowBulkMoveModal(true);
    }
  }
  
  // Escape: Clear selection
  if (event.key === "Escape") {
    setSelectedFiles([]);
    setLastSelectedIndex(null);
  }
}
  // Bulk delete
  async function handleBulkDelete() {
    if (selectedFiles.length === 0) return;
    
    const confirmed = window.confirm(
      `Send ${selectedFiles.length} file(s) to Recycle Bin?`
    );
    if (!confirmed) return;
    
    let successCount = 0;
    for (const file of selectedFiles) {
      try {
        await invoke("delete_file", { path: file.path });
        await invoke("add_to_history", {
        name: file.name,
        originalPath: file.path,
        size: file.size,
        action: "deleted",
        destination: null,
      });
        successCount++;
      } catch (err) {
        console.error(`Failed to delete ${file.name}:`, err);
      }
    }
    
    setSelectedFiles([]);
    setLastSelectedIndex(null);
    loadDownloadFiles();
  }

  // Bulk move
  async function handleBulkMove(destination: string) {
    if (selectedFiles.length === 0) return;
    
    const destFolder = destination.endsWith("\\") ? destination : destination + "\\";
    let successCount = 0;
    
    for (const file of selectedFiles) {
      const destPath = `${destFolder}${file.name}`;
      try {
        await invoke("move_file", { source: file.path, destination: destPath });
        await invoke("add_to_history", {
        name: file.name,
        originalPath: file.path,
        size: file.size,
        action: "moved",
        destination: destFolder,
      });
        successCount++;
      } catch (err) {
        console.error(`Failed to move ${file.name}:`, err);
      }
    }
    // Save to recent only if at least one succeeded
  if (successCount > 0) {
    await invoke("add_recent_destination", { path: destFolder });
  }
    console.log(`Moved ${successCount}/${selectedFiles.length} files`);
    setSelectedFiles([]);
    setLastSelectedIndex(null);
    setShowBulkMoveModal(false);
    loadDownloadFiles();
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center gap-4">
          {currentPath && !showDownloads && (
            <button
              onClick={goBack}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
          )}
          {showDownloads && (
            <button
              onClick={() => {
                setShowDownloads(false);
                setSelectedFiles([]);
                setLastSelectedIndex(null);
              }}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
          )}
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-blue-400" />
            FileForge
          </h1>
          
          {/* Downloads button */}
          <button
            onClick={() => {
              setShowDownloads(true);
              loadDownloadFiles();
            }}
            className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              showDownloads
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >      
            <Download className="w-5 h-5" />
            Downloads
            {downloadFiles.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {downloadFiles.length}
              </span>
            )}
          </button>
          <button
  onClick={() => setShowSettings(true)}
  className="p-2 hover:bg-gray-700 rounded-lg transition-all"
>
   <Settings className="w-5 h-5 text-gray-300" />
</button>
{/* History button */}
<button
  onClick={() => {
    setShowHistory(true);
    loadDownloadHistory();
  }}
  className="p-2 hover:bg-gray-700 rounded-lg transition-all"
  title="Download History"
>
  <History className="w-5 h-5 text-gray-300" />
</button>
          <button
            onClick={() => {
              if (showDownloads) {
                loadDownloadFiles();
              } else if (currentPath) {
                navigateTo(currentPath);
              } else {
                loadDrives();
              }
            }}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
          >
            
            <RefreshCw className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        {currentPath && !showDownloads && (
          <Breadcrumbs path={currentPath} onNavigate={navigateTo} />
        )}
        
        {showDownloads && (
          <div className="mt-2 text-sm text-gray-400">
            {downloadsPath} • {downloadFiles.length} files to organize
          </div>
        )}
        
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-red-400">Error: {error}</div>
        ) : showDownloads ? (
          // Downloads view
          <div
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="outline-none h-full"
          >
            <div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold text-gray-300">
    Files in Downloads
  </h2>
  <button
    onClick={() => setShowHelp(true)}
    className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-all"
    title="Keyboard shortcuts & help"
  >
    <span>Shortcuts</span>
    <Info className="w-4 h-4" />
  </button>
</div>
            
            {/* Bulk action bar - sticky at bottom */}
{selectedFiles.length > 1 && (
  <div className="fixed bottom-16 left-6 right-6 p-3 bg-blue-900/95 backdrop-blur border border-blue-700 rounded-lg flex items-center justify-between shadow-lg z-40">
    <span className="text-blue-200">
      {selectedFiles.length} file(s) selected
    </span>
    <div className="flex gap-2">
      <button
        onClick={() => setShowBulkMoveModal(true)}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm flex items-center gap-2"
      >
        <FolderOpen className="w-4 h-4" />
        Move
      </button>
      <button
        onClick={handleBulkDelete}
        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
      <button
        onClick={() => {
          setSelectedFiles([]);
          setLastSelectedIndex(null);
        }}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
      >
        Cancel
      </button>
    </div>
  </div>
)}
            
            {downloadFiles.length === 0 ? (
              <div className="text-gray-400">Downloads folder is clean! 🎉</div>
            ) : (
              <div className="grid gap-1" ref={fileListRef}>
                {downloadFiles.map((file, index) => {
                  const isSelected = selectedFiles.some((f) => f.path === file.path);
                  return (
                    <div
                      key={index}
                      onClick={(e) => handleFileClick(file, index, e)}
                      onDoubleClick={() => setSelectedFile(file)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all select-none ${
                        isSelected
                          ? "bg-blue-600/40 border border-blue-500"
                          : "hover:bg-gray-800 border border-transparent"
                      }`}
                    >
                      {getFileIcon(file.name)}
                      <span className="flex-1 text-white truncate">{file.name}</span>
                      <span className="text-sm text-gray-500">{formatBytes(file.size)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
        {showDownloads
          ? `${downloadFiles.length} file(s) in Downloads`
          : currentPath === null
          ? `${drives.length} drive(s) detected`
          : `${entries.length} item(s)`}
      </footer>

      {/* Single file move modal (double-click) */}
      {selectedFile && (
        <MoveFileModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onMove={handleMoveFile}
          onDelete={() => handleDeleteFile(selectedFile)}
        />
      )}

      {/* New download notification modal */}
      {newDownload && (
        <MoveFileModal
          file={newDownload}
          onClose={() => setNewDownload(null)}
          onMove={handleMoveNewDownload}
          onDelete={() => handleDeleteFile(newDownload)}
        />
      )}
      {/* History modal */}
{showHistory && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-gray-800 rounded-xl w-[600px] max-h-[500px] flex flex-col border border-gray-700 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" />
          Download History
        </h2>
        <div className="flex items-center gap-2">
          {downloadHistory.length > 0 && (
            <button
              onClick={clearDownloadHistory}
              className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30 rounded-lg transition-all"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setShowHistory(false)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-auto p-4">
        {downloadHistory.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No download history yet
          </div>
        ) : (
          <div className="grid gap-2">
            {downloadHistory.map((entry, i) => (
              <div
                key={i}
                className="p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(entry.name)}
                  <div className="flex-1 min-w-0">
                    <div className="text-white truncate">{entry.name}</div>
                    <div className="text-xs text-gray-500">
                      {entry.timestamp} • {formatBytes(entry.size)}
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    entry.action === "moved" 
                      ? "bg-blue-900/50 text-blue-300" 
                      : entry.action === "deleted"
                      ? "bg-red-900/50 text-red-300"
                      : "bg-gray-700 text-gray-300"
                  }`}>
                    {entry.action === "moved" ? "Moved" : entry.action === "deleted" ? "Deleted" : "Kept"}
                  </div>
                </div>
                {entry.destination && (
                  <div className="mt-2 text-xs text-gray-400 truncate">
                    → {entry.destination}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}

      {/* Settings modal */}
{showSettings && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-gray-800 rounded-xl w-[400px] border border-gray-700 shadow-2xl">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Settings
        </h2>
        <button
          onClick={() => setShowSettings(false)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-all"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
          <div>
            <div className="text-white font-medium">Start at Login</div>
            <div className="text-sm text-gray-400">
              Launch FileForge minimized when Windows starts
            </div>
          </div>
          <button
            onClick={toggleAutoStart}
            className={`w-12 h-6 rounded-full transition-all ${
              autoStartEnabled ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-all transform ${
                autoStartEnabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          When enabled, FileForge runs in the background and watches your Downloads folder for new files.
        </div>
      </div>
    </div>
  </div>
)}
{/* Help modal */}
{showHelp && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-gray-800 rounded-xl w-[500px] max-h-[600px] flex flex-col border border-gray-700 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-400" />
          Keyboard Shortcuts & Actions
        </h2>
        <button
          onClick={() => setShowHelp(false)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-all"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <p className="text-gray-400 text-sm mb-4">
          Use these shortcuts in the Downloads view to quickly manage your files.
        </p>

        <div className="space-y-4">
          {/* Selection */}
          <div>
            <h3 className="text-blue-400 font-medium mb-2">Selection</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Select file</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Click</kbd>
              </div>
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Toggle selection</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Ctrl + Click</kbd>
              </div>
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Select range</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Shift + Click</kbd>
              </div>
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Select all</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Ctrl + A</kbd>
              </div>
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Clear selection</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Esc</kbd>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-blue-400 font-medium mb-2">Navigation</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Move up/down</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">↑ / ↓</kbd>
              </div>
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Extend selection</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Shift + ↑/↓</kbd>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-blue-400 font-medium mb-2">Actions</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Open move dialog</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Enter</kbd>
              </div>
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Open single file dialog</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Double-click</kbd>
              </div>
              <div className="flex justify-between p-2 bg-gray-900 rounded">
                <span className="text-gray-300">Delete selected</span>
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-gray-400">Delete</kbd>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-blue-400 font-medium mb-2">Tips</h3>
            <div className="grid gap-2 text-sm text-gray-400">
              <div className="p-2 bg-gray-900 rounded">
                • Recent destinations appear at the top of the move dialog for quick access
              </div>
              <div className="p-2 bg-gray-900 rounded">
                • The app minimizes to system tray when closed — click the tray icon to reopen
              </div>
              <div className="p-2 bg-gray-900 rounded">
                • New downloads automatically trigger a popup for organization
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
      {/* Bulk move modal */}
      {showBulkMoveModal && selectedFiles.length > 0 && (
        <BulkMoveModal
          files={selectedFiles}
          onClose={() => setShowBulkMoveModal(false)}
          onMove={handleBulkMove}
        />
      )}
    </div>
  );
}

export default App;