use crate::style::DocumentModel;

pub fn build_system_prompt(doc: &DocumentModel) -> String {
    let available_tokens: Vec<&String> = doc.style_profile.tokens.keys().collect();
    let sections_list: Vec<String> = doc.sections.iter().map(|s| {
        format!(
            "- ID: \"{}\", Type: \"{}\", Style Token: \"{}\", Content Preview: \"{}\"",
            s.id, s.r#type, s.style_token, get_section_preview(s)
        )
    }).collect();
    
    format!(
        "You are StyleForge Assistant, a conversational document editor and writing partner.
Your job is to chat with the user and help them edit their document.

If the user asks you to make structural changes (like inserting, moving, deleting, duplicating, or renaming sections), you MUST call the `edit_document_structure` tool to execute those changes.
Do not explain the tool parameters or output raw JSON schema in your text reply. Instead, respond with a helpful, friendly message explaining what you did.

Available Style Tokens in the current document: {:?}
Use these style tokens for any new sections you insert.

Current Document Sections:
{}
        Please respond conversationally to the user.",
        available_tokens,
        sections_list.join("\n")
    )
}

fn get_section_preview(sec: &crate::style::Section) -> String {
    // extract simple preview text from tiptap json
    let val = &sec.content;
    let mut text = String::new();
    extract_text_recursive(val, &mut text);
    if text.is_empty() {
        text = format!("[{}]", sec.r#type);
    }
    if text.chars().count() > 60 {
        format!("{}...", text.chars().take(57).collect::<String>())
    } else {
        text
    }
}

fn extract_text_recursive(val: &serde_json::Value, text: &mut String) {
    if let Some(t) = val.get("text") {
        if let Some(s) = t.as_str() {
            if !text.is_empty() {
                text.push(' ');
            }
            text.push_str(s);
        }
    }
    if let Some(content_array) = val.get("content").and_then(|c| c.as_array()) {
        for child in content_array {
            extract_text_recursive(child, text);
        }
    }
}
