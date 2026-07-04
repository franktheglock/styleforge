import React, { useState, useEffect, useRef } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { SectionWrapper } from './SectionWrapper';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Section, StyleProperties } from '../types';
import { ZoomIn, ZoomOut, Maximize2, FileText, Type, AlignLeft, List, Minus, Table as TableIcon } from 'lucide-react';

// Inline style builder matching the style token system
export const resolveStyle = (tokenKey: string, tokens: Record<string, StyleProperties>): StyleProperties => {
  let resolved: StyleProperties = {};
  
  if (tokenKey.startsWith('heading')) {
    resolved = { ...tokens['heading'] };
  } else if (tokenKey.startsWith('bullet') || tokenKey.startsWith('list')) {
    resolved = { ...tokens['body'], ...tokens['bullet'] };
  } else {
    resolved = { ...tokens['body'] };
  }
  
  if (tokens[tokenKey]) {
    resolved = { ...resolved, ...tokens[tokenKey] };
  }
  
  return resolved;
};

export const buildStyleObject = (props: StyleProperties): React.CSSProperties => {
  const styles: React.CSSProperties = {};
  
  if (props.fontFamily) styles.fontFamily = props.fontFamily;
  if (props.fontSize) styles.fontSize = `${props.fontSize}pt`;
  
  if (props.fontWeight) {
    styles.fontWeight = props.fontWeight;
  }
  if (props.fontStyle) styles.fontStyle = props.fontStyle;
  if (props.textDecoration) styles.textDecoration = props.textDecoration;
  if (props.color) styles.color = props.color;
  if (props.lineHeight) styles.lineHeight = props.lineHeight;
  if (props.letterSpacing) styles.letterSpacing = `${props.letterSpacing}pt`;
  
  if (props.marginTop) styles.marginTop = `${props.marginTop}pt`;
  if (props.marginBottom) styles.marginBottom = `${props.marginBottom}pt`;
  if (props.marginLeft) styles.marginLeft = `${props.marginLeft}pt`;
  if (props.marginRight) styles.marginRight = `${props.marginRight}pt`;
  if (props.textAlign) styles.textAlign = props.textAlign;
  
  if (props.indent) styles.paddingLeft = `${props.indent}pt`;
  
  return styles;
};

