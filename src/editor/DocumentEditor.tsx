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
// Small visible gap so page boundaries read as separate sheets on screen.
const PAGE_GAP = 16;

export const DocumentEditor: React.FC = () => {
  const { currentDocument, activeSectionId, setActiveSectionId, addSection } = useDocumentStore();
  const [zoom, setZoom] = useState(1.0);
  // Heights of each section measured after each render. The map is keyed by
  // section id and the values are pixel heights of the SectionWrapper.
  const [heights, setHeights] = useState<Record<string, number>>({});

  const zoomIn = () => setZoom((z) => Math.min(z + 0.1, 1.5));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.6));
  const resetZoom = () => setZoom(1.0);

  // Ref callback used by SectionWrapper to publish its measured height to
  // the parent. A rAF coalesces multiple updates into a single setState.
  const sectionHeightRefs = useRef(new Map<string, HTMLDivElement>());
  const measureRaf = useRef<number | null>(null);
  const handleSectionMount = (id: string) => (el: HTMLDivElement | null) => {
    if (el) sectionHeightRefs.current.set(id, el);
    else sectionHeightRefs.current.delete(id);
    if (measureRaf.current != null) return;
    measureRaf.current = requestAnimationFrame(() => {
      measureRaf.current = null;
      const next: Record<string, number> = {};
      sectionHeightRefs.current.forEach((el, id) => {
        next[id] = el.getBoundingClientRect().height;
      });
      setHeights((prev) => {
        // Skip state update if nothing actually changed (prevents feedback loop)
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length === nextKeys.length) {
          let same = true;
          for (const k of nextKeys) {
            if (Math.abs((prev[k] || 0) - (next[k] || 0)) > 0.5) { same = false; break; }
          }
          if (same) return prev;
        }
        return next;
      });
    });
  };

  // Compute which sections fit on which page using a greedy algorithm.
  // Each page has A4_PAGE_HEIGHT pixels of usable space (minus top/bottom padding).
  const sections = currentDocument?.sections ?? [];
  const sectionIndexById = new Map(sections.map((s, i) => [s.id, i] as const));
  const usableHeight = A4_PAGE_HEIGHT - PAGE_PADDING * 2;
  const pages: Section[][] = [];
  {
    let current: Section[] = [];
    let used = 0;
    for (const sec of sections) {
      const h = heights[sec.id] ?? 0;
      // If a section doesn't fit on the current page, push it to the next page.
      // Always put at least one section on a page (so a single huge section
      // doesn't loop forever — it'll just overflow visually).
      if (current.length > 0 && used + h > usableHeight) {
        pages.push(current);
        current = [sec];
        used = h;
      } else {
        current.push(sec);
        used += h;
      }
    }
    if (current.length) pages.push(current);
  }
  if (pages.length === 0) pages.push([]);
  const numPages = pages.length;
  const totalPagesHeight = numPages * A4_PAGE_HEIGHT + (numPages - 1) * PAGE_GAP;

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
        {/* Outer zoom wrapper — its width/height match the stacked pages so
            the zoom transform doesn't crop content. */}
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
          {/* One A4 page per entry in `pages`. The container holds a fixed-size
              page background (white sheet with shadow) and a content layer that
              can extend beyond the sheet so tall sections render in full and
              the browser can paginate them in print. */}
          {pages.map((pageSections, pageIdx) => (
            <div
              key={pageIdx}
              className="absolute no-print-page-chrome"
              style={{
                top: pageIdx * (A4_PAGE_HEIGHT + PAGE_GAP),
                left: 0,
                width: A4_PAGE_WIDTH,
                padding: `${PAGE_PADDING}px`,
                minHeight: A4_PAGE_HEIGHT,
              }}
              onClick={() => setActiveSectionId(null)}
            >
              {/* A4 page background (fixed size, clipped to sheet shape) */}
              <div
                className="absolute inset-x-0 top-0 bg-white shadow-2xl rounded-sm border border-slate-200/80 pointer-events-none"
                style={{ height: A4_PAGE_HEIGHT }}
                aria-hidden
              />

              <div className="space-y-1">
                {pageSections.map((sec) => {
                  const idx = sectionIndexById.get(sec.id) ?? 0;
                  return (
                    <div key={sec.id} ref={handleSectionMount(sec.id)}>
                      <SectionWrapper
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
                    </div>
                  );
                })}
              </div>

              {/* Empty page state helper */}
              {pageSections.length === 0 && currentDocument.sections.length === 0 && (
                <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400">
                  <p className="text-sm font-medium">This document is empty.</p>
                  <p className="text-xs text-slate-500 mt-1">Hover over the page or use the AI to insert sections.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
