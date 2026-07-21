import { useState } from 'react';
import Dashboard from './views/Dashboard';
import KnowledgeBase from './views/KnowledgeBase';
import UploadDocument from './components/UploadDocument';
 
export type ViewId = 'dashboard' | 'knowledge' | 'generator' | 'prompts' | 'drafts';
 
interface DataState {
  documents: any[];
  drafts: any[];
  posts: any[];
  activities: any[];
}
 
const initialData: DataState = {
  documents: [],
  drafts: [],
  posts: [],
  activities: [],
};
 
function App() {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [showUpload, setShowUpload] = useState(false);
 
  const handleNavigate = (view: ViewId) => {
    setCurrentView(view);
  };
 
  const handleUploadDocument = () => {
    setShowUpload(true);
  };
 
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Assuming a basic layout with a sidebar or navigation */}
      <div className="flex">
        {/* Sidebar/Navigation would go here */}
        <div className="flex-1 p-6">
          {currentView === 'dashboard' && (
            <Dashboard
              data={initialData} // Replace with actual data fetching if needed
              loading={false}
              onNavigate={handleNavigate}
              onUploadDocument={handleUploadDocument}
            />
          )}
          {currentView === 'knowledge' && (
            <KnowledgeBase />
          )}
          {/* Other views would go here */}
        </div>
      </div>
 
      {showUpload && (
        <UploadDocument
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            // Optionally navigate to knowledge base or refresh data
            setCurrentView('knowledge');
          }}
        />
      )}
    </div>
  );
}
 
export default App;
