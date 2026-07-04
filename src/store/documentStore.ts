import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { DocumentModel, StyleProfile, StyleProperties, Section, AIProviderConfig } from '../types';

interface DocumentState {
  currentDocument: DocumentModel | null;
  styleProfiles: StyleProfile[];
  aiProviders: AIProviderConfig[];
  selectedProviderId: string | null;
  activeSectionId: string | null;
  activeTokenKey: string | null;
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  historyStack: DocumentModel[];
  redoStack: DocumentModel[];
  
  // Actions
  setCurrentDocument: (doc: DocumentModel | null) => void;
  loadStyleProfiles: () => Promise<void>;
  loadAIProviders: () => Promise<void>;
  setSelectedProviderId: (id: string | null) => void;
  saveAIProvider: (provider: AIProviderConfig) => Promise<void>;
  setActiveSectionId: (id: string | null) => void;
  setActiveTokenKey: (key: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  
  // Mutations & Tauri Interactions
  importDocument: (path: string) => Promise<void>;
  importFromString: (content: string, format: string) => Promise<void>;
  updateStyleToken: (tokenKey: string, properties: Partial<StyleProperties>) => Promise<void>;
  updateSectionStyleProps: (sectionId: string, properties: Partial<StyleProperties>) => void;
  applyAIOperations: (userPrompt: string) => Promise<string>;
  reorderSections: (sections: Section[]) => void;
  updateSectionContent: (sectionId: string, content: any) => void;
  updateSectionStyleToken: (sectionId: string, styleToken: string) => void;
  deleteSection: (sectionId: string) => void;
  addSection: (sectionType: Section['type'], afterId?: string) => void;
  
  // History Actions
  undo: () => void;
  redo: () => void;
  pushToHistory: (doc: DocumentModel) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  currentDocument: null,
  styleProfiles: [],
  aiProviders: [],
  selectedProviderId: null,
  activeSectionId: null,
  activeTokenKey: null,
  isSidebarOpen: true,
  isSettingsOpen: false,
  historyStack: [],
  redoStack: [],

  setCurrentDocument: (doc) => {
    set({ currentDocument: doc, activeSectionId: null, activeTokenKey: null });
  },

  loadStyleProfiles: async () => {
    try {
      const profiles = await invoke<StyleProfile[]>('load_profiles');
      set({ styleProfiles: profiles });
    } catch (err) {
      console.error('Failed to load style profiles:', err);
    }
  },

  loadAIProviders: async () => {
    try {
      const providers = await invoke<AIProviderConfig[]>('load_ai_providers');
      set({ 
        aiProviders: providers, 
        selectedProviderId: providers.find(p => p.isDefault)?.id || providers[0]?.id || null 
      });
    } catch (err) {
      console.error('Failed to load AI providers:', err);
    }
  },

  setSelectedProviderId: (id) => set({ selectedProviderId: id }),

  saveAIProvider: async (provider) => {
    try {
      await invoke('save_ai_provider', { provider });
      await get().loadAIProviders();
    } catch (err) {
      console.error('Failed to save AI provider:', err);
    }
  },

  setActiveSectionId: (id) => {
    const doc = get().currentDocument;
    if (id && doc) {
      const section = doc.sections.find(s => s.id === id);
      if (section) {
        set({ activeSectionId: id, activeTokenKey: section.styleToken });
        return;
      }
    }
    set({ activeSectionId: id });
  },

  setActiveTokenKey: (key) => set({ activeTokenKey: key }),

  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

  importDocument: async (path) => {
    try {
      const doc = await invoke<DocumentModel>('import_document', { path });
      get().setCurrentDocument(doc);
      await get().loadStyleProfiles();
    } catch (err) {
      console.error('Failed to import document:', err);
      throw err;
    }
  },

  importFromString: async (content, format) => {
    try {
      const doc = await invoke<DocumentModel>('import_from_string', { content, format });
      get().setCurrentDocument(doc);
      await get().loadStyleProfiles();
    } catch (err) {
      console.error('Failed to import document string:', err);
      throw err;
    }
  },

  updateStyleToken: async (tokenKey, properties) => {
    const doc = get().currentDocument;
    if (!doc) return;

    get().pushToHistory(doc);

    const updatedProfile = {
      ...doc.styleProfile,
      tokens: {
        ...doc.styleProfile.tokens,
        [tokenKey]: {
          ...doc.styleProfile.tokens[tokenKey],
          ...properties
        }
      }
    };

    const updatedDoc = {
      ...doc,
      styleProfile: updatedProfile
    };

    set({ currentDocument: updatedDoc });

    // Save style profile to DB in background
    try {
      await invoke('save_profile', { profile: updatedProfile });
      await get().loadStyleProfiles();
    } catch (err) {
      console.error('Failed to save updated style profile:', err);
    }
  },

  // Edit style properties for a SPECIFIC section only.
  // If the section's token is shared with other sections, auto-clones it first
  // so the edit is isolated to just this section.
  updateSectionStyleProps: (sectionId, properties) => {
    const doc = get().currentDocument;
    if (!doc) return;

    const section = doc.sections.find(s => s.id === sectionId);
    if (!section) return;

    const currentTokenKey = section.styleToken;
    const usageCount = doc.sections.filter(s => s.styleToken === currentTokenKey).length;

    get().pushToHistory(doc);

    let tokenKey = currentTokenKey;
    let tokens = { ...doc.styleProfile.tokens };

    if (usageCount > 1) {
      // Token is shared — clone it so this section gets its own copy
      tokenKey = `${currentTokenKey}_${sectionId.replace(/[^a-z0-9]/gi, '_').slice(-8)}`;
      tokens[tokenKey] = { ...tokens[currentTokenKey] };
    }

    // Apply the property changes to the (possibly cloned) token
    tokens[tokenKey] = { ...tokens[tokenKey], ...properties };

    const updatedSections = doc.sections.map(s =>
      s.id === sectionId ? { ...s, styleToken: tokenKey } : s
    );

    const updatedDoc = {
      ...doc,
      styleProfile: { ...doc.styleProfile, tokens },
      sections: updatedSections,
    };

    set({
      currentDocument: updatedDoc,
      activeTokenKey: tokenKey,
    });
  },

  applyAIOperations: async (userPrompt) => {
    const doc = get().currentDocument;
    const providerId = get().selectedProviderId;
    if (!doc || !providerId) return '';

    get().pushToHistory(doc);

    try {
      const payload = await invoke<{ document: DocumentModel; assistantMessage: string }>('run_ai_operations', {
        doc,
        userPrompt,
        providerId
      });
      set({ currentDocument: payload.document });
      return payload.assistantMessage;
    } catch (err) {
      console.error('AI Operation failed:', err);
      throw err;
    }
  },

  reorderSections: (sections) => {
    const doc = get().currentDocument;
    if (!doc) return;
    get().pushToHistory(doc);
    set({ currentDocument: { ...doc, sections } });
  },

  updateSectionContent: (sectionId, content) => {
    const doc = get().currentDocument;
    if (!doc) return;
    // Debounced or direct updates should push history as appropriate.
    // For direct keystroke updates, we just update state without spamming history.
    const updatedSections = doc.sections.map(s => 
      s.id === sectionId ? { ...s, content } : s
    );
    set({ currentDocument: { ...doc, sections: updatedSections } });
  },

  updateSectionStyleToken: (sectionId, styleToken) => {
    const doc = get().currentDocument;
    if (!doc) return;
    get().pushToHistory(doc);
    const updatedSections = doc.sections.map(s => 
      s.id === sectionId ? { ...s, styleToken } : s
    );
    set({ 
      currentDocument: { ...doc, sections: updatedSections },
      // If the edited section is active, update the active token key to keep sidebars in sync!
      activeTokenKey: get().activeSectionId === sectionId ? styleToken : get().activeTokenKey
    });
  },

  deleteSection: (sectionId) => {
    const doc = get().currentDocument;
    if (!doc) return;
    get().pushToHistory(doc);
    const updatedSections = doc.sections.filter(s => s.id !== sectionId);
    set({ 
      currentDocument: { ...doc, sections: updatedSections },
      activeSectionId: null,
      activeTokenKey: null
    });
  },

  addSection: (sectionType, afterId) => {
    const doc = get().currentDocument;
    if (!doc) return;
    get().pushToHistory(doc);

    // Map default token key
    let styleToken = 'body';
    let defaultContent: any = { type: 'paragraph', content: [] };

    if (sectionType === 'heading') {
      styleToken = 'heading';
      defaultContent = { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'New Heading' }] };
    } else if (sectionType === 'divider') {
      styleToken = 'divider';
      defaultContent = { type: 'horizontalRule' };
    } else if (sectionType === 'list') {
      styleToken = 'bullet';
      defaultContent = { 
        type: 'bulletList', 
        content: [{ 
          type: 'listItem', 
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List Item' }] }] 
        }] 
      };
    } else if (sectionType === 'table') {
      styleToken = 'body';
      defaultContent = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 1' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col 2' }] }] }
            ]
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 1' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell 2' }] }] }
            ]
          }
        ]
      };
    }

    const newSec: Section = {
      id: `sec_local_${Date.now()}`,
      type: sectionType,
      styleToken,
      content: defaultContent
    };

    let updatedSections = [...doc.sections];
    if (afterId) {
      const idx = updatedSections.findIndex(s => s.id === afterId);
      if (idx !== -1) {
        updatedSections.splice(idx + 1, 0, newSec);
      } else {
        updatedSections.push(newSec);
      }
    } else {
      updatedSections.push(newSec);
    }

    set({ currentDocument: { ...doc, sections: updatedSections } });
  },

  undo: () => {
    const { historyStack, currentDocument, redoStack } = get();
    if (historyStack.length === 0 || !currentDocument) return;

    const previous = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, -1);

    set({
      currentDocument: previous,
      historyStack: newHistory,
      redoStack: [currentDocument, ...redoStack]
    });
  },

  redo: () => {
    const { redoStack, currentDocument, historyStack } = get();
    if (redoStack.length === 0 || !currentDocument) return;

    const next = redoStack[0];
    const newRedo = redoStack.slice(1);

    set({
      currentDocument: next,
      historyStack: [...historyStack, currentDocument],
      redoStack: newRedo
    });
  },

  pushToHistory: (doc) => {
    // Limit stack size to 50
    const history = get().historyStack;
    const truncatedHistory = history.length >= 50 ? history.slice(1) : history;
    set({
      historyStack: [...truncatedHistory, JSON.parse(JSON.stringify(doc))],
      redoStack: []
    });
  }
}));
