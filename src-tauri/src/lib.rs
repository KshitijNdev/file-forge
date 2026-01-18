use serde::Serialize;
use sysinfo::Disks;
use std::fs;
use std::path::Path;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc::channel;
use tauri::{Emitter, Manager, AppHandle};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};
#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

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
fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_downloads_path() -> String {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "C:\\Users\\Default\\Downloads".to_string())
}

#[tauri::command]
fn get_autostart_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(run_key) = hkcu.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run") {
            return run_key.get_value::<String, _>("FileForge").is_ok();
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
fn set_autostart_enabled(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags("Software\\Microsoft\\Windows\\CurrentVersion\\Run", KEY_WRITE)
            .map_err(|e| e.to_string())?;
        
        if enabled {
            // Get current executable path
            let exe_path = std::env::current_exe()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();
            
            // Add --hidden flag so it starts minimized
            let launch_cmd = format!("\"{}\" --hidden", exe_path);
            run_key
                .set_value("FileForge", &launch_cmd)
                .map_err(|e| e.to_string())?;
        } else {
            // Ignore error if key doesn't exist
            let _ = run_key.delete_value("FileForge");
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Auto-start not supported on this platform".to_string())
    }
}

fn start_watcher(app_handle: AppHandle) {
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
            println!("Event detected: {:?}", event.kind);
            
            // Watch for Create OR Rename (browsers rename .crdownload to final name)
            let is_relevant = matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Modify(notify::event::ModifyKind::Name(_))
            );
            
            if !is_relevant {
                continue;
            }
            
            for path in event.paths {
                let name = path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                
                println!("File: {}", name);
                
                // Skip temp files
                if name.ends_with(".crdownload") || 
                   name.ends_with(".tmp") || 
                   name.ends_with(".partial") ||
                   name.starts_with(".") ||
                   name.ends_with(".download") {
                    println!("Skipping temp file");
                    continue;
                }
                
                // Make sure file exists and is a file (not directory)
                if !path.is_file() {
                    println!("Not a file, skipping");
                    continue;
                }
                
                // Wait a moment for file to finish writing
                std::thread::sleep(std::time::Duration::from_millis(500));
                
                if let Ok(metadata) = fs::metadata(&path) {
                    println!("New download detected: {} ({} bytes)", name, metadata.len());
                    
                    let event = NewFileEvent {
                        name,
                        path: path.to_string_lossy().to_string(),
                        size: metadata.len(),
                    };
                    
                    // Show window when new download detected
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                        
                        #[cfg(target_os = "windows")]
                        {
                            let _ = window.set_always_on_top(true);
                            let _ = window.set_always_on_top(false);
                        }
                        println!("Window shown!");
                    }
                    
                    let _ = app_handle.emit("new-download", event);
                }
            }
        }
    });
}


fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show FileForge", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    
    let menu = Menu::with_items(app, &[&show, &quit])?;
    
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("FileForge - File Manager")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button, button_state, .. } = event {
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if started with --hidden flag
    let start_hidden = std::env::args().any(|arg| arg == "--hidden");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_drives, 
            list_directory, 
            move_file, 
            create_folder,
            get_downloads_path,
            delete_file,
            get_autostart_enabled,
            set_autostart_enabled,
            get_recent_destinations,
            add_recent_destination,
        ])
        .setup(move |app| {
            setup_tray(app)?;
            start_watcher(app.handle().clone());
            
            // Hide window if started with --hidden flag
            if start_hidden {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
use std::io::{Read, Write};

#[derive(Serialize, serde::Deserialize, Clone)]
struct AppData {
    recent_destinations: Vec<String>,
}

fn get_app_data_path() -> std::path::PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("FileForge");
    fs::create_dir_all(&path).ok();
    path.push("data.json");
    path
}

fn load_app_data() -> AppData {
    let path = get_app_data_path();
    if let Ok(mut file) = fs::File::open(&path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(data) = serde_json::from_str(&contents) {
                return data;
            }
        }
    }
    AppData {
        recent_destinations: Vec::new(),
    }
}

fn save_app_data(data: &AppData) {
    let path = get_app_data_path();
    if let Ok(mut file) = fs::File::create(&path) {
        let json = serde_json::to_string_pretty(data).unwrap_or_default();
        let _ = file.write_all(json.as_bytes());
    }
}

#[tauri::command]
fn get_recent_destinations() -> Vec<String> {
    load_app_data().recent_destinations
}

#[tauri::command]
fn add_recent_destination(path: String) {
    let mut data = load_app_data();
    
    // Remove if already exists (we'll add it to front)
    data.recent_destinations.retain(|p| p != &path);
    
    // Add to front
    data.recent_destinations.insert(0, path);
    
    // Keep only last 5
    data.recent_destinations.truncate(5);
    
    save_app_data(&data);
}