// Section Editor wrapper for individual Tiptap instances
const SectionEditor: React.FC<{ section: Section; tokens: Record<string, StyleProperties> }> = ({
  section,
  tokens,
}) => {
  const updateSectionContent = useDocumentStore((state) => state.updateSectionContent);
  const resolved = resolveStyle(section.styleToken, tokens);
  const styleObj = buildStyleObject(resolved);
  // Guard against onUpdate/setContent ping-pong that can grow the doc.
  const syncingRef = React.useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable base styling of headings/lists inside editor to let our container drive style tokens
        heading: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: section.content,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[20px] w-full',
      },
    },
    onUpdate: ({ editor }) => {
      if (syncingRef.current) return;
      updateSectionContent(section.id, editor.getJSON());
    },
  });

  // Sync external changes (e.g., AI mutations)
  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(section.content)) return;
    syncingRef.current = true;
    try {
      editor.commands.setContent(section.content, { emitUpdate: false });
    } finally {
      // Release on next tick so the synchronous setContent side effects have settled
      setTimeout(() => { syncingRef.current = false; }, 0);
    }
  }, [section.content, editor]);

  // Apply custom styling for lists and dividers
  const listClass = section.type === 'list' && resolved.listStyleType ? `list-${resolved.listStyleType}` : '';

  return (
    <div style={{ ...styleObj, overflowWrap: 'break-word', wordBreak: 'break-word' }} className={`${listClass} text-inherit w-full max-w-full`}>
      {section.type === 'divider' ? (
        <hr
          style={{
            border: 'none',
            borderTop: `${resolved.height || 1}pt ${resolved.dividerStyle || 'solid'} ${resolved.color || '#cbd5e1'}`,
            marginTop: `${resolved.marginTop || 8}pt`,
            marginBottom: `${resolved.marginBottom || 8}pt`,
          }}
          className="w-full"
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
};

// Main Document Editor Workspace
const A4_PAGE_HEIGHT = 1122; // A4 at 96dpi (297mm)
const A4_PAGE_WIDTH = 794;   // A4 at 96dpi (210mm)
const PAGE_PADDING = 60;
const PAGE_GAP = 28;

export const DocumentEditor: React.FC = () => {
  const { currentDocument, activeSectionId, setActiveSectionId, addSection } = useDocumentStore();
  const [zoom, setZoom] = useState(1.0);
  const [numPages, setNumPages] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.1, 1.5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.6));
  const resetZoom = () => setZoom(1.0);

  // Measure content height and compute page count
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        setNumPages(Math.max(1, Math.ceil(h / A4_PAGE_HEIGHT)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentDocument]);

  if (!currentDocument) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 bg-[#0f172a]/20">
        <FileText size={48} className="text-slate-600 mb-4 animate-pulse" />
        <h2 className="text-xl font-semibold mb-2">No Document Open</h2>
        <p className="text-sm text-slate-500 max-w-sm text-center">
          Import an existing document (DOCX, Markdown, or HTML) or create one via the sidebar to get started.
        </p>
      </div>
    );
  }

  // Total height of all pages stacked with gaps
  const totalPagesHeight = numPages * A4_PAGE_HEIGHT + (numPages - 1) * PAGE_GAP;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-hidden select-none">
      {/* Top toolbar */}
      <div className="h-12 border-b border-slate-800 bg-[#0f172a]/60 px-6 flex items-center justify-between select-none no-print">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200 truncate max-w-[250px]">
            {currentDocument.title}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
            {currentDocument.styleProfile.name}
          </span>

          {/* Add Section — one-click inline buttons */}
          <div className="ml-2 flex items-center gap-1 border-l border-slate-800 pl-3">
            {[
              { type: 'heading' as const, label: 'Heading', icon: Type },
              { type: 'paragraph' as const, label: 'Paragraph', icon: AlignLeft },
              { type: 'list' as const, label: 'List', icon: List },
              { type: 'divider' as const, label: 'Divider', icon: Minus },
              { type: 'table' as const, label: 'Table', icon: TableIcon },
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => addSection(type)}
                title={`Add ${label}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 transition-colors"
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button title="Zoom Out" onClick={zoomOut} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <ZoomOut size={16} />
          </button>
          <span
            onClick={resetZoom}
            className="text-xs font-mono text-slate-400 w-12 text-center cursor-pointer hover:text-indigo-400 select-none"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button title="Zoom In" onClick={zoomIn} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <ZoomIn size={16} />
          </button>
          <button title="Reset Zoom" onClick={resetZoom} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors border border-slate-800">
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      {/* Editor viewport wrapper */}
      <div className="flex-1 overflow-y-auto py-10 flex justify-center bg-[#070b13]" onDragOver={(e) => e.preventDefault()}>
        {/* Outer zoom wrapper */}
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: A4_PAGE_WIDTH,
            height: totalPagesHeight + 80,
            position: 'relative',
            flexShrink: 0,
          }}
          className="select-text"
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Stacked A4 page backgrounds */}
          {Array.from({ length: numPages }, (_, i) => (
            <div
              key={i}
              className="absolute bg-white shadow-2xl rounded-sm border border-slate-200/80 no-print-page-chrome"
              style={{
                top: i * (A4_PAGE_HEIGHT + PAGE_GAP),
                left: 0,
                width: A4_PAGE_WIDTH,
                height: A4_PAGE_HEIGHT,
                zIndex: 0,
              }}
            />
          ))}

          {/* Page number labels between pages */}
          {numPages > 1 && Array.from({ length: numPages - 1 }, (_, i) => (
            <div
              key={`break-${i}`}
              className="absolute flex items-center justify-center no-print"
              style={{
                top: (i + 1) * A4_PAGE_HEIGHT + i * PAGE_GAP,
                left: 0,
                width: A4_PAGE_WIDTH,
                height: PAGE_GAP,
                zIndex: 2,
              }}
            >
              <span className="text-[9px] font-mono text-slate-500 bg-[#070b13] px-2 py-0.5 rounded">
                Page {i + 2}
              </span>
            </div>
          ))}

          {/* Content flow — sits on top of page backgrounds */}
          <div
            ref={contentRef}
            className="absolute left-0 right-0"
            style={{
              top: 0,
              zIndex: 1,
              padding: `${PAGE_PADDING}px`,
              minHeight: A4_PAGE_HEIGHT,
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => setActiveSectionId(null)}
          >
            <div className="space-y-1">
              {currentDocument.sections.map((sec, idx) => (
                <SectionWrapper
                  key={sec.id}
                  section={sec}
                  index={idx}
                  isActive={activeSectionId === sec.id}
                  onSelect={() => setActiveSectionId(sec.id)}
                >
                  <SectionEditor
                    section={sec}
                    tokens={currentDocument.styleProfile.tokens}
                  />
                </SectionWrapper>
              ))}
            </div>

            {/* Empty page state helper */}
            {currentDocument.sections.length === 0 && (
              <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400">
                <p className="text-sm font-medium">This document is empty.</p>
                <p className="text-xs text-slate-500 mt-1">Hover over the page or use the AI to insert sections.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
