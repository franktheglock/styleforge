use crate::style::{Section, DocumentModel};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AICommandOperation {
    pub operation: String, // insertSection, moveSection, deleteSection, duplicateSection, renameSection
    pub target_id: Option<String>,
    pub after_id: Option<String>,
    pub section_type: Option<String>,
    pub style_token: Option<String>,
    pub content: Option<serde_json::Value>,
}

pub fn apply_operations(
    doc: &mut DocumentModel,
    operations: &[AICommandOperation],
) -> Result<(), String> {
    for op in operations {
        match op.operation.as_str() {
            "insertSection" => {
                let section_type = op.section_type.clone().unwrap_or_else(|| "paragraph".to_string());
                let style_token = op.style_token.clone().unwrap_or_else(|| "body".to_string());
                let content = op.content.clone().unwrap_or_else(|| {
                    serde_json::json!({
                        "type": "paragraph",
                        "content": []
                    })
                });
                
                let new_sec = Section {
                    id: format!("sec_ai_{}", uuid_simple()),
                    r#type: section_type,
                    style_token,
                    content,
                };
                
                insert_section_after(&mut doc.sections, op.after_id.as_deref(), new_sec);
            }
            "moveSection" => {
                if let Some(ref target_id) = op.target_id {
                    move_section(&mut doc.sections, target_id, op.after_id.as_deref())?;
                }
            }
            "deleteSection" => {
                if let Some(ref target_id) = op.target_id {
                    doc.sections.retain(|s| &s.id != target_id);
                }
            }
            "duplicateSection" => {
                if let Some(ref target_id) = op.target_id {
                    duplicate_section(&mut doc.sections, target_id)?;
                }
            }
            "renameSection" => {
                if let Some(ref target_id) = op.target_id {
                    if let Some(ref content) = op.content {
                        if let Some(sec) = doc.sections.iter_mut().find(|s| &s.id == target_id) {
                            sec.content = content.clone();
                        }
                    }
                }
            }
            _ => return Err(format!("Unknown AI operation: {}", op.operation)),
        }
    }
    Ok(())
}

fn insert_section_after(sections: &mut Vec<Section>, after_id: Option<&str>, new_sec: Section) {
    if let Some(id) = after_id {
        if let Some(idx) = sections.iter().position(|s| s.id == id) {
            sections.insert(idx + 1, new_sec);
            return;
        }
    }
    // Default: insert at beginning
    sections.insert(0, new_sec);
}

fn move_section(sections: &mut Vec<Section>, target_id: &str, after_id: Option<&str>) -> Result<(), String> {
    let target_idx = sections.iter().position(|s| s.id == target_id)
        .ok_or_else(|| format!("Section to move not found: {}", target_id))?;
    
    let target_sec = sections.remove(target_idx);
    
    let insert_idx = if let Some(id) = after_id {
        sections.iter().position(|s| s.id == id)
            .map(|idx| idx + 1)
            .unwrap_or(0)
    } else {
        0
    };
    
    sections.insert(insert_idx, target_sec);
    Ok(())
}

fn duplicate_section(sections: &mut Vec<Section>, target_id: &str) -> Result<(), String> {
    let idx = sections.iter().position(|s| s.id == target_id)
        .ok_or_else(|| format!("Section to duplicate not found: {}", target_id))?;
    
    let mut duplicated = sections[idx].clone();
    duplicated.id = format!("sec_ai_dup_{}", uuid_simple());
    
    sections.insert(idx + 1, duplicated);
    Ok(())
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let since_the_epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:x}", since_the_epoch.subsec_nanos())
}
