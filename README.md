# FileForge

![GitHub release](https://img.shields.io/github/v/release/KshitijNdev/file-forge)

A personal file management system built with Tauri, React, and Rust. Designed to organize your Downloads folder and manage files across drives.

## 📥 Download

**Latest Release: [v0.1.0](https://github.com/KshitijNdev/file-forge/releases/latest)**

### Windows Installers:
- **[FileForge Setup (NSIS)](https://github.com/KshitijNdev/file-forge/releases/download/v0.1.0/FileForge_0.1.0_x64-setup.exe)** - Recommended
- **[FileForge MSI](https://github.com/KshitijNdev/file-forge/releases/download/v0.1.0/FileForge_0.1.0_x64_en-US.msi)** - Alternative

**Requirements:** Windows 10/11 (64-bit)

## Features

- **Drive Overview** — View all drives with storage usage bars (color-coded by capacity)
- **Folder Navigation** — Browse any folder with clickable breadcrumbs
- **File Type Icons** — Visual icons for images, videos, documents, code, archives, etc.
- **Download Watcher** — Auto-detects new files in your Downloads folder and prompts for organization
- **Move Files** — Move files anywhere, including across drives
- **Delete to Recycle Bin** — Safe deletion with recycle bin support
- **Multi-Select** — Windows-style selection:
  - Click to select
  - Ctrl+Click to toggle
  - Shift+Click for range
  - Arrow keys to navigate
  - Ctrl+A to select all
- **Bulk Operations** — Move or delete multiple files at once
- **Create Folders** — Create new folders directly from the move dialog

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Tailwind CSS |
| Backend | Rust |
| Framework | Tauri v2 |
| Icons | Lucide React |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (v1.70+)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows only, with C++ workload)

## Installation
```bash
# Clone the repo
git clone https://github.com/KshitijNdev/file-forge.git
cd file-forge

# Install dependencies
npm install

# Run in development
npm run tauri dev
```

## Building for Production
```bash
npm run tauri build
```

The executable will be in `src-tauri/target/release/`.

## Project Structure
```
file-forge/
├── src/                    # React frontend
│   ├── App.tsx             # Main application
│   └── App.css             # Tailwind styles
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   └── lib.rs          # Core logic (drives, files, watcher)
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri config
├── package.json
└── vite.config.ts
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate files |
| `Shift + ↑/↓` | Extend selection |
| `Ctrl + A` | Select all |
| `Ctrl + Click` | Toggle selection |
| `Shift + Click` | Range select |
| `Enter` | Open move dialog |
| `Delete` | Delete selected |
| `Escape` | Clear selection |

## Roadmap

- [x] Recent destinations / favorites
- [x] System tray + auto-start
- [ ] Auto-organize rules (e.g., .pdf → Documents)
- [ ] File preview pane
- [ ] Search functionality
