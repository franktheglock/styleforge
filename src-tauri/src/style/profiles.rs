use super::tokens::StyleProfile;
use crate::database::sqlite::get_conn;
use rusqlite::params;
use std::collections::HashMap;

pub fn load_profile_from_db(id: &str) -> Result<StyleProfile, String> {
    let conn = get_conn()?;
    let mut stmt = conn
        .prepare("SELECT id, name, tokens_json, is_preset FROM style_profiles WHERE id = ?")
        .map_err(|e| e.to_string())?;
        
    let profile = stmt.query_row(params![id], |row| {
        let tokens_str: String = row.get(2)?;
        let tokens: HashMap<String, super::tokens::StyleProperties> =
            serde_json::from_str(&tokens_str).unwrap_or_default();
        let is_preset_int: i32 = row.get(3)?;
        Ok(StyleProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            tokens,
            is_preset: Some(is_preset_int == 1),
        })
    }).map_err(|e| e.to_string())?;

    Ok(profile)
}

pub fn save_profile_to_db(profile: &StyleProfile) -> Result<(), String> {
    let conn = get_conn()?;
    let tokens_str = serde_json::to_string(&profile.tokens).map_err(|e| e.to_string())?;
    let is_preset = profile.is_preset.unwrap_or(false);
    
    conn.execute(
        "INSERT OR REPLACE INTO style_profiles (id, name, tokens_json, is_preset)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            profile.id,
            profile.name,
            tokens_str,
            if is_preset { 1 } else { 0 }
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn list_profiles_from_db() -> Result<Vec<StyleProfile>, String> {
    let conn = get_conn()?;
    let mut stmt = conn
        .prepare("SELECT id, name, tokens_json, is_preset FROM style_profiles")
        .map_err(|e| e.to_string())?;
        
    let rows = stmt.query_map([], |row| {
        let tokens_str: String = row.get(2)?;
        let tokens: HashMap<String, super::tokens::StyleProperties> =
            serde_json::from_str(&tokens_str).unwrap_or_default();
        let is_preset_int: i32 = row.get(3)?;
        Ok(StyleProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            tokens,
            is_preset: Some(is_preset_int == 1),
        })
    }).map_err(|e| e.to_string())?;

    let mut profiles = Vec::new();
    for row in rows {
        if let Ok(profile) = row {
            profiles.push(profile);
        }
    }
    Ok(profiles)
}
