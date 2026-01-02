import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HardDrive, Database, Usb } from "lucide-react";
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function DriveCard({ drive }: { drive: DriveInfo }) {
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
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 cursor-pointer transition-all border border-gray-700 hover:border-blue-500">
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

function App() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrives();
  }, []);

  async function loadDrives() {
    try {
      const result = await invoke<DriveInfo[]>("get_drives");
      setDrives(result);
    } catch (error) {
      console.error("Failed to load drives:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-blue-400" />
          FileForge
        </h1>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">
          Drives & Storage
        </h2>

        {loading ? (
          <div className="text-gray-400">Loading drives...</div>
        ) : (
          <div className="grid gap-4">
            {drives.map((drive, index) => (
              <DriveCard key={index} drive={drive} />
            ))}
          </div>
        )}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm text-gray-400">
        {drives.length} drive(s) detected
      </footer>
    </div>
  );
}

export default App;