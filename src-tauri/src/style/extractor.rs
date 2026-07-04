use super::tokens::{StyleProperties, StyleProfile};
use super::matcher::are_similar;
use super::Section;
use scraper::{Html, Selector, ElementRef};
use std::collections::HashMap;

/// Extracts a StyleProfile and structure from an HTML string (which might be converted Markdown).
pub fn extract_from_html(html_content: &str) -> (StyleProfile, Vec<Section>) {
    let document = Html::parse_fragment(html_content);
    let mut sections = Vec::new();
    
    // We will cluster extracted inline styles into tokens
    let mut token_counter = 0;
    let mut style_tokens: HashMap<String, StyleProperties> = HashMap::new();
    
    // A mapping from raw extracted style to style_token key
    let mut style_cache: Vec<(StyleProperties, String)> = Vec::new();

    // Select all top-level blocks: h1, h2, h3, h4, h5, h6, p, ul, ol, hr, table
    // We parse them in order.
    let root_selector = Selector::parse("h1, h2, h3, h4, h5, h6, p, ul, ol, hr, table").unwrap();
    
    for (i, element) in document.select(&root_selector).enumerate() {
        let tag = element.value().name();
        let id = format!("sec_{}_{}", tag, i);
        
        let inline_style = element.value().attr("style").unwrap_or("");
        let mut extracted_props = parse_style_attribute(inline_style);
        
        // Apply tags default if properties are empty
        apply_tag_defaults(tag, &mut extracted_props);
        
        // Find if we have a similar token already cached
        let mut style_token_key = String::new();
        for (cached_props, key) in &style_cache {
            if are_similar(cached_props, &extracted_props) {
                style_token_key = key.clone();
                break;
            }
        }
        
        if style_token_key.is_empty() {
            // Create a new token key
            token_counter += 1;
            style_token_key = format!("{}_style_{}", tag, token_counter);
            style_tokens.insert(style_token_key.clone(), extracted_props.clone());
            style_cache.push((extracted_props, style_token_key.clone()));
        }
        
        // Map elements into Sections
        let section_type = match tag {
            "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => "heading",
            "hr" => "divider",
            "table" => "table",
            "ul" | "ol" => "list",
            _ => "paragraph",
        };
        
        let content = build_section_content(tag, element);
        
        sections.push(Section {
            id,
            r#type: section_type.to_string(),
            style_token: style_token_key,
            content,
        });
    }

    // If no styles extracted, seed with standard defaults
    if style_tokens.is_empty() {
        let default_body = StyleProperties {
            font_family: Some("Inter".to_string()),
            font_size: Some(11.0),
            color: Some("#1e293b".to_string()),
            ..Default::default()
        };
        style_tokens.insert("body".to_string(), default_body);
    }
    
    let profile = StyleProfile {
        id: format!("extracted_{}", uuid_simple()),
        name: "Extracted Document Profile".to_string(),
        tokens: style_tokens,
        is_preset: Some(false),
    };
    
    (profile, sections)
}

fn apply_tag_defaults(tag: &str, props: &mut StyleProperties) {
    if props.font_family.is_none() {
        props.font_family = Some("Inter".to_string());
    }
    if props.color.is_none() {
        props.color = Some("#1e293b".to_string());
    }
    
    match tag {
        "h1" => {
            if props.font_size.is_none() { props.font_size = Some(24.0); }
            if props.font_weight.is_none() { props.font_weight = Some(serde_json::json!("bold")); }
            if props.margin_top.is_none() { props.margin_top = Some(24.0); }
            if props.margin_bottom.is_none() { props.margin_bottom = Some(12.0); }
        }
        "h2" => {
            if props.font_size.is_none() { props.font_size = Some(18.0); }
            if props.font_weight.is_none() { props.font_weight = Some(serde_json::json!("bold")); }
            if props.margin_top.is_none() { props.margin_top = Some(20.0); }
            if props.margin_bottom.is_none() { props.margin_bottom = Some(10.0); }
        }
        "h3" => {
            if props.font_size.is_none() { props.font_size = Some(14.0); }
            if props.font_weight.is_none() { props.font_weight = Some(serde_json::json!("bold")); }
            if props.margin_top.is_none() { props.margin_top = Some(16.0); }
            if props.margin_bottom.is_none() { props.margin_bottom = Some(8.0); }
        }
        "hr" => {
            if props.height.is_none() { props.height = Some(1.0); }
            if props.divider_style.is_none() { props.divider_style = Some("solid".to_string()); }
            if props.color.is_none() { props.color = Some("#cbd5e1".to_string()); }
        }
        "ul" | "ol" => {
            if props.font_size.is_none() { props.font_size = Some(11.0); }
            if props.indent.is_none() { props.indent = Some(18.0); }
            if props.list_style_type.is_none() {
                props.list_style_type = Some(if tag == "ol" { "decimal".to_string() } else { "disc".to_string() });
            }
        }
        _ => {
            if props.font_size.is_none() { props.font_size = Some(11.0); }
            if props.margin_top.is_none() { props.margin_top = Some(6.0); }
            if props.margin_bottom.is_none() { props.margin_bottom = Some(6.0); }
        }
    }
}

