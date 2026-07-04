use crate::database::sqlite::DbAIProvider;
use super::{ChatRequest, ChatResponse, provider::AIProvider};
use reqwest::Client;

pub struct LlamaCppProvider;

impl AIProvider for LlamaCppProvider {
    async fn chat(&self, config: &DbAIProvider, request: ChatRequest) -> Result<ChatResponse, String> {
        let client = Client::new();
        let base_url = config.endpoint.trim_end_matches('/');
        
        let url = if base_url.contains("/v1") {
            if base_url.ends_with("/chat/completions") {
                base_url.to_string()
            } else {
                format!("{}/chat/completions", base_url)
            }
        } else {
            format!("{}/v1/chat/completions", base_url)
        };

        println!("[Llama.cpp Chat] Sending request to URL: {} (Model: {})", url, config.model_name);

        let messages: Vec<serde_json::Value> = request.messages.iter().map(|msg| {
            serde_json::json!({
                "role": msg.role,
                "content": msg.content
            })
        }).collect();

        let mut payload = serde_json::json!({
            "model": config.model_name,
            "messages": messages,
            "temperature": request.temperature.unwrap_or(config.temperature),
            "max_tokens": request.max_tokens.unwrap_or(config.max_tokens)
        });

        if let Some(tools) = request.tools {
            payload["tools"] = tools;
        }

        let response = client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("llama.cpp OpenAI-compat request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("llama.cpp OpenAI-compat returned error status: {}. Response: {}", status, err_text));
        }

        let res_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse llama.cpp JSON: {}", e))?;

        let content = res_json["choices"][0]["message"]["content"].as_str().map(|s| s.to_string());
        let tool_calls = res_json["choices"][0]["message"]["tool_calls"].clone();

        Ok(ChatResponse {
            content,
            tool_calls: if tool_calls.is_null() { None } else { Some(tool_calls) },
        })
    }
}
