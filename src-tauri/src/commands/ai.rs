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
use tauri::Emitter;

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

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIResponsePayload {
    pub document: DocumentModel,
    pub assistant_message: String,
}

#[tauri::command]
pub async fn run_ai_operations(
    mut doc: DocumentModel,
    messages: Vec<ChatMessage>,
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

    // Build full message list: system prompt + conversation history
    let mut full_messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.clone(),
        },
    ];
    full_messages.extend(messages);

    let chat_req = ChatRequest {
        messages: full_messages.clone(),
        temperature: Some(config.temperature),
        max_tokens: Some(config.max_tokens),
        tools: Some(tools.clone()),
    };

    // Dispatch request based on provider type
    let mut response = match config.provider_type.as_str() {
        "Ollama" => OllamaProvider.chat(&config, chat_req).await?,
        "LMStudio" => LMStudioProvider.chat(&config, chat_req).await?,
        "LlamaCpp" => LlamaCppProvider.chat(&config, chat_req).await?,
        "OpenRouter" => OpenRouterProvider.chat(&config, chat_req).await?,
        "NvidiaNim" => NvidiaNimProvider.chat(&config, chat_req).await?,
        _ => return Err(format!("Unsupported provider type: {}", config.provider_type)),
    };

    // Parse tool calls (or fallback to raw JSON extraction)
    let (parsed_ops, has_tool_calls) = if let Some(ref tool_calls) = response.tool_calls {
        (parse_operations_from_tool_calls(tool_calls)?, true)
    } else if let Some(ref content) = response.content {
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
    let ops_applied = has_tool_calls && !parsed_ops.is_empty();
    if ops_applied {
        apply_operations(&mut doc, &parsed_ops)?;
        doc.metadata.updated_at = chrono_now();
    }

    // If the LLM made tool calls but didn't include a text response, do a
    // second round so it can describe what it did conversationally.
    if ops_applied && response.content.is_none() {
        let system_note = ChatMessage {
            role: "system".to_string(),
            content: format!(
                "You executed the following operations. Tell the user what you did conversationally:\n{}",
                parsed_ops.iter().map(|o| format!("- {:?}", o)).collect::<Vec<_>>().join("\n")
            ),
        };
        full_messages.push(ChatMessage {
            role: "assistant".to_string(),
            content: "[tool calls executed]".to_string(),
        });
        full_messages.push(system_note);

        let second_req = ChatRequest {
            messages: full_messages,
            temperature: Some(config.temperature),
            max_tokens: Some(512),
            tools: None, // no more tools needed for follow-up
        };

        let second_resp = match config.provider_type.as_str() {
            "Ollama" => OllamaProvider.chat(&config, second_req).await?,
            "LMStudio" => LMStudioProvider.chat(&config, second_req).await?,
            "LlamaCpp" => LlamaCppProvider.chat(&config, second_req).await?,
            "OpenRouter" => OpenRouterProvider.chat(&config, second_req).await?,
            "NvidiaNim" => NvidiaNimProvider.chat(&config, second_req).await?,
            _ => return Err(format!("Unsupported provider type: {}", config.provider_type)),
        };

        response = second_resp;
    }

    // Capture the conversational response message
    let assistant_message = response.content.clone().unwrap_or_else(|| {
        if ops_applied {
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

/// Emit streaming events from an OpenAI-compatible endpoint.
/// Handles LMStudio, LlamaCpp, OpenRouter, NvidiaNim, and Custom providers.
#[tauri::command]
pub async fn stream_ai_operations(
    app_handle: tauri::AppHandle,
    mut doc: DocumentModel,
    messages: Vec<ChatMessage>,
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

    let system_prompt = build_system_prompt(&doc);
    let tools = serde_json::json!([{
        "type": "function",
        "function": {
            "name": "edit_document_structure",
            "description": "Translates the user instruction into a sequence of structural operations on the document.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "operations": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "operation": { "type": "STRING", "enum": ["insertSection", "moveSection", "deleteSection", "duplicateSection", "renameSection"] },
                                "targetId": { "type": "STRING" },
                                "afterId": { "type": "STRING" },
                                "sectionType": { "type": "STRING", "enum": ["heading", "paragraph", "list", "table", "divider"] },
                                "styleToken": { "type": "STRING" },
                                "content": { "type": "OBJECT" }
                            },
                            "required": ["operation"]
                        }
                    }
                },
                "required": ["operations"]
            }
        }
    }]);

    let mut full_messages = vec![
        ChatMessage { role: "system".to_string(), content: system_prompt },
    ];
    full_messages.extend(messages.clone());

    // Build the endpoint URL (same pattern as the providers use)
    let ep = config.endpoint.trim_end_matches('/');
    let url = match config.provider_type.as_str() {
        "Ollama" => format!("{}/api/chat", ep),
        _ => format!("{}/v1/chat/completions", ep),
    };

    let body = serde_json::json!({
        "model": config.model_name,
        "messages": full_messages.clone(),
        "stream": true,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "tools": tools,
    });

    let client = reqwest::Client::new();
    let mut req = client.post(&url)
        .header("Content-Type", "application/json");
    if !config.api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", config.api_key));
    }

    let mut resp = req.json(&body).send().await.map_err(|e| format!("Stream request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Stream API error {}: {}", status, text));
    }

    // Accumulate text content + tool call arguments across SSE chunks
    let mut full_text = String::new();
    let mut tool_call_buffers: std::collections::HashMap<usize, (Option<String>, String)> = std::collections::HashMap::new(); // index -> (id, args)
    let mut has_tool_calls = false;

    // Ollama uses a different SSE format than OpenAI-compatible APIs
    if config.provider_type.as_str() == "Ollama" {
        // Non-streaming fallback for Ollama
        drop(resp);
        let fallback = run_ai_operations(doc, messages, provider_id).await?;
        app_handle.emit("ai-stream:done", &fallback.assistant_message).map_err(|e| e.to_string())?;
        return Ok(fallback);
    }

    // OpenAI-compatible SSE streaming: accumulate chunks into a line buffer
    // and parse each complete line as an SSE "data:" event.
    let mut line_buf = String::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("Stream read error: {}", e))? {
        line_buf.push_str(&String::from_utf8_lossy(&chunk));
        // Process all complete lines in the buffer
        loop {
            let newline_idx = match line_buf.find('\n') {
                Some(i) => i,
                None => break, // wait for more data
            };
            let line = line_buf[..newline_idx].trim().to_string();
            line_buf = line_buf[newline_idx + 1..].to_string();
            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }
            let data = &line[6..];
            if data == "[DONE]" {
                continue;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                    if let Some(choice) = choices.first() {
                        if let Some(delta) = choice.get("delta") {
                            // Text content: try multiple field names since some
                            // providers put it in different places
                            let content_str: Option<&str> = delta.get("content")
                                .and_then(|c| c.as_str())
                                .or_else(|| delta.get("text").and_then(|t| t.as_str()))
                                .or_else(|| delta.get("reasoning_content").and_then(|r| r.as_str()));
                            if let Some(content) = content_str {
                                if !content.is_empty() {
                                    full_text.push_str(content);
                                    let _ = app_handle.emit("ai-stream:token", content);
                                }
                            }
                            // Tool call chunks in streaming delta
                            if let Some(tc) = delta.get("tool_calls").and_then(|t| t.as_array()) {
                                for call in tc {
                                    if let Some(idx) = call.get("index").and_then(|i| i.as_i64()).map(|i| i as usize) {
                                        let entry = tool_call_buffers.entry(idx).or_insert((None, String::new()));
                                        if let Some(id) = call.get("id").and_then(|i| i.as_str()) {
                                            if entry.0.is_none() { entry.0 = Some(id.to_string()); }
                                        }
                                        if let Some(args) = call.get("function").and_then(|f| f.get("arguments")) {
                                            match args {
                                                serde_json::Value::String(s) => entry.1.push_str(s),
                                                v => entry.1.push_str(&v.to_string()),
                                            }
                                        }
                                    }
                                }
                                has_tool_calls = true;
                            }
                        }
                        // Also check the choice-level content/message (fallback)
                        if let Some(msg) = choice.get("message") {
                            if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                                if !content.is_empty() && full_text.is_empty() {
                                    full_text.push_str(content);
                                    let _ = app_handle.emit("ai-stream:token", content);
                                }
                            }
                        }
                        // finish_reason == "tool_calls" also indicates tool calls
                        if let Some(finish) = choice.get("finish_reason").and_then(|f| f.as_str()) {
                            if finish == "tool_calls" {
                                has_tool_calls = true;
                            }
                        }
                    }
                }
            }
        }
    }

    // Notify frontend that streaming is done
    app_handle.emit("ai-stream:done", "").map_err(|e| e.to_string())?;

    // ── Process tool calls ──────────────────────────────────────────────
    // 1. Try reconstructing from streamed delta.tool_calls chunks
    let mut ops_applied = false;
    if has_tool_calls && !tool_call_buffers.is_empty() {
        let reconstructed: Vec<serde_json::Value> = tool_call_buffers.into_iter().map(|(_, (id, args))| {
            serde_json::json!({
                "id": id.unwrap_or_default(),
                "type": "function",
                "function": {
                    "name": "edit_document_structure",
                    "arguments": args
                }
            })
        }).collect();

        let tc_val = serde_json::Value::Array(reconstructed);
        match parse_operations_from_tool_calls(&tc_val) {
            Ok(ops) if !ops.is_empty() => {
                apply_operations(&mut doc, &ops)?;
                doc.metadata.updated_at = chrono_now();
                ops_applied = true;
            }
            _ => {}
        }
    }

    // 2. Fallback: try extracting tool calls from the accumulated text
    //    Some models output <tool_call> tags or JSON operations in the content
    if !ops_applied && !full_text.is_empty() {
        if let Ok(json_array) = extract_json_array(&full_text) {
            if let Ok(ops) = serde_json::from_str::<Vec<AICommandOperation>>(&json_array) {
                if !ops.is_empty() {
                    apply_operations(&mut doc, &ops)?;
                    doc.metadata.updated_at = chrono_now();
                    ops_applied = true;
                }
            }
        }
    }

    // If we applied tool calls but the model didn't send a final text response,
    // do a second round so the reasoning model can produce its final answer
    // after seeing the tool result.
    let mut final_text = full_text.clone();
    if ops_applied && final_text.is_empty() {
        let tool_summary: Vec<String> = Vec::new(); // we don't re-derive here; just notify
        let mut second_messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: build_system_prompt(&doc),
            },
        ];
        for m in &messages {
            second_messages.push(m.clone());
        }
        // Tell the model the tool call completed and ask for its final answer
        second_messages.push(ChatMessage {
            role: "assistant".to_string(),
            content: "[Tool call executed. Document updated.]".to_string(),
        });
        second_messages.push(ChatMessage {
            role: "user".to_string(),
            content: "Now respond conversationally about what you did.".to_string(),
        });

        let second_req = ChatRequest {
            messages: second_messages,
            temperature: Some(config.temperature),
            max_tokens: Some(512),
            tools: None,
        };

        let second_resp = match config.provider_type.as_str() {
            "Ollama" => OllamaProvider.chat(&config, second_req).await?,
            "LMStudio" => LMStudioProvider.chat(&config, second_req).await?,
            "LlamaCpp" => LlamaCppProvider.chat(&config, second_req).await?,
            "OpenRouter" => OpenRouterProvider.chat(&config, second_req).await?,
            "NvidiaNim" => NvidiaNimProvider.chat(&config, second_req).await?,
            _ => return Err(format!("Unsupported provider type: {}", config.provider_type)),
        };

        final_text = second_resp.content.clone().unwrap_or_default();
    }

    Ok(AIResponsePayload {
        document: doc,
        assistant_message: final_text,
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
