use crate::style::DocumentModel;
use crate::style::inheritance::resolve_style;
use docx_rs::{Docx, Paragraph as DocxParagraph, Run as DocxRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell};

#[tauri::command]
pub fn export_document(doc: DocumentModel, format: String) -> Result<String, String> {
    match format.to_lowercase().as_str() {
        "json" => {
            serde_json::to_string_pretty(&doc)
                .map_err(|e| format!("Failed to serialize document JSON: {}", e))
        }
        "markdown" | "md" => {
            let mut md_out = String::new();
            for sec in &doc.sections {
                match sec.r#type.as_str() {
                    "heading" => {
                        let level = sec.content["attrs"]["level"].as_u64().unwrap_or(1);
                        let text = get_tiptap_text(&sec.content);
                        let hashes = "#".repeat(level as usize);
                        md_out.push_str(&format!("{} {}\n\n", hashes, text));
                    }
                    "divider" => {
                        md_out.push_str("---\n\n");
                    }
                    "list" => {
                        let is_ordered = sec.content["type"].as_str().unwrap_or("") == "orderedList";
                        if let Some(items) = sec.content["content"].as_array() {
                            for (idx, item) in items.iter().enumerate() {
                                let text = get_tiptap_text(item);
                                if is_ordered {
                                    md_out.push_str(&format!("{}. {}\n", idx + 1, text));
                                } else {
                                    md_out.push_str(&format!("* {}\n", text));
                                }
                            }
                        }
                        md_out.push_str("\n");
                    }
                    "table" => {
                        // Output simple markdown table representation
                        if let Some(rows) = sec.content["content"].as_array() {
                            for (r_idx, row) in rows.iter().enumerate() {
                                if let Some(cells) = row["content"].as_array() {
                                    let mut line = String::new();
                                    for cell in cells {
                                        let text = get_tiptap_text(cell);
                                        line.push_str(&format!("| {} ", text));
                                    }
                                    line.push_str("|\n");
                                    md_out.push_str(&line);
                                    
                                    // Header separator
                                    if r_idx == 0 {
                                        let mut sep = String::new();
                                        for _ in cells {
                                            sep.push_str("|---");
                                        }
                                        sep.push_str("|\n");
                                        md_out.push_str(&sep);
                                    }
                                }
                            }
                        }
                        md_out.push_str("\n");
                    }
                    _ => {
                        let text = get_tiptap_text(&sec.content);
                        md_out.push_str(&format!("{}\n\n", text));
                    }
                }
            }
            Ok(md_out)
        }
        "html" => {
            let mut html_out = String::new();
            html_out.push_str("<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<style>\n");
            html_out.push_str("body { padding: 40px; font-family: sans-serif; }\n");
            html_out.push_str("</style>\n</head>\n<body>\n");

            for sec in &doc.sections {
                let resolved = resolve_style(&sec.style_token, &doc.style_profile.tokens);
                let inline_style = build_inline_css(&resolved);
                let style_attr = if inline_style.is_empty() {
                    "".to_string()
                } else {
                    format!(" style=\"{}\"", inline_style)
                };

                match sec.r#type.as_str() {
                    "heading" => {
                        let level = sec.content["attrs"]["level"].as_u64().unwrap_or(1);
                        let text = get_tiptap_text(&sec.content);
                        html_out.push_str(&format!("<h{}{}>{}</h{}>\n", level, style_attr, text, level));
                    }
                    "divider" => {
                        html_out.push_str(&format!("<hr{}>\n", style_attr));
                    }
                    "list" => {
                        let tag = if sec.content["type"].as_str().unwrap_or("") == "orderedList" { "ol" } else { "ul" };
                        html_out.push_str(&format!("<{}{}>\n", tag, style_attr));
                        if let Some(items) = sec.content["content"].as_array() {
                            for item in items {
                                let text = get_tiptap_text(item);
                                html_out.push_str(&format!("  <li>{}</li>\n", text));
                            }
                        }
                        html_out.push_str(&format!("</{}>\n", tag));
                    }
                    "table" => {
                        html_out.push_str(&format!("<table{}>\n", style_attr));
                        if let Some(rows) = sec.content["content"].as_array() {
                            for row in rows {
                                html_out.push_str("  <tr>\n");
                                if let Some(cells) = row["content"].as_array() {
                                    for cell in cells {
                                        let text = get_tiptap_text(cell);
                                        let cell_tag = if cell["type"].as_str().unwrap_or("") == "tableHeader" { "th" } else { "td" };
                                        html_out.push_str(&format!("    <{cell_tag}>{}</{cell_tag}>\n", text));
                                    }
                                }
                                html_out.push_str("  </tr>\n");
                            }
                        }
                        html_out.push_str("</table>\n");
                    }
                    _ => {
                        let text = get_tiptap_text(&sec.content);
                        html_out.push_str(&format!("<p{}>{}</p>\n", style_attr, text));
                    }
                }
            }
            html_out.push_str("</body>\n</html>");
            Ok(html_out)
        }
        "docx" => {
            // Build real DOCX document structure
            let mut docx = Docx::new();
            
            for sec in &doc.sections {
                match sec.r#type.as_str() {
                    "heading" => {
                        let text = get_tiptap_text(&sec.content);
                        docx = docx.add_paragraph(DocxParagraph::new().add_run(DocxRun::new().add_text(text)));
                    }
                    "divider" => {
                        docx = docx.add_paragraph(DocxParagraph::new().add_run(DocxRun::new().add_text("---")));
                    }
                    "list" => {
                        if let Some(items) = sec.content["content"].as_array() {
                            for item in items {
                                let text = get_tiptap_text(item);
                                docx = docx.add_paragraph(DocxParagraph::new().add_run(DocxRun::new().add_text(format!("• {}", text))));
                            }
                        }
                    }
                    "table" => {
                        let mut docx_rows = Vec::new();
                        if let Some(rows) = sec.content["content"].as_array() {
                            for row in rows {
                                let mut docx_cells = Vec::new();
                                if let Some(cells) = row["content"].as_array() {
                                    for cell in cells {
                                        let text = get_tiptap_text(cell);
                                        docx_cells.push(DocxTableCell::new().add_paragraph(
                                            DocxParagraph::new().add_run(DocxRun::new().add_text(text))
                                        ));
                                    }
                                }
                                docx_rows.push(DocxTableRow::new(docx_cells));
                            }
                        }
                        let docx_table = DocxTable::new(docx_rows);
                        docx = docx.add_table(docx_table);
                    }
                    _ => {
                        let text = get_tiptap_text(&sec.content);
                        docx = docx.add_paragraph(DocxParagraph::new().add_run(DocxRun::new().add_text(text)));
                    }
                }
            }
            
            let mut docx_buffer = std::io::Cursor::new(Vec::new());
            docx.build().pack(&mut docx_buffer)
                .map_err(|e| format!("Failed to generate DOCX bytes: {}", e))?;
            let docx_bytes = docx_buffer.into_inner();
            
            // Encode to base64 so frontend can download/save it
            let base64_str = base64_encode(&docx_bytes);
            Ok(base64_str)
        }
        _ => Err("Unsupported export format".to_string()),
    }
}

