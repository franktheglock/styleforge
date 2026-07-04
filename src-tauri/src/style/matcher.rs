use super::tokens::StyleProperties;

/// Checks if two style property sets are visually similar enough to be grouped
/// under the same style token.
pub fn are_similar(a: &StyleProperties, b: &StyleProperties) -> bool {
    // 1. Font family check (must be same if both specified)
    if let (Some(fa), Some(fb)) = (&a.font_family, &b.font_family) {
        if fa.to_lowercase().trim() != fb.to_lowercase().trim() {
            return false;
        }
    }
    
    // 2. Font size check (within 1.2pt tolerance)
    if let (Some(sa), Some(sb)) = (a.font_size, b.font_size) {
        if (sa - sb).abs() > 1.2 {
            return false;
        }
    }
    
    // 3. Weight grouping (bold vs normal)
    let weight_a = get_weight_group(a.font_weight.as_ref());
    let weight_b = get_weight_group(b.font_weight.as_ref());
    if weight_a != weight_b {
        return false;
    }
    
    // 4. Color check (strict match if specified, ignore alpha)
    if let (Some(ca), Some(cb)) = (&a.color, &b.color) {
        if ca.to_lowercase().trim() != cb.to_lowercase().trim() {
            return false;
        }
    }

    // 5. Text decoration (e.g. underline must match)
    if a.text_decoration != b.text_decoration {
        return false;
    }

    // 6. Font style (e.g. italic must match)
    if a.font_style != b.font_style {
        return false;
    }

    true
}

fn get_weight_group(val: Option<&serde_json::Value>) -> &str {
    match val {
        Some(serde_json::Value::Number(n)) => {
            if n.as_u64().unwrap_or(400) >= 600 {
                "bold"
            } else {
                "normal"
            }
        }
        Some(serde_json::Value::String(s)) => {
            let lower = s.to_lowercase();
            if lower.contains("bold") || lower.contains("medium") || lower.contains("semibold") || lower == "700" || lower == "600" {
                "bold"
            } else {
                "normal"
            }
        }
        _ => "normal",
    }
}
