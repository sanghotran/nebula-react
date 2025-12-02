// Định nghĩa lệnh đóng/mở
#[tauri::command]
fn close_app(window: tauri::Window) {
    window.close().unwrap();
}

#[tauri::command]
fn minimize_app(window: tauri::Window) {
    window.minimize().unwrap();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Đăng ký 2 lệnh vừa viết để JS gọi được
        .invoke_handler(tauri::generate_handler![close_app, minimize_app])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}