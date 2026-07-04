import React, { useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { Section } from '../types';
import { Trash2, Copy, GripVertical, Plus } from 'lucide-react';
import { startDrag, getDragPayload, clearDragPayload } from './dragState';

interface SectionWrapperProps {
  section: Section;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  section,
  index,
  isActive,
  onSelect,
  children,
}) => {
  const { 
    currentDocument, 
    reorderSections, 
    deleteSection, 
    addSection,
    pushToHistory,
    updateSectionStyleToken
  } = useDocumentStore();
  
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // ─── Grip handle drag (section reorder) ───────────────────────────────────
  const handleGripDragStart = (e: React.DragEvent) => {
    const payload = `reorder:${index}`;
    console.log('[SECTION] grip dragstart', { index, payload });
    // Set payload immediately (no re-renders yet)
    startDrag(payload); // deferred RAF inside — drag starts cleanly
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', payload); } catch (_) {}
    // Defer local state too so no re-render happens during dragstart
    setTimeout(() => setIsDragging(true), 0);
  };

  const handleGripDragEnd = () => {
    clearDragPayload();
    setIsDragging(false);
    setIsDragOver(false);
  };

  // ─── Drop zone ────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      console.log('[SECTION] dragover', { sectionId: section.id, target: (e.target as HTMLElement)?.className });
    }
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      console.log('[SECTION] dragleave', { sectionId: section.id });
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[SECTION] drop', { sectionId: section.id, target: (e.target as HTMLElement)?.className });
    setIsDragOver(false);
    if (!currentDocument) {
      console.warn('[SECTION] drop - no currentDocument');
      return;
    }

    // Use module-level payload first (most reliable in WebView2)
    const payload = getDragPayload() || e.dataTransfer.getData('text/plain') || '';
    console.log('[SECTION] drop payload', { payload });
    clearDragPayload();

    if (payload.startsWith('token:')) {
      const tokenKey = payload.slice('token:'.length);
      console.log('[SECTION] applying token', { sectionId: section.id, tokenKey });
      updateSectionStyleToken(section.id, tokenKey);
    } else if (payload.startsWith('reorder:')) {
      const dragIndex = parseInt(payload.slice('reorder:'.length), 10);
      if (!isNaN(dragIndex) && dragIndex !== index) {
        console.log('[SECTION] reordering', { from: dragIndex, to: index });
        const newSections = [...currentDocument.sections];
        const [draggedItem] = newSections.splice(dragIndex, 1);
        newSections.splice(index, 0, draggedItem);
        reorderSections(newSections);
      }
    } else {
      console.log('[SECTION] drop - unhandled payload');
    }
    setIsDragging(false);
  };

  // ─── Other handlers ───────────────────────────────────────────────────────
  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentDocument) return;
    pushToHistory(currentDocument);
    const newSections = [...currentDocument.sections];
    const dup = { ...section, id: `sec_local_dup_${Date.now()}` };
    newSections.splice(index + 1, 0, dup);
    reorderSections(newSections);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSection(section.id);
  };

  const handleAddAbove = (e: React.MouseEvent, type: Section['type']) => {
    e.stopPropagation();
    if (index === 0) {
      addSection(type);
    } else {
      const prevId = currentDocument?.sections[index - 1].id;
      addSection(type, prevId);
    }
  };

  const handleAddBelow = (e: React.MouseEvent, type: Section['type']) => {
    e.stopPropagation();
    addSection(type, section.id);
  };

  return (
    <div
      data-section-root="true"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group relative my-2 px-10 py-6 transition-all duration-200 rounded-lg cursor-pointer
        ${isActive ? 'bg-slate-900/50 shadow-md ring-2 ring-indigo-500/50' : 'hover:bg-slate-950/30'}
        ${isDragging ? 'opacity-40 border-2 border-dashed border-indigo-400' : ''}
        ${isDragOver ? 'border-2 border-dashed border-orange-500 bg-orange-500/5' : 'border-2 border-transparent'}
      `}
    >
      {/* Side Action panel */}
      <div className={`absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 p-1 rounded-md bg-slate-950 border border-slate-800 shadow-lg transition-opacity duration-200 no-print z-10
        ${isHovered || isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}>
        {/* Grip handle — itself draggable; no async state needed */}
        <div
          draggable
          onDragStart={handleGripDragStart}
          onDragEnd={handleGripDragEnd}
          className="p-1 cursor-grab hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 active:cursor-grabbing select-none"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </div>
        <button title="Duplicate Section" onClick={handleDuplicate} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400">
          <Copy size={14} />
        </button>
        <button title="Delete Section" onClick={handleDelete} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Quick Add above */}
      <div className={`absolute left-1/2 -translate-x-1/2 -top-3 z-10 flex gap-1 p-1 rounded-full bg-slate-950 border border-slate-800 shadow-md transition-opacity duration-200 no-print
        ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
      `}>
        <button onClick={(e) => handleAddAbove(e, 'heading')} className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-medium rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-400">
          <Plus size={8} /> Heading
        </button>
        <button onClick={(e) => handleAddAbove(e, 'paragraph')} className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-medium rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-400">
          <Plus size={8} /> Para
        </button>
      </div>

      {/* Style token badge */}
      <div className="absolute right-3 top-3 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors no-print">
        {section.styleToken}
      </div>

      {/* Section content */}
      <div className="relative w-full overflow-x-hidden">
        {children}
      </div>

      {/* Quick Add below */}
      <div className={`absolute left-1/2 -translate-x-1/2 -bottom-3 z-10 flex gap-1 p-1 rounded-full bg-slate-950 border border-slate-800 shadow-md transition-opacity duration-200 no-print
        ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
      `}>
        <button onClick={(e) => handleAddBelow(e, 'heading')} className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-medium rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-400">
          <Plus size={8} /> Heading
        </button>
        <button onClick={(e) => handleAddBelow(e, 'paragraph')} className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-medium rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-400">
          <Plus size={8} /> Para
        </button>
        <button onClick={(e) => handleAddBelow(e, 'list')} className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-medium rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-400">
          <Plus size={8} /> List
        </button>
      </div>
    </div>
  );
};
