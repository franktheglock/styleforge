use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StyleProperties {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>, // in pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_weight: Option<serde_json::Value>, // e.g. 700 or "bold"
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_style: Option<String>, // "normal" or "italic"
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_decoration: Option<String>, // "none" or "underline"
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>, // Hex color
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_height: Option<f64>, // multiplier
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub letter_spacing: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin_top: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin_bottom: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin_left: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin_right: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_align: Option<String>, // "left", "center", "right", "justify"

    // Bullet/List Specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indent: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_style_type: Option<String>, // "disc", "circle", "square", "decimal", "none"

    // Divider Specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub divider_style: Option<String>, // "solid", "dashed", "dotted"

    // Table Specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_width: Option<f64>, // pt
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_color: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cell_padding: Option<f64>, // pt
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StyleProfile {
    pub id: String,
    pub name: String,
    pub tokens: HashMap<String, StyleProperties>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_preset: Option<bool>,
}
