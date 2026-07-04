import { Header } from './components/Header';
import { DocumentEditor } from './editor/DocumentEditor';
import { RightSidebar } from './components/RightSidebar';
import { FloatingAIBar } from './components/FloatingAIBar';
import { ProviderSettings } from './components/ProviderSettings';
import { useDocumentStore } from './store/documentStore';

function App() {
  const { isSidebarOpen, isSettingsOpen, setSettingsOpen } = useDocumentStore();

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b13] text-slate-100 overflow-hidden font-sans relative">
      {/* Top Header Bar */}
      <Header />

      {/* Main Workspace */}
      <div className="flex flex-1 w-full overflow-hidden relative">
        {/* Center Page Editor */}
        <DocumentEditor />

        {/* Right Style Token Override Sidebar */}
        <RightSidebar />
        
        {/* Floating AI Command Bar */}
        {isSidebarOpen && <FloatingAIBar />}
      </div>

      {/* Global Provider Settings modal dialog (renders outside transforms/absolute bounds) */}
      <ProviderSettings isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
