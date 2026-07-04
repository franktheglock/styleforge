pub mod provider;
pub mod ollama;
pub mod lmstudio;
pub mod llamacpp;
pub mod openrouter;
pub mod nvidia_nim;
pub mod prompt_builder;
pub mod operations;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatMessage {
    pub role: String, // "user", "assistant", "system"
    pub content: String,
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
    pub tool_calls: Option<serde_json::Value>,
}
