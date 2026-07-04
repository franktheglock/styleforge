use crate::database::sqlite::{get_conn, DbAIProvider};
use crate::style::DocumentModel;
use crate::ai::{ChatRequest, ChatMessage};
use crate::ai::provider::AIProvider;
use crate::ai::ollama::OllamaProvider;
use crate::ai::lmstudio::LMStudioProvider;
use crate::ai::llamacpp::LlamaCppProvider;
use crate::ai::openrouter::OpenRouterProvider;
use crate::ai::nvidia_nim::NvidiaNimProvider;
use crate::ai::prompt_builder::build_system_prompt;
use crate::ai::operations::{apply_operations, AICommandOperation};
use rusqlite::params;

#[tauri::command]
pub fn load_ai_providers() -> Result<Vec<DbAIProvider>, String> {
    let conn = get_conn()?;
    let mut stmt = conn
        .prepare("SELECT id, name, provider_type, endpoint, api_key, model_name, temperature, max_tokens, is_default FROM ai_providers")
        .map_err(|e| e.to_string())?;
        
    let rows = stmt.query_map([], |row| {
        let is_default_int: i32 = row.get(8)?;
        Ok(DbAIProvider {
            id: row.get(0)?,
            name: row.get(1)?,
            provider_type: row.get(2)?,
            endpoint: row.get(3)?,
            api_key: row.get(4)?,
            model_name: row.get(5)?,
            temperature: row.get(6)?,
            max_tokens: row.get(7)?,
            is_default: is_default_int == 1,
        })
    }).map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        if let Ok(p) = r {
            list.push(p);
        }
    }
    Ok(list)
}

#[tauri::command]
pub fn save_ai_provider(provider: DbAIProvider) -> Result<(), String> {
    let conn = get_conn()?;
    
    // If setting as default, unset other defaults first
    if provider.is_default {
        let _ = conn.execute("UPDATE ai_providers SET is_default = 0", []);
    }

    conn.execute(
        "INSERT INTO ai_providers (id, name, provider_type, endpoint, api_key, model_name, temperature, max_tokens, is_default)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            provider_type = excluded.provider_type,
            endpoint = excluded.endpoint,
            api_key = excluded.api_key,
            model_name = excluded.model_name,
            temperature = excluded.temperature,
            max_tokens = excluded.max_tokens,
            is_default = excluded.is_default",
        params![
            provider.id,
            provider.name,
            provider.provider_type,
            provider.endpoint,
            provider.api_key,
            provider.model_name,
            provider.temperature,
            provider.max_tokens,
            if provider.is_default { 1 } else { 0 }
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AIResponsePayload {
    pub document: DocumentModel,
    pub assistant_message: String,
}

#[tauri::command]
pub async fn run_ai_operations(
    mut doc: DocumentModel,
    user_prompt: String,
    provider_id: String,
) -> Result<AIResponsePayload, String> {
    let config = {
        let conn = get_conn()?;
        let mut stmt = conn
            .prepare("SELECT id, name, provider_type, endpoint, api_key, model_name, temperature, max_tokens, is_default FROM ai_providers WHERE id = ?")
            .map_err(|e| e.to_string())?;
            
        stmt.query_row(params![provider_id], |row| {
            let is_default_int: i32 = row.get(8)?;
            Ok(DbAIProvider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: row.get(2)?,
                endpoint: row.get(3)?,
                api_key: row.get(4)?,
                model_name: row.get(5)?,
                temperature: row.get(6)?,
                max_tokens: row.get(7)?,
                is_default: is_default_int == 1,
            })
        }).map_err(|e| e.to_string())?
    };

    let tools = serde_json::json!([
        {
            "type": "function",
            "function": {
                "name": "edit_document_structure",
                "description": "Translates the user instruction into a sequence of structural operations on the document.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "operations": {
                            "type": "ARRAY",
                            "description": "The sequential list of document mutations.",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "operation": {
                                        "type": "STRING",
                                        "enum": ["insertSection", "moveSection", "deleteSection", "duplicateSection", "renameSection"],
                                        "description": "Type of mutation to execute."
                                    },
                                    "targetId": {
                                        "type": "STRING",
                                        "description": "Section ID to target (delete, move, duplicate, rename)."
                                    },
                                    "afterId": {
                                        "type": "STRING",
                                        "description": "Section ID to insert after or move after."
                                    },
                                    "sectionType": {
                                        "type": "STRING",
                                        "enum": ["heading", "paragraph", "list", "table", "divider"],
                                        "description": "Section tag type if inserting a new section."
                                    },
                                    "styleToken": {
                                        "type": "STRING",
                                        "description": "Global style token matching the style profile."
                                    },
                                    "content": {
                                        "type": "OBJECT",
                                        "description": "Tiptap JSON node structure representing the text contents."
                                    }
                                },
                                "required": ["operation"]
                            }
                        }
                    },
                    "required": ["operations"]
                }
            }
        }
    ]);

    let system_prompt = build_system_prompt(&doc);

    let chat_req = ChatRequest {
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_prompt,
            },
        ],
        temperature: Some(config.temperature),
        max_tokens: Some(config.max_tokens),
        tools: Some(tools),
    };

    // Dispatch request based on provider type
    let response = match config.provider_type.as_str() {
        "Ollama" => OllamaProvider.chat(&config, chat_req).await?,
        "LMStudio" => LMStudioProvider.chat(&config, chat_req).await?,
        "LlamaCpp" => LlamaCppProvider.chat(&config, chat_req).await?,
        "OpenRouter" => OpenRouterProvider.chat(&config, chat_req).await?,
        "NvidiaNim" => NvidiaNimProvider.chat(&config, chat_req).await?,
        _ => return Err(format!("Unsupported provider type: {}", config.provider_type)),
    };

    // 1. First, check if the LLM invoked our tool_calls structure
    let (parsed_ops, has_tool_calls) = if let Some(ref tool_calls) = response.tool_calls {
        (parse_operations_from_tool_calls(tool_calls)?, true)
    } else if let Some(ref content) = response.content {
        // 2. Otherwise, fall back to parsing the raw content string
        if let Ok(json_array) = extract_json_array(content) {
            let ops = serde_json::from_str(&json_array).unwrap_or_default();
            (ops, true)
        } else {
            (Vec::new(), false)
        }
    } else {
        (Vec::new(), false)
    };

    // Apply operations if any were generated
    if has_tool_calls && !parsed_ops.is_empty() {
        apply_operations(&mut doc, &parsed_ops)?;
        doc.metadata.updated_at = chrono_now();
    }

    // Capture the conversational response message
    let assistant_message = response.content.clone().unwrap_or_else(|| {
        if has_tool_calls {
            "I have updated the document structure according to your request.".to_string()
        } else {
            "I couldn't identify any specific structural modifications to apply.".to_string()
        }
    });

    Ok(AIResponsePayload {
        document: doc,
        assistant_message,
    })
}

