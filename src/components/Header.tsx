import React, { useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { 
  Upload, Sparkles, FolderOpen, Undo2, Redo2, X 
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const Header: React.FC = () => {
  const { 
    currentDocument, 
    isSidebarOpen, 
    setSidebarOpen,
    undo,
    redo,
    historyStack,
    redoStack,
    setCurrentDocument,
    loadStyleProfiles
  } = useDocumentStore();

  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState('md');
  const [showImportModal, setShowImportModal] = useState(false);

  const handleExport = async (format: 'html' | 'md' | 'json') => {
    if (!currentDocument) return;
    try {
      const output = await invoke<string>('export_document', {
        doc: currentDocument,
        format
      });
      
      // Trigger download
      const blob = new Blob([output], { type: format === 'html' ? 'text/html' : 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${currentDocument.title.replace(/\s+/g, '_')}.${format === 'html' ? 'html' : 'md'}`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + err);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    try {
      const doc = await invoke<any>('import_from_string', { content: importText, format: importFormat });
      setCurrentDocument(doc);
      await loadStyleProfiles();
      setShowImportModal(false);
      setImportText('');
    } catch (err) {
      console.error(err);
      alert('Import failed.');
    }
  };

  const handleCreateNew = () => {
    const defaultDoc = {
      id: `doc_local_${Date.now()}`,
      title: 'Untitled Document',
      styleProfileId: 'preset_resume',
      styleProfile: {
        id: 'preset_resume',
        name: 'Corporate Classic',
        tokens: {
          heading: { fontFamily: 'Outfit', fontSize: 18, fontWeight: 'bold', lineHeight: 1.2, marginTop: 20, marginBottom: 8, color: '#1e293b', textAlign: 'left' as const },
          heading_2: { fontFamily: 'Outfit', fontSize: 14, fontWeight: 'bold', lineHeight: 1.25, marginTop: 14, marginBottom: 6, color: '#334155', textAlign: 'left' as const },
          body: { fontFamily: 'Inter', fontSize: 11, fontWeight: 'normal', lineHeight: 1.45, marginTop: 4, marginBottom: 4, color: '#1e293b', textAlign: 'left' as const },
          bullet: { fontFamily: 'Inter', fontSize: 11, fontWeight: 'normal', lineHeight: 1.4, marginTop: 2, marginBottom: 2, indent: 18, listStyleType: 'disc' as const, color: '#1e293b' },
          divider: { height: 1, marginTop: 8, marginBottom: 8, dividerStyle: 'solid' as const, color: '#cbd5e1' }
        }
      },
      sections: [
        {
          id: `sec_local_${Date.now()}_1`,
          type: 'heading' as const,
          styleToken: 'heading',
          content: { type: 'paragraph', content: [{ type: 'text', text: 'the test doccument' }] }
        },
        {
          id: `sec_local_${Date.now()}_2`,
          type: 'paragraph' as const,
          styleToken: 'body',
          content: { type: 'paragraph', content: [{ type: 'text', text: 'This is a sample document to test visual design overrides.' }] }
        }
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    setCurrentDocument(defaultDoc);
  };

  return (
    <div className="h-12 w-full border-b border-slate-800 bg-[#0d0f14] flex items-center justify-between px-4 select-none shrink-0 z-10">
      {/* Brand Logo & Subtitle */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded bg-[#f97316] flex items-center justify-center font-black text-slate-950 text-xs shadow-inner">
          S
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-extrabold text-slate-100 tracking-wider font-mono">StyleForge</span>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none">Style Engine Studio</span>
        </div>
      </div>

      {/* Breadcrumb / Active doc title */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <FolderOpen size={12} className="text-slate-600" />
        <span className="hover:text-slate-300 cursor-pointer" onClick={handleCreateNew}>Documents</span>
        <span className="text-slate-600">/</span>
        <span className="font-semibold text-orange-400 bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/10">
          {currentDocument ? currentDocument.title : 'No Document Open'}
        </span>
      </div>

      {/* Action triggers */}
      <div className="flex items-center gap-3">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 border-r border-slate-800 pr-3">
          <button
            onClick={undo}
            disabled={historyStack.length === 0}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Undo"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Redo"
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Load & New buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateNew}
            className="px-2.5 py-1 text-[10px] font-medium bg-[#1a1d26] border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded text-slate-300 transition-colors"
          >
            New Document
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
            title="Import Raw Code"
          >
            <Upload size={14} />
          </button>
        </div>

        {/* Export Formats */}
        <div className="flex items-center gap-1 bg-[#121620] border border-slate-800 rounded px-1.5 py-0.5 text-[10px]">
          <span className="text-slate-500 font-medium mr-1.5">Export:</span>
          <button
            onClick={() => handleExport('md')}
            className="px-1 hover:text-orange-400 transition-colors font-mono"
            title="Export Markdown"
          >
            MD
          </button>
          <button
            onClick={() => handleExport('html')}
            className="px-1 hover:text-orange-400 transition-colors font-mono border-l border-slate-800"
            title="Export HTML"
          >
            HTML
          </button>
          <button
            onClick={() => window.print()}
            className="px-1 hover:text-orange-400 transition-colors font-mono border-l border-slate-800"
            title="Print to PDF"
          >
            PDF
          </button>
        </div>

        {/* AI Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className={`px-3 py-1 flex items-center gap-1.5 rounded text-[10px] font-semibold transition-all border
            ${isSidebarOpen 
              ? 'bg-orange-500 text-slate-950 font-bold border-orange-400 shadow-md' 
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }
          `}
        >
          <Sparkles size={11} className={isSidebarOpen ? 'text-slate-950' : 'text-orange-400'} />
          AI Assistant
        </button>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0e121a] border border-slate-800 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-200">Import Document Content</span>
              <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleImportSubmit} className="space-y-3">
              <div className="flex gap-4 items-center">
                <label className="text-[10px] text-slate-400">Format</label>
                <div className="flex gap-2">
                  {['md', 'html'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setImportFormat(f)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border
                        ${importFormat === f 
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' 
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                        }
                      `}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste Markdown or HTML code here..."
                rows={8}
                className="w-full bg-[#181d28] border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
              />
              <button
                type="submit"
                className="w-full py-2 rounded bg-orange-500 text-slate-950 hover:bg-orange-400 font-bold text-xs cursor-pointer"
              >
                Import Content
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
