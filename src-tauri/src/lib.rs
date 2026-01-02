use serde::Serialize;
use sysinfo::Disks;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_drives])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
