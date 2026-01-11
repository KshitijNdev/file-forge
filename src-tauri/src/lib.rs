use serde::Serialize;
use sysinfo::Disks;
use std::fs;
use std::path::Path;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc::channel;
use tauri::{Emitter};

#[derive(Serialize)]
struct DriveInfo {
    name: String,
    mount_point: String,
    total_space: u64,
    available_space: u64,
    used_space: u64,
    usage_percent: f64,
    file_system: String,
    is_removable: bool,
}

#[derive(Serialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

#[derive(Serialize, Clone)]
struct NewFileEvent {
    name: String,
    path: String,
    size: u64,
}

#[tauri::command]
fn get_drives() -> Vec<DriveInfo> {
    let disks = Disks::new_with_refreshed_list();

    disks
        .iter()
        .map(|disk| {
            let total = disk.total_space();
            let available = disk.available_space();
            let used = total - available;
            let percent = if total > 0 {
                (used as f64 / total as f64) * 100.0
            } else {
                0.0
            };

            DriveInfo {
                name: disk.name().to_string_lossy().to_string(),
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                total_space: total,
                available_space: available,
                used_space: used,
                usage_percent: percent,
                file_system: disk.file_system().to_string_lossy().to_string(),
                is_removable: disk.is_removable(),
            }
        })
        .collect()
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() {
        return Err("Path does not exist".to_string());
    }
    
    let entries = fs::read_dir(dir_path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            
            Some(FileEntry {
                name,
                path: entry.path().to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
            })
        })
        .collect();
    
    Ok(entries)
}

#[tauri::command]
fn move_file(source: String, destination: String) -> Result<(), String> {
    let dest_path = Path::new(&destination);
    
    // Create destination directory if it doesn't exist
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    // Try rename first (fast, same drive)
    if fs::rename(&source, &destination).is_ok() {
        return Ok(());
    }
    
    // If rename fails (cross-drive), copy then delete
    fs::copy(&source, &destination).map_err(|e| format!("Copy failed: {}", e))?;
    fs::remove_file(&source).map_err(|e| format!("Delete original failed: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_downloads_path() -> String {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "C:\\Users\\Default\\Downloads".to_string())
}

fn start_watcher(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let (tx, rx) = channel();
        
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        }).expect("Failed to create watcher");
        
        let downloads = dirs::download_dir().expect("Could not find Downloads folder");
        watcher.watch(&downloads, RecursiveMode::NonRecursive).expect("Failed to watch");
        
        println!("Watching: {:?}", downloads);
        
        for event in rx {
            // Only care about new files being created
            if matches!(event.kind, EventKind::Create(_)) {
                for path in event.paths {
                    // Skip temp files and partial downloads
                    let name = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    
                    if name.ends_with(".crdownload") || 
                       name.ends_with(".tmp") || 
                       name.ends_with(".partial") ||
                       name.starts_with(".") {
                        continue;
                    }
                    
                    // Wait a moment for file to finish writing
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    
                    if let Ok(metadata) = fs::metadata(&path) {
                        let event = NewFileEvent {
                            name,
                            path: path.to_string_lossy().to_string(),
                            size: metadata.len(),
                        };
                        
                        let _ = app_handle.emit("new-download", event);
                    }
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_drives, 
            list_directory, 
            move_file, 
            create_folder,
            get_downloads_path,
            delete_file
        ])
        .setup(|app| {
            start_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}