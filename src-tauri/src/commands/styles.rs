use crate::style::tokens::StyleProfile;
use crate::style::profiles::{list_profiles_from_db, save_profile_to_db};

#[tauri::command]
pub fn load_profiles() -> Result<Vec<StyleProfile>, String> {
    list_profiles_from_db()
}

#[tauri::command]
pub fn save_profile(profile: StyleProfile) -> Result<(), String> {
    save_profile_to_db(&profile)
}
