use crate::style::{DocumentModel, extractor::extract_from_html};
use pulldown_cmark::{Parser as MdParser, Options as MdOptions, html};
use std::fs;
use std::io::Read;

#[tauri::command]
pub fn import_document(path: String) -> Result<DocumentModel, String> {
    let file_content = fs::read(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let extension = std::path::Path::new(&path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        "md" | "markdown" => {
            let markdown_str = String::from_utf8(file_content)
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;
            import_markdown(markdown_str)
        }
        "html" | "htm" => {
            let html_str = String::from_utf8(file_content)
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;
            import_html(html_str)
        }
        "docx" => {
            import_docx(&file_content)
        }
        _ => Err("Unsupported document format. Please choose DOCX, Markdown, or HTML.".to_string()),
    }
}

#[tauri::command]
pub fn import_from_string(content: String, format: String) -> Result<DocumentModel, String> {
    match format.to_lowercase().as_str() {
        "md" | "markdown" => import_markdown(content),
        "html" | "htm" => import_html(content),
        _ => Err("Unsupported document format".to_string()),
    }
}

fn import_markdown(md_content: String) -> Result<DocumentModel, String> {
    let mut options = MdOptions::empty();
    options.insert(MdOptions::ENABLE_TABLES);
    let parser = MdParser::new_ext(&md_content, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    
    import_html(html_output)
}

fn import_html(html_content: String) -> Result<DocumentModel, String> {
    let (profile, sections) = extract_from_html(&html_content);
    
    // Save style profile to DB
    let _ = crate::style::profiles::save_profile_to_db(&profile);

    let doc = DocumentModel {
        id: format!("doc_{}", uuid_simple()),
        title: "Untitled Document".to_string(),
        style_profile_id: profile.id.clone(),
        style_profile: profile,
        sections,
        metadata: crate::style::DocumentMetadata {
            created_at: chrono_now(),
            updated_at: chrono_now(),
            author: None,
            description: None,
        },
    };
    Ok(doc)
}

fn import_docx(bytes: &[u8]) -> Result<DocumentModel, String> {
    let reader = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read DOCX zip archive: {}", e))?;
    
    let mut document_xml = String::new();
    let mut file = archive.by_name("word/document.xml")
        .map_err(|e| format!("Invalid DOCX document structure (missing document.xml): {}", e))?;
    file.read_to_string(&mut document_xml)
        .map_err(|e| format!("Failed to read word/document.xml: {}", e))?;
    
    let html_content = parse_docx_xml_to_html(&document_xml)?;
    import_html(html_content)
}

fn parse_docx_xml_to_html(xml: &str) -> Result<String, String> {
    let mut html_out = String::new();
    let document = scraper::Html::parse_fragment(xml);
    
    let w_p_selector = scraper::Selector::parse("w\\:p").unwrap();
    let w_r_selector = scraper::Selector::parse("w\\:r").unwrap();
    let w_t_selector = scraper::Selector::parse("w\\:t").unwrap();
    let w_pstyle_selector = scraper::Selector::parse("w\\:pStyle").unwrap();
    let w_jc_selector = scraper::Selector::parse("w\\:jc").unwrap(); // Alignment
    let w_sz_selector = scraper::Selector::parse("w\\:sz").unwrap(); // Size
    let w_color_selector = scraper::Selector::parse("w\\:color").unwrap(); // Color

    for p_el in document.select(&w_p_selector) {
        let mut is_heading = false;
        let mut heading_level = 1;
        let mut align = "left";
        
        if let Some(pstyle) = p_el.select(&w_pstyle_selector).next() {
            if let Some(val) = pstyle.value().attr("w:val") {
                if val.contains("Heading") {
                    is_heading = true;
                    if let Some(c) = val.chars().last() {
                        if let Some(digit) = c.to_digit(10) {
                            heading_level = digit;
                        }
                    }
                }
            }
        }
        
        if let Some(jc) = p_el.select(&w_jc_selector).next() {
            if let Some(val) = jc.value().attr("w:val") {
                align = val;
            }
        }

        let mut p_text = String::new();
        
        for r_el in p_el.select(&w_r_selector) {
            let is_bold = r_el.select(&scraper::Selector::parse("w\\:b").unwrap()).next().is_some();
            let is_italic = r_el.select(&scraper::Selector::parse("w\\:i").unwrap()).next().is_some();
            let mut color = "";
            let mut size_pt = 0.0;
            
            if let Some(color_el) = r_el.select(&w_color_selector).next() {
                if let Some(val) = color_el.value().attr("w:val") {
                    color = val;
                }
            }
            if let Some(sz_el) = r_el.select(&w_sz_selector).next() {
                if let Some(val) = sz_el.value().attr("w:val") {
                    if let Ok(half_pt) = val.parse::<f64>() {
                        size_pt = half_pt / 2.0;
                    }
                }
            }

            let mut run_text = String::new();
            for t_el in r_el.select(&w_t_selector) {
                run_text.push_str(&t_el.inner_html());
            }
            
            if !run_text.is_empty() {
                let mut style_str = String::new();
                if !color.is_empty() {
                    style_str.push_str(&format!("color: #{}; ", color));
                }
                if size_pt > 0.0 {
                    style_str.push_str(&format!("font-size: {}pt; ", size_pt));
                }
                
                let mut run_html = run_text;
                if is_bold { run_html = format!("<strong>{}</strong>", run_html); }
                if is_italic { run_html = format!("<em>{}</em>", run_html); }
                if !style_str.is_empty() {
                    run_html = format!("<span style=\"{}\">{}</span>", style_str.trim(), run_html);
                }
                p_text.push_str(&run_html);
            }
        }

        if !p_text.is_empty() {
            let mut style_str = String::new();
            if align != "left" {
                style_str.push_str(&format!("text-align: {}; ", align));
            }
            
            let style_attr = if !style_str.is_empty() {
                format!(" style=\"{}\"", style_str.trim())
            } else {
                "".to_string()
            };

            if is_heading {
                html_out.push_str(&format!("<h{heading_level}{style_attr}>{p_text}</h{heading_level}>\n"));
            } else {
                html_out.push_str(&format!("<p{style_attr}>{p_text}</p>\n"));
            }
        }
    }
    
    Ok(html_out)
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let since_the_epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:x}", since_the_epoch.subsec_nanos())
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let since_the_epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:?}", since_the_epoch)
}
