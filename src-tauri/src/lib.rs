pub mod database;
pub mod style;
pub mod ai;
pub mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
            let db_path = app_data_dir.join("styleforge.db");
            
            // Set and initialize SQLite database in OS standard app folder
            database::sqlite::set_db_path(db_path);
            if let Err(e) = database::sqlite::init_db() {
                eprintln!("DATABASE INIT ERROR: {}", e);
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::import::import_document,
            commands::import::import_from_string,
            commands::export::export_document,
            commands::styles::load_profiles,
            commands::styles::save_profile,
            commands::ai::load_ai_providers,
            commands::ai::save_ai_provider,
            commands::ai::run_ai_operations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
