import React from 'react';
import { useDocumentStore } from '../store/documentStore';
import { StyleProperties } from '../types';
import { Sliders, Type, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

const FONTS = ['Inter', 'Outfit', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'JetBrains Mono'];

export const StyleInspector: React.FC = () => {
  const { currentDocument, activeSectionId, activeTokenKey, updateStyleToken } = useDocumentStore();

  if (!currentDocument || !activeSectionId || !activeTokenKey) {
    return (
      <div className="p-6 text-center text-slate-500 text-xs border-b border-slate-800 bg-[#0c1020]">
        Select any section in the document to inspect and edit its style token properties.
      </div>
    );
  }

  const activeTokenProps = currentDocument.styleProfile.tokens[activeTokenKey] || {};

  const handleUpdateProp = (key: keyof StyleProperties, val: any) => {
    updateStyleToken(activeTokenKey, { [key]: val === '' ? undefined : val });
  };

  return (
    <div className="flex flex-col bg-[#0b0f19] border-b border-slate-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 bg-[#0e1325]">
        <Sliders size={14} className="text-indigo-400" />
        <span className="text-xs font-semibold text-slate-200">Style Inspector</span>
        <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
          Token: {activeTokenKey}
        </span>
      </div>

      {/* Editor Controls */}
      <div className="p-4 space-y-4 text-xs">
        {/* Typography Group */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
            <Type size={12} />
            <span>Typography</span>
          </div>

          {/* Font Family & Size */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">Font Family</label>
              <select
                value={activeTokenProps.fontFamily || ''}
                onChange={(e) => handleUpdateProp('fontFamily', e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">(Inherit)</option>
                {FONTS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">Font Size (pt)</label>
              <input
                type="number"
                step="0.5"
                min="6"
                max="72"
                value={activeTokenProps.fontSize || ''}
                onChange={(e) => handleUpdateProp('fontSize', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="11"
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Font Weight & Style */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">Weight</label>
              <select
                value={activeTokenProps.fontWeight ? activeTokenProps.fontWeight.toString() : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const parsed = val === 'bold' || val === 'normal' ? val : parseInt(val, 10);
                  handleUpdateProp('fontWeight', val === '' ? undefined : parsed);
                }}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">(Inherit)</option>
                <option value="normal">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="bold">Bold (700)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">Italic & Underline</label>
              <div className="flex gap-1.5 h-[26px]">
                <button
                  type="button"
                  onClick={() => handleUpdateProp('fontStyle', activeTokenProps.fontStyle === 'italic' ? 'normal' : 'italic')}
                  className={`flex-1 rounded border text-[10px] font-medium transition-colors
                    ${activeTokenProps.fontStyle === 'italic'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }
                  `}
                >
                  Italic
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateProp('textDecoration', activeTokenProps.textDecoration === 'underline' ? 'none' : 'underline')}
                  className={`flex-1 rounded border text-[10px] font-medium transition-colors
                    ${activeTokenProps.textDecoration === 'underline'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }
                  `}
                >
                  Underline
                </button>
              </div>
            </div>
          </div>

          {/* Color & Line Height */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">Text Color</label>
              <div className="flex gap-1.5">
                <input
                  type="color"
                  value={activeTokenProps.color || '#000000'}
                  onChange={(e) => handleUpdateProp('color', e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded h-[26px] w-[32px] cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  placeholder="#000000"
                  value={activeTokenProps.color || ''}
                  onChange={(e) => handleUpdateProp('color', e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[10px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500">Line Height</label>
              <input
                type="number"
                step="0.05"
                min="1.0"
                max="2.5"
                value={activeTokenProps.lineHeight || ''}
                onChange={(e) => handleUpdateProp('lineHeight', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="1.35"
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Alignment */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500">Alignment</label>
            <div className="flex rounded border border-slate-800 bg-slate-900 overflow-hidden divide-x divide-slate-800">
              {(['left', 'center', 'right', 'justify'] as const).map((align) => {
                const isSelected = activeTokenProps.textAlign === align;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => handleUpdateProp('textAlign', align)}
                    className={`flex-1 py-1.5 flex items-center justify-center transition-colors
                      ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800/50'}
                    `}
                  >
                    {align === 'left' && <AlignLeft size={12} />}
                    {align === 'center' && <AlignCenter size={12} />}
                    {align === 'right' && <AlignRight size={12} />}
                    {align === 'justify' && <AlignJustify size={12} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spacing Group */}
        <div className="space-y-3 pt-2 border-t border-slate-800/60">
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Spacing (pt)</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500">Margin Top</label>
              <input
                type="number"
                min="0"
                max="100"
                value={activeTokenProps.marginTop || ''}
                onChange={(e) => handleUpdateProp('marginTop', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="0"
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-slate-500">Margin Bottom</label>
              <input
                type="number"
                min="0"
                max="100"
                value={activeTokenProps.marginBottom || ''}
                onChange={(e) => handleUpdateProp('marginBottom', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="0"
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
