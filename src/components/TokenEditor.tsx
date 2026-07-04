import React, { useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { Palette, Tag, Plus } from 'lucide-react';

export const TokenEditor: React.FC = () => {
  const { currentDocument, activeTokenKey, setActiveTokenKey, updateStyleToken } = useDocumentStore();
  const [newTokenName, setNewTokenName] = useState('');

  if (!currentDocument) return null;

  const tokens = currentDocument.styleProfile.tokens;
  const tokenKeys = Object.keys(tokens);

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTokenName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || tokens[name]) return;

    await updateStyleToken(name, {
      fontFamily: 'Inter',
      fontSize: 11,
      fontWeight: 'normal',
      color: '#1e293b',
      lineHeight: 1.45,
      marginTop: 4,
      marginBottom: 4,
      textAlign: 'left'
    });

    setActiveTokenKey(name);
    setNewTokenName('');
  };

  return (
    <div className="flex flex-col bg-[#0b0f19] border-b border-slate-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 bg-[#0e1325]">
        <Palette size={14} className="text-indigo-400" />
        <span className="text-xs font-semibold text-slate-200">Style Tokens (Global)</span>
      </div>

      {/* Tokens List */}
      <div className="p-3 max-h-[170px] overflow-y-auto space-y-1">
        {tokenKeys.map((key) => {
          const isActive = activeTokenKey === key;
          const props = tokens[key];
          const fontDesc = `${props.fontSize ? props.fontSize + 'pt ' : ''}${props.fontFamily || 'Inherit'}`;
          
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTokenKey(key)}
              className={`w-full px-3 py-2 flex items-center gap-2 rounded text-left transition-all duration-150 group
                ${isActive 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Tag size={12} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium leading-none font-mono">
                  {key}
                </span>
                <span className={`text-[9px] leading-none ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {fontDesc}
                </span>
              </div>
              
              {props.color && (
                <div
                  style={{ backgroundColor: props.color }}
                  className="ml-auto w-3 h-3 rounded-full border border-slate-700/50 shadow-inner"
                />
              )}
            </button>
          );
        })}
        {tokenKeys.length === 0 && (
          <div className="text-center py-4 text-slate-500 text-xs font-medium">
            No design tokens defined.
          </div>
        )}
      </div>

      {/* Add style token input form */}
      <form onSubmit={handleAddToken} className="p-2.5 border-t border-slate-800/80 bg-[#0a0d17]/40 flex gap-2">
        <input
          type="text"
          value={newTokenName}
          onChange={(e) => setNewTokenName(e.target.value)}
          placeholder="New token key..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
        />
        <button
          type="submit"
          disabled={!newTokenName.trim()}
          className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white flex items-center justify-center cursor-pointer shrink-0"
          title="Add Style Token"
        >
          <Plus size={13} />
        </button>
      </form>
    </div>
  );
};
