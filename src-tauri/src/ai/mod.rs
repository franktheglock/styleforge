pub mod provider;
pub mod lmstudio;
pub mod llamacpp;
pub mod openrouter;
pub mod nvidia_nim;
pub mod prompt_builder;
pub mod operations;

use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String, // "user", "assistant", "system", "tool"
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>, // tool name for tool role
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub tools: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatResponse {
    pub content: Option<String>,
    pub reasoning: Option<String>,
    pub tool_calls: Option<serde_json::Value>,
}
