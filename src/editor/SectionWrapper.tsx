import React, { useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { Section } from '../types';
import { Trash2, Copy, GripVertical, Plus } from 'lucide-react';
import { startPointerDrag } from './pointerDrag';

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
  } = useDocumentStore();
  
  const [isHovered, setIsHovered] = useState(false);

  const handleGripPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const payload = `reorder:${index}`;
    const sourceIndex = index;
    startPointerDrag('reorder', payload, target, (targetSectionId, p) => {
      if (!currentDocument) return;
      if (p.startsWith('reorder:') && targetSectionId) {
        const sectionEl = document.querySelector<HTMLElement>(`[data-section-id="${targetSectionId}"]`);
        const dropIndex = parseInt(sectionEl?.dataset.dropIndex ?? '', 10);
        if (isNaN(dropIndex) || dropIndex === sourceIndex) return;
        const newSections = [...currentDocument.sections];
        const [draggedItem] = newSections.splice(sourceIndex, 1);
        newSections.splice(dropIndex, 0, draggedItem);
        reorderSections(newSections);
      }
    });
  };

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
      data-section-id={section.id}
      data-drop-index={index}
      data-section-drag-over="false"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group relative my-2 px-10 py-6 transition-all duration-200 rounded-lg cursor-pointer border-2 border-transparent
        ${isActive ? 'bg-slate-900/50 shadow-md ring-2 ring-indigo-500/50' : 'hover:bg-slate-950/30'}
      `}
      style={{}}
    >
      {/* Side Action panel — hidden by default, appears on hover. Positioned
          just outside the page padding so it sits in the empty area beside
          the A4 sheet. */}
      <div className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 p-1 rounded-md bg-slate-950 border border-slate-800 shadow-lg transition-opacity duration-200 no-print z-10
        ${isHovered || isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ left: `calc(-1 * 60px - 4px)` }}
      >
        <div
          onPointerDown={handleGripPointerDown}
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