fn parse_operations_from_tool_calls(tool_calls: &serde_json::Value) -> Result<Vec<AICommandOperation>, String> {
    if let Some(arr) = tool_calls.as_array() {
        for call in arr {
            if let Some(func_name) = call["function"]["name"].as_str() {
                if func_name == "edit_document_structure" {
                    if let Some(args_str) = call["function"]["arguments"].as_str() {
                        let parsed: serde_json::Value = serde_json::from_str(args_str)
                            .map_err(|e| format!("Invalid tool arguments JSON string: {}", e))?;
                        
                        if let Some(ops) = parsed.get("operations") {
                            let operations: Vec<AICommandOperation> = serde_json::from_value(ops.clone())
                                .map_err(|e| format!("Failed to parse AICommandOperation array: {}", e))?;
                            return Ok(operations);
                        }
                    } else if let Some(args_obj) = call["function"]["arguments"].as_object() {
                        // Sometimes local providers return arguments directly parsed as JSON objects
                        let args_val = serde_json::Value::Object(args_obj.clone());
                        if let Some(ops) = args_val.get("operations") {
                            let operations: Vec<AICommandOperation> = serde_json::from_value(ops.clone())
                                .map_err(|e| format!("Failed to parse AICommandOperation array: {}", e))?;
                            return Ok(operations);
                        }
                    }
                }
            }
        }
    }
    Err("Failed to extract valid operations list from tool calls structure.".to_string())
}

fn extract_json_array(text: &str) -> Result<String, String> {
    let start_idx = text.find('[').ok_or_else(|| "No JSON array found in LLM response".to_string())?;
    let end_idx = text.rfind(']').ok_or_else(|| "No matching closing bracket found in LLM response".to_string())?;
    
    if start_idx > end_idx {
        return Err("Invalid JSON structure returned by LLM".to_string());
    }
    
    Ok(text[start_idx..=end_idx].to_string())
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let since_the_epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:?}", since_the_epoch)
}
