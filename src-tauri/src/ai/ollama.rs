use crate::database::sqlite::DbAIProvider;
use super::{ChatRequest, ChatResponse, provider::AIProvider};
use reqwest::Client;

pub struct OllamaProvider;

impl AIProvider for OllamaProvider {
    async fn chat(&self, config: &DbAIProvider, request: ChatRequest) -> Result<ChatResponse, String> {
        let client = Client::new();
        let url = format!("{}/api/chat", config.endpoint.trim_end_matches('/'));
        
        let ollama_messages: Vec<serde_json::Value> = request.messages.iter().map(|msg| {
            serde_json::json!({
                "role": msg.role,
                "content": msg.content
            })
        }).collect();

        let mut payload = serde_json::json!({
            "model": config.model_name,
            "messages": ollama_messages,
            "stream": false,
            "options": {
                "temperature": request.temperature.unwrap_or(config.temperature),
                "num_predict": request.max_tokens.unwrap_or(config.max_tokens)
            }
        });

        if let Some(tools) = request.tools {
            payload["tools"] = tools;
        }

        println!("[Ollama Chat] Sending request to URL: {} (Model: {})", url, config.model_name);

        let response = client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("Ollama returned error status: {}. Response: {}", status, err_text));
        }

        let res_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama JSON: {}", e))?;

        let content = res_json["message"]["content"].as_str().map(|s| s.to_string());
        let tool_calls = res_json["message"]["tool_calls"].clone();

        Ok(ChatResponse {
            content,
            tool_calls: if tool_calls.is_null() { None } else { Some(tool_calls) },
        })
    }
}