fn parse_style_attribute(style_str: &str) -> StyleProperties {
    let mut props = StyleProperties::default();
    for declaration in style_str.split(';') {
        let parts: Vec<&str> = declaration.split(':').collect();
        if parts.len() == 2 {
            let key = parts[0].trim().to_lowercase();
            let val = parts[1].trim().to_lowercase();
            match key.as_str() {
                "font-family" => {
                    props.font_family = Some(val.replace('\'', "").replace('"', "").trim().to_string());
                }
                "font-size" => {
                    if let Some(num) = extract_numeric(&val) {
                        props.font_size = Some(num);
                    }
                }
                "font-weight" => {
                    if val == "bold" || val == "700" || val == "600" || val == "800" {
                        props.font_weight = Some(serde_json::json!("bold"));
                    } else if val == "normal" || val == "400" {
                        props.font_weight = Some(serde_json::json!("normal"));
                    } else if let Ok(weight_num) = val.parse::<i32>() {
                        props.font_weight = Some(serde_json::json!(weight_num));
                    }
                }
                "font-style" => {
                    if val == "italic" {
                        props.font_style = Some("italic".to_string());
                    } else {
                        props.font_style = Some("normal".to_string());
                    }
                }
                "text-decoration" => {
                    if val.contains("underline") {
                        props.text_decoration = Some("underline".to_string());
                    } else {
                        props.text_decoration = Some("none".to_string());
                    }
                }
                "color" => {
                    props.color = Some(val.to_string());
                }
                "line-height" => {
                    if let Ok(lh) = val.parse::<f64>() {
                        props.line_height = Some(lh);
                    } else if let Some(lh) = extract_numeric(&val) {
                        props.line_height = Some(lh / 12.0); // estimate from pixels/points
                    }
                }
                "text-align" => {
                    if val == "center" || val == "right" || val == "justify" || val == "left" {
                        props.text_align = Some(val);
                    }
                }
                "margin-top" => {
                    if let Some(num) = extract_numeric(&val) { props.margin_top = Some(num); }
                }
                "margin-bottom" => {
                    if let Some(num) = extract_numeric(&val) { props.margin_bottom = Some(num); }
                }
                "margin-left" => {
                    if let Some(num) = extract_numeric(&val) { props.margin_left = Some(num); }
                }
                "margin-right" => {
                    if let Some(num) = extract_numeric(&val) { props.margin_right = Some(num); }
                }
                "padding-top" | "padding-bottom" | "padding-left" | "padding-right" => {
                    // map to cell padding for tables or keep as is
                    if key == "padding-top" || key == "padding-bottom" {
                        if let Some(num) = extract_numeric(&val) { props.cell_padding = Some(num); }
                    }
                }
                "border-width" => {
                    if let Some(num) = extract_numeric(&val) { props.border_width = Some(num); }
                }
                "border-color" => {
                    props.border_color = Some(val);
                }
                _ => {}
            }
        }
    }
    props
}

fn extract_numeric(val: &str) -> Option<f64> {
    let num_part: String = val.chars().filter(|c| c.is_digit(10) || *c == '.').collect();
    num_part.parse::<f64>().ok()
}

fn build_section_content(tag: &str, element: ElementRef) -> serde_json::Value {
    // Map the scraper Element into a Tiptap Node JSON format
    let text_content = element.inner_html();
    
    match tag {
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
            let level = tag.chars().last().unwrap().to_digit(10).unwrap_or(1);
            serde_json::json!({
                "type": "heading",
                "attrs": { "level": level },
                "content": [{ "type": "text", "text": strip_html_tags(&text_content) }]
            })
        }
        "hr" => {
            serde_json::json!({
                "type": "horizontalRule"
            })
        }
        "table" => {
            // Build simple Tiptap table structure
            let mut rows = Vec::new();
            let tr_selector = Selector::parse("tr").unwrap();
            let td_selector = Selector::parse("td, th").unwrap();
            
            for tr in element.select(&tr_selector) {
                let mut cells = Vec::new();
                for td in tr.select(&td_selector) {
                    let cell_tag = td.value().name();
                    let cell_type = if cell_tag == "th" { "tableHeader" } else { "tableCell" };
                    cells.push(serde_json::json!({
                        "type": cell_type,
                        "content": [{
                            "type": "paragraph",
                            "content": [{ "type": "text", "text": strip_html_tags(&td.inner_html()) }]
                        }]
                    }));
                }
                rows.push(serde_json::json!({
                    "type": "tableRow",
                    "content": cells
                }));
            }
            
            serde_json::json!({
                "type": "table",
                "content": rows
            })
        }
        "ul" | "ol" => {
            let list_type = if tag == "ol" { "orderedList" } else { "bulletList" };
            let mut items = Vec::new();
            let li_selector = Selector::parse("li").unwrap();
            
            for li in element.select(&li_selector) {
                items.push(serde_json::json!({
                    "type": "listItem",
                    "content": [{
                        "type": "paragraph",
                        "content": [{ "type": "text", "text": strip_html_tags(&li.inner_html()) }]
                    }]
                }));
            }
            
            serde_json::json!({
                "type": list_type,
                "content": items
            })
        }
        _ => {
            serde_json::json!({
                "type": "paragraph",
                "content": [{ "type": "text", "text": strip_html_tags(&text_content) }]
            })
        }
    }
}

fn strip_html_tags(html: &str) -> String {
    // Simple helper to remove HTML tags from inner html for raw text values
    let mut stripped = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            stripped.push(c);
        }
    }
    // decode standard entities
    stripped.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").trim().to_string()
}

fn uuid_simple() -> String {
    // Basic local random id generator for presets
    let rand_val: u32 = rand_val();
    format!("{:x}", rand_val)
}

fn rand_val() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    since_the_epoch.subsec_nanos()
}

// Extra helper values for default style initialization
impl StyleProperties {
    pub fn values() -> Self {
        Self::default()
    }
}
