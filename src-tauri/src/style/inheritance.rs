use std::collections::HashMap;
use super::tokens::StyleProperties;

pub fn resolve_style(
    token_name: &str,
    tokens: &HashMap<String, StyleProperties>,
) -> StyleProperties {
    let mut resolved = StyleProperties::default();
    
    // 1. Apply base styles depending on the class of token
    if token_name.starts_with("heading") {
        if let Some(base) = tokens.get("heading") {
            resolved = base.clone();
        }
    } else if token_name.starts_with("bullet") || token_name.starts_with("list") {
        if let Some(base) = tokens.get("body") {
            resolved = base.clone();
        }
        if let Some(bullet_base) = tokens.get("bullet") {
            merge_properties(&mut resolved, bullet_base);
        }
    } else {
        if let Some(base) = tokens.get("body") {
            resolved = base.clone();
        }
    }

    // 2. Override with the specific token's own properties
    if let Some(specific) = tokens.get(token_name) {
        merge_properties(&mut resolved, specific);
    }

    resolved
}

pub fn merge_properties(base: &mut StyleProperties, overlay: &StyleProperties) {
    if overlay.font_family.is_some() { base.font_family = overlay.font_family.clone(); }
    if overlay.font_size.is_some() { base.font_size = overlay.font_size; }
    if overlay.font_weight.is_some() { base.font_weight = overlay.font_weight.clone(); }
    if overlay.font_style.is_some() { base.font_style = overlay.font_style.clone(); }
    if overlay.text_decoration.is_some() { base.text_decoration = overlay.text_decoration.clone(); }
    if overlay.color.is_some() { base.color = overlay.color.clone(); }
    if overlay.line_height.is_some() { base.line_height = overlay.line_height; }
    if overlay.letter_spacing.is_some() { base.letter_spacing = overlay.letter_spacing; }
    if overlay.margin_top.is_some() { base.margin_top = overlay.margin_top; }
    if overlay.margin_bottom.is_some() { base.margin_bottom = overlay.margin_bottom; }
    if overlay.margin_left.is_some() { base.margin_left = overlay.margin_left; }
    if overlay.margin_right.is_some() { base.margin_right = overlay.margin_right; }
    if overlay.text_align.is_some() { base.text_align = overlay.text_align.clone(); }
    if overlay.indent.is_some() { base.indent = overlay.indent; }
    if overlay.list_style_type.is_some() { base.list_style_type = overlay.list_style_type.clone(); }
    if overlay.height.is_some() { base.height = overlay.height; }
    if overlay.divider_style.is_some() { base.divider_style = overlay.divider_style.clone(); }
    if overlay.border_width.is_some() { base.border_width = overlay.border_width; }
    if overlay.border_color.is_some() { base.border_color = overlay.border_color.clone(); }
    if overlay.cell_padding.is_some() { base.cell_padding = overlay.cell_padding; }
}
