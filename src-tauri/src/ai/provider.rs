use crate::database::sqlite::DbAIProvider;
use super::{ChatRequest, ChatResponse};

#[allow(async_fn_in_trait)]
pub trait AIProvider {
    async fn chat(&self, config: &DbAIProvider, request: ChatRequest) -> Result<ChatResponse, String>;
}
