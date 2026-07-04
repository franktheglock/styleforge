pub mod tokens;
pub mod extractor;
pub mod matcher;
pub mod inheritance;
pub mod profiles;

use serde::{Deserialize, Serialize};
use tokens::StyleProfile;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub id: String,
    pub r#type: String, // heading, paragraph, list, table, divider
    pub style_token: String,
    pub content: serde_json::Value, // Tiptap JSON node structure
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMetadata {
    pub created_at: String,
    pub updated_at: String,
    pub author: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocumentModel {
    pub id: String,
    pub title: String,
    pub style_profile_id: String,
    pub style_profile: StyleProfile,
    pub sections: Vec<Section>,
    pub metadata: DocumentMetadata,
}
