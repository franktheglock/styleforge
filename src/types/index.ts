export type SectionType = 'heading' | 'paragraph' | 'list' | 'table' | 'divider';

export interface StyleProperties {
  fontFamily?: string;
  fontSize?: number; // in pt
  fontWeight?: string | number; // e.g. 400, 700, 'bold'
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  color?: string; // Hex color e.g., "#000000"
  lineHeight?: number; // multiplier e.g., 1.35
  letterSpacing?: number; // pt or em
  marginTop?: number; // pt
  marginBottom?: number; // pt
  marginLeft?: number; // pt
  marginRight?: number; // pt
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  
  // Bullet/List Specific
  indent?: number; // pt
  listStyleType?: 'disc' | 'circle' | 'square' | 'decimal' | 'none';
  
  // Divider Specific
  height?: number; // pt
  dividerStyle?: 'solid' | 'dashed' | 'dotted';
  
  // Table Specific
  borderWidth?: number; // pt
  borderColor?: string;
  cellPadding?: number; // pt
}

export interface StyleProfile {
  id: string;
  name: string;
  tokens: Record<string, StyleProperties>; // maps styleToken keys (e.g. 'heading', 'body', 'bullet', 'divider') to properties
  isPreset?: boolean;
}

export interface Section {
  id: string;
  type: SectionType;
  styleToken: string; // References keys in StyleProfile.tokens
  content: any; // Tiptap JSON node contents
}

export interface DocumentMetadata {
  createdAt: string;
  updatedAt: string;
  author?: string;
  description?: string;
}

export interface DocumentModel {
  id: string;
  title: string;
  styleProfileId: string;
  styleProfile: StyleProfile;
  sections: Section[];
  metadata: DocumentMetadata;
}

// AI Configuration Types
export type AIProviderType = 'Ollama' | 'LMStudio' | 'LlamaCpp' | 'OpenRouter' | 'NvidiaNim' | 'Custom';

export interface AIProviderConfig {
  id: string;
  name: string;
  providerType: AIProviderType;
  endpoint: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  isDefault: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AICommandOperation {
  operation: 'insertSection' | 'moveSection' | 'deleteSection' | 'duplicateSection' | 'renameSection' | 'generatePlaceholderContent' | 'suggestSectionOrder';
  targetId?: string; // ID of section to delete, move, duplicate
  afterId?: string; // ID of section to insert after
  sectionType?: SectionType;
  title?: string;
  content?: string;
  index?: number;
}
