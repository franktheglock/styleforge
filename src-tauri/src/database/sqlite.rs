use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbStyleProfile {
    pub id: String,
    pub name: String,
    pub tokens_json: String,
    pub is_preset: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbDocument {
    pub id: String,
    pub title: String,
    pub style_profile_id: String,
    pub sections_json: String,
    pub metadata_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbAIProvider {
    pub id: String,
    pub name: String,
    pub provider_type: String, // Ollama, LMStudio, LlamaCpp, OpenRouter, NvidiaNim, Custom
    pub endpoint: String,
    pub api_key: String,
    pub model_name: String,
    pub temperature: f64,
    pub max_tokens: i32,
    pub is_default: bool,
}

use std::sync::OnceLock;

static DB_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn set_db_path(path: PathBuf) {
    let _ = DB_PATH.set(path);
}

pub fn get_db_path() -> PathBuf {
    DB_PATH.get().cloned().unwrap_or_else(|| {
        let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("StyleForge");
        if !path.exists() {
            let _ = fs::create_dir_all(&path);
        }
        path.push("styleforge.db");
        path
    })
}

pub fn init_db() -> Result<(), String> {
    let db_path = get_db_path();
    let mut conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    // Create tables
    conn.execute(
        "CREATE TABLE IF NOT EXISTS style_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tokens_json TEXT NOT NULL,
            is_preset INTEGER DEFAULT 0
        )",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            style_profile_id TEXT NOT NULL,
            sections_json TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(style_profile_id) REFERENCES style_profiles(id)
        )",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS ai_providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            api_key TEXT NOT NULL,
            model_name TEXT NOT NULL,
            temperature REAL NOT NULL,
            max_tokens INTEGER NOT NULL,
            is_default INTEGER DEFAULT 0
        )",
        [],
    ).map_err(|e| e.to_string())?;

    // Seed default presets if they don't exist
    seed_presets(&mut conn)?;

    Ok(())
}

fn seed_presets(conn: &mut Connection) -> Result<(), String> {
    // Check if style profiles are already seeded
    let profile_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM style_profiles",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    if profile_count == 0 {
        // Default clean resume profile
        let default_resume_tokens = serde_json::json!({
            "heading": {
                "fontFamily": "Outfit",
                "fontSize": 18,
                "fontWeight": "bold",
                "lineHeight": 1.2,
                "letterSpacing": 0.5,
                "marginTop": 20,
                "marginBottom": 8,
                "textAlign": "left",
                "color": "#1e293b"
            },
            "heading_2": {
                "fontFamily": "Outfit",
                "fontSize": 14,
                "fontWeight": "bold",
                "lineHeight": 1.25,
                "marginTop": 14,
                "marginBottom": 6,
                "textAlign": "left",
                "color": "#334155"
            },
            "body": {
                "fontFamily": "Inter",
                "fontSize": 11,
                "fontWeight": "normal",
                "lineHeight": 1.45,
                "marginTop": 4,
                "marginBottom": 4,
                "textAlign": "left",
                "color": "#1e293b"
            },
            "bullet": {
                "fontFamily": "Inter",
                "fontSize": 11,
                "fontWeight": "normal",
                "lineHeight": 1.4,
                "marginTop": 2,
                "marginBottom": 2,
                "indent": 18,
                "listStyleType": "disc",
                "color": "#1e293b"
            },
            "divider": {
                "height": 1,
                "marginTop": 8,
                "marginBottom": 8,
                "dividerStyle": "solid",
                "color": "#cbd5e1"
            }
        }).to_string();

        let _ = conn.execute(
            "INSERT INTO style_profiles (id, name, tokens_json, is_preset) VALUES (?, ?, ?, 1)",
            params!["preset_resume", "Corporate Classic", default_resume_tokens],
        ).map_err(|e| e.to_string())?;
    }

    // Seed default AI Providers (always run with INSERT OR IGNORE)
    let providers = vec![
        DbAIProvider {
            id: "ollama_default".to_string(),
            name: "Ollama (Local)".to_string(),
            provider_type: "Ollama".to_string(),
            endpoint: "http://127.0.0.1:11434".to_string(),
            api_key: "".to_string(),
            model_name: "llama3".to_string(),
            temperature: 0.2,
            max_tokens: 2048,
            is_default: true,
        },
        DbAIProvider {
            id: "lmstudio_default".to_string(),
            name: "LM Studio".to_string(),
            provider_type: "LMStudio".to_string(),
            endpoint: "http://127.0.0.1:1234/v1".to_string(),
            api_key: "".to_string(),
            model_name: "meta-llama-3-8b-instruct".to_string(),
            temperature: 0.2,
            max_tokens: 2048,
            is_default: false,
        },
        DbAIProvider {
            id: "llamacpp_default".to_string(),
            name: "Llama.cpp (Local)".to_string(),
            provider_type: "LlamaCpp".to_string(),
            endpoint: "http://127.0.0.1:8080".to_string(),
            api_key: "".to_string(),
            model_name: "local".to_string(),
            temperature: 0.2,
            max_tokens: 2048,
            is_default: false,
        },
        DbAIProvider {
            id: "openrouter_default".to_string(),
            name: "OpenRouter (Cloud)".to_string(),
            provider_type: "OpenRouter".to_string(),
            endpoint: "https://openrouter.ai/api/v1".to_string(),
            api_key: "".to_string(),
            model_name: "meta-llama/llama-3-8b-instruct:free".to_string(),
            temperature: 0.2,
            max_tokens: 2048,
            is_default: false,
        }
    ];

    for p in providers {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO ai_providers (id, name, provider_type, endpoint, api_key, model_name, temperature, max_tokens, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![p.id, p.name, p.provider_type, p.endpoint, p.api_key, p.model_name, p.temperature, p.max_tokens, if p.is_default { 1 } else { 0 }],
        );
    }

    Ok(())
}

// Database helper functions for use in commands
pub fn get_conn() -> Result<Connection, String> {
    let db_path = get_db_path();
    Connection::open(&db_path).map_err(|e| e.to_string())
}