fn build_inline_css(props: &crate::style::tokens::StyleProperties) -> String {
    let mut style = String::new();
    if let Some(ref family) = props.font_family {
        style.push_str(&format!("font-family: '{}', sans-serif; ", family));
    }
    if let Some(size) = props.font_size {
        style.push_str(&format!("font-size: {}pt; ", size));
    }
    if let Some(ref weight) = props.font_weight {
        let weight_str = match weight {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            _ => "normal".to_string(),
        };
        style.push_str(&format!("font-weight: {}; ", weight_str));
    }
    if let Some(ref italic) = props.font_style {
        style.push_str(&format!("font-style: {}; ", italic));
    }
    if let Some(ref decoration) = props.text_decoration {
        style.push_str(&format!("text-decoration: {}; ", decoration));
    }
    if let Some(ref color) = props.color {
        style.push_str(&format!("color: {}; ", color));
    }
    if let Some(lh) = props.line_height {
        style.push_str(&format!("line-height: {}; ", lh));
    }
    if let Some(ls) = props.letter_spacing {
        style.push_str(&format!("letter-spacing: {}pt; ", ls));
    }
    if let Some(mt) = props.margin_top {
        style.push_str(&format!("margin-top: {}pt; ", mt));
    }
    if let Some(mb) = props.margin_bottom {
        style.push_str(&format!("margin-bottom: {}pt; ", mb));
    }
    if let Some(ml) = props.margin_left {
        style.push_str(&format!("margin-left: {}pt; ", ml));
    }
    if let Some(mr) = props.margin_right {
        style.push_str(&format!("margin-right: {}pt; ", mr));
    }
    if let Some(ref align) = props.text_align {
        style.push_str(&format!("text-align: {}; ", align));
    }
    
    // Lists and Bullets
    if let Some(indent) = props.indent {
        style.push_str(&format!("padding-left: {}pt; ", indent));
    }
    
    // Divider
    if let Some(height) = props.height {
        style.push_str(&format!("border: none; border-top: {}pt ", height));
        if let Some(ref dst) = props.divider_style {
            style.push_str(&format!("{} ", dst));
        } else {
            style.push_str("solid ");
        }
        if let Some(ref col) = props.color {
            style.push_str(&format!("{}; ", col));
        } else {
            style.push_str("#000; ");
        }
    }
    
    // Table
    if let Some(border) = props.border_width {
        style.push_str(&format!("border: {}pt ", border));
        style.push_str("solid ");
        if let Some(ref col) = props.border_color {
            style.push_str(&format!("{}; ", col));
        } else {
            style.push_str("#cbd5e1; ");
        }
        style.push_str("border-collapse: collapse; ");
    }
    
    style.trim().to_string()
}

fn get_tiptap_text(val: &serde_json::Value) -> String {
    let mut text = String::new();
    extract_text(val, &mut text);
    text
}

fn extract_text(val: &serde_json::Value, text: &mut String) {
    if let Some(t) = val.get("text") {
        if let Some(s) = t.as_str() {
            text.push_str(s);
        }
    }
    if let Some(content_array) = val.get("content").and_then(|c| c.as_array()) {
        for child in content_array {
            extract_text(child, text);
        }
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    // Simple custom base64 encoder to avoid external crate dependency
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity(bytes.len() * 4 / 3 + 4);
    let mut buffer = 0u32;
    let mut bits = 0;

    for &byte in bytes {
        buffer = (buffer << 8) | byte as u32;
        bits += 8;
        while bits >= 6 {
            bits -= 6;
            let index = ((buffer >> bits) & 0x3F) as usize;
            result.push(CHARSET[index] as char);
        }
    }

    if bits > 0 {
        buffer <<= 6 - bits;
        let index = (buffer & 0x3F) as usize;
        result.push(CHARSET[index] as char);
    }

    while result.len() % 4 != 0 {
        result.push('=');
    }

    result
}
