import React, { useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { 
  X, RotateCcw, AlignLeft, AlignCenter, AlignRight, Palette 
} from 'lucide-react';
import { StyleProperties } from '../types';
import { startPointerDrag } from '../editor/pointerDrag';

export const RightSidebar: React.FC = () => {
  const { 
    currentDocument, 
    activeSectionId,
    activeTokenKey, 
    setActiveTokenKey, 
    updateStyleToken,
    updateSectionStyleToken,
    updateSectionStyleProps,
  } = useDocumentStore();

  const [hexInput, setHexInput] = useState('');

  if (!currentDocument) return null;

  const tokens = currentDocument.styleProfile.tokens;
  const tokenKeys = Object.keys(tokens);

  // If no token is active, we can show a placeholder or the token list only
  const activeTokenProps = activeTokenKey ? tokens[activeTokenKey] || {} : null;

  const handleUpdateProp = (key: keyof StyleProperties, value: any) => {
    if (activeSectionId) {
      // Section is selected — edit properties scoped to just this section.
      // updateSectionStyleProps auto-clones the token if it's shared, so
      // only THIS section's appearance changes.
      updateSectionStyleProps(activeSectionId, { [key]: value });
    } else if (activeTokenKey) {
      // No section selected — editing the shared token directly from the token list.
      updateStyleToken(activeTokenKey, { [key]: value });
    }
  };

  const handleColorSwatchClick = (color: string) => {
    handleUpdateProp('color', color);
    setHexInput(color);
  };

  const swatches = [
    '#1a1a1a', '#475569', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
  ];

  const fontFamilies = [
    { name: 'Outfit (Sans-Display)', value: 'Outfit' },
    { name: 'Inter (Sans-Body)', value: 'Inter' },
    { name: 'JetBrains Mono', value: 'JetBrains Mono' },
    { name: 'Georgia (Serif)', value: 'Georgia' },
    { name: 'system-ui', value: 'system-ui' }
  ];

  return (
    <div className="w-[360px] h-full border-l border-slate-800 bg-[#0d0f14] flex flex-col shrink-0 text-slate-300 overflow-y-auto no-print">
      {/* Header: Token List Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#121620]/60">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-100">Style Tokens</span>
          <span className="text-[10px] text-slate-500">{tokenKeys.length} tokens defined</span>
        </div>
      </div>

      {/* Mini Token Selector Strip */}
      <div className="p-3 border-b border-slate-800/80 bg-[#090b10] flex flex-wrap gap-1.5">
        {tokenKeys.map((key) => {
          const isActive = activeTokenKey === key;
          return (
            <span
              key={key}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTokenKey(key); } }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                setActiveTokenKey(key);
                const target = e.currentTarget as HTMLElement;
                const payload = `token:${key}`;
                startPointerDrag('token', payload, target, (targetSectionId, p) => {
                  if (targetSectionId && p.startsWith('token:')) {
                    const tokenKey = p.slice('token:'.length);
                    updateSectionStyleToken(targetSectionId, tokenKey);
                  }
                });
              }}
              onClick={(e) => { e.preventDefault(); setActiveTokenKey(key); }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all cursor-grab active:cursor-grabbing inline-block select-none
                ${isActive 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                  : 'bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }
              `}
            >
              {key}
            </span>
          );
        })}
      </div>

      {/* If a token is active, show the properties editor */}
      {activeTokenKey && activeTokenProps ? (
        <div className="flex-1 flex flex-col divide-y divide-slate-800/60">
          {/* Active Token Name banner */}
          <div className="px-4 py-3 bg-[#11141c]/50 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-100 capitalize">{activeTokenKey}</span>
              <span className="text-[10px] text-slate-500 font-mono">style token override</span>
            </div>
            <button
              onClick={() => setActiveTokenKey(null)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* TYPOGRAPHY SECTION */}
          <div className="p-4 space-y-4">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Typography</span>

            {/* Font Family */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Font Family</label>
              <select
                value={activeTokenProps.fontFamily || 'Inter'}
                onChange={(e) => handleUpdateProp('fontFamily', e.target.value)}
                className="w-full bg-[#181d28] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              >
                {fontFamilies.map((f) => (
                  <option key={f.value} value={f.value}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Font Size Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <label className="text-slate-400">Font Size</label>
                <span className="text-orange-500 font-mono font-semibold">{activeTokenProps.fontSize || 11}pt</span>
              </div>
              <input
                type="range"
                min="8"
                max="48"
                step="0.5"
                value={activeTokenProps.fontSize || 11}
                onChange={(e) => handleUpdateProp('fontSize', parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Font Weight Selector Button Group */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400">Font Weight</label>
              <div className="grid grid-cols-4 gap-1 bg-[#121620] p-0.5 rounded border border-slate-800">
                {[
                  { label: 'Light', value: '300' },
                  { label: 'Reg', value: 'normal' },
                  { label: 'Med', value: '500' },
                  { label: 'Bold', value: 'bold' }
                ].map((w) => {
                  const isActive = activeTokenProps.fontWeight === w.value || 
                    (w.value === 'normal' && (!activeTokenProps.fontWeight || activeTokenProps.fontWeight === '400'));
                  return (
                    <button
                      key={w.value}
                      onClick={() => handleUpdateProp('fontWeight', w.value)}
                      className={`py-1 rounded text-[10px] font-medium transition-all
                        ${isActive 
                          ? 'bg-orange-500 text-slate-950 font-bold shadow' 
                          : 'hover:bg-slate-900 text-slate-400'
                        }
                      `}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alignment Button Group & Italic/Underline switches */}
            <div className="flex items-center justify-between pt-1">
              {/* Alignment */}
              <div className="flex gap-0.5 bg-[#121620] p-0.5 rounded border border-slate-800">
                {[
                  { icon: <AlignLeft size={12} />, value: 'left' },
                  { icon: <AlignCenter size={12} />, value: 'center' },
                  { icon: <AlignRight size={12} />, value: 'right' }
                ].map((align) => {
                  const isActive = activeTokenProps.textAlign === align.value || 
                    (align.value === 'left' && !activeTokenProps.textAlign);
                  return (
                    <button
                      key={align.value}
                      onClick={() => handleUpdateProp('textAlign', align.value)}
                      className={`p-1.5 rounded transition-all
                        ${isActive ? 'bg-orange-500 text-slate-950 shadow' : 'hover:bg-slate-900 text-slate-400'}
                      `}
                    >
                      {align.icon}
                    </button>
                  );
                })}
              </div>

              {/* Italic & Underline Custom Toggles */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-slate-400">Italic</label>
                  <button
                    onClick={() => handleUpdateProp('fontStyle', activeTokenProps.fontStyle === 'italic' ? 'normal' : 'italic')}
                    className={`w-7 h-4 rounded-full transition-all relative p-0.5
                      ${activeTokenProps.fontStyle === 'italic' ? 'bg-orange-500' : 'bg-slate-800'}
                    `}
                  >
                    <div 
                      className={`w-3 h-3 rounded-full bg-white transition-all transform
                        ${activeTokenProps.fontStyle === 'italic' ? 'translate-x-3' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-slate-400">Underline</label>
                  <button
                    onClick={() => handleUpdateProp('textDecoration', activeTokenProps.textDecoration === 'underline' ? 'none' : 'underline')}
                    className={`w-7 h-4 rounded-full transition-all relative p-0.5
                      ${activeTokenProps.textDecoration === 'underline' ? 'bg-orange-500' : 'bg-slate-800'}
                    `}
                  >
                    <div 
                      className={`w-3 h-3 rounded-full bg-white transition-all transform
                        ${activeTokenProps.textDecoration === 'underline' ? 'translate-x-3' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Text Color Swatches & Hex Input */}
            <div className="space-y-2 pt-1">
              <label className="text-[10px] text-slate-400 block">Text Color</label>
              <div className="flex flex-wrap gap-2">
                {swatches.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSwatchClick(color)}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 shadow-inner
                      ${activeTokenProps.color === color ? 'border-orange-500 scale-105' : 'border-slate-700'}
                    `}
                  />
                ))}
              </div>
              <input
                type="text"
                value={hexInput || activeTokenProps.color || ''}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  if (e.target.value.startsWith('#') && e.target.value.length === 7) {
                    handleUpdateProp('color', e.target.value);
                  }
                }}
                placeholder="#1a1a1a"
                className="w-full bg-[#181d28] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>
          </div>

          {/* SPACING & LAYOUT */}
          <div className="p-4 space-y-4">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Spacing & Layout</span>

            {/* Margin Top */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <label className="text-slate-400">Margin Top</label>
                <span className="text-orange-500 font-mono font-semibold">{activeTokenProps.marginTop || 0}pt</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={activeTokenProps.marginTop || 0}
                onChange={(e) => handleUpdateProp('marginTop', parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Margin Bottom */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <label className="text-slate-400">Margin Bottom</label>
                <span className="text-orange-500 font-mono font-semibold">{activeTokenProps.marginBottom || 0}pt</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={activeTokenProps.marginBottom || 0}
                onChange={(e) => handleUpdateProp('marginBottom', parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Left Indent */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <label className="text-slate-400">Left Indent</label>
                <span className="text-orange-500 font-mono font-semibold">{activeTokenProps.indent || 0}pt</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="2"
                value={activeTokenProps.indent || 0}
                onChange={(e) => handleUpdateProp('indent', parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Reset styles */}
            <button
              onClick={() => {
                const defaults: Partial<StyleProperties> = {
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: 'normal',
                  fontStyle: 'normal' as const,
                  textDecoration: 'none' as const,
                  color: '#1a1a1a',
                  lineHeight: 1.45,
                  marginTop: 4,
                  marginBottom: 4,
                  indent: 0,
                  textAlign: 'left' as const
                };
                if (activeSectionId) {
                  updateSectionStyleProps(activeSectionId, defaults);
                } else if (activeTokenKey) {
                  updateStyleToken(activeTokenKey, defaults);
                }
              }}
              className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5 text-[10px]"
            >
              <RotateCcw size={12} />
              Reset styles to default
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 text-center">
          <Palette size={28} className="text-slate-700 mb-2" />
          <p className="text-[11px] font-medium">No Style Token Selected</p>
          <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">
            Click any section in your document or select a token name badge above to edit styling.
          </p>
        </div>
      )}
    </div>
  );
};
