use crate::database::sqlite::DbAIProvider;
use super::{ChatRequest, ChatResponse, provider::AIProvider};
use reqwest::Client;

pub struct NvidiaNimProvider;

impl AIProvider for NvidiaNimProvider {
    async fn chat(&self, config: &DbAIProvider, request: ChatRequest) -> Result<ChatResponse, String> {
        let client = Client::new();
        let base_url = config.endpoint.trim_end_matches('/');
        let url = if base_url.ends_with("/chat/completions") {
            base_url.to_string()
        } else {
            format!("{}/chat/completions", base_url)
        };

        let messages: Vec<serde_json::Value> = request.messages.iter().map(|msg| {
            let mut m = serde_json::json!({
                "role": msg.role,
                "content": msg.content
            });
            if let Some(tc) = &msg.tool_calls {
                m["tool_calls"] = tc.clone();
            }
            if let Some(tcid) = &msg.tool_call_id {
                m["tool_call_id"] = serde_json::Value::String(tcid.clone());
            }
            m
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
            .header("Authorization", format!("Bearer {}", config.api_key))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("NVIDIA NIM request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("NVIDIA NIM returned error status: {}. Response: {}", status, err_text));
        }

        let res_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse NVIDIA NIM JSON: {}", e))?;

        let content = res_json["choices"][0]["message"]["content"].as_str().map(|s| s.to_string());
        let tool_calls = res_json["choices"][0]["message"]["tool_calls"].clone();

        Ok(ChatResponse {
            content,
            reasoning: None,
            tool_calls: if tool_calls.is_null() { None } else { Some(tool_calls) },
        })
    }
}
