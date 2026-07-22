import { useState, useEffect, useCallback } from "react";
import Dashboard from "./views/Dashboard";
import KnowledgeBase from "./views/KnowledgeBase";
import UploadDocument from "./components/UploadDocument";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import { supabase, type Notification } from "./lib/supabase";
import { getDocuments, type DocumentRow } from "./services/documents";

export type ViewId = "dashboard" | "knowledge" | "generator" | "prompts" | "drafts" | "calendar" | "analytics" | "settings";

interface DataState {
  documents: DocumentRow[];
  drafts: any[];
  posts: any[];
  activities: any[];
  notifications: Notification[];
}

function App() {
  const [currentView, setCurrentView] = useState<ViewId>("dashboard");
  const [showUpload, setShowUpload] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<DataState>({
    documents: [],
    drafts: [],
    posts: [],
    activities: [],
    notifications: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [documents, notifications] = await Promise.all([
        getDocuments(),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      setData({
        documents,
        drafts: [],
        posts: [],
        activities: [],
        notifications: (notifications.data || []) as Notification[],
      });
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleNavigate = (view: ViewId) => {
    setCurrentView(view);
    setSidebarOpen(false);
  };

  const handleUploadDocument = () => {
    setShowUpload(true);
  };

  const handleUploaded = () => {
    setShowUpload(false);
    setCurrentView("knowledge");
    setRefreshKey((k) => k + 1);
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await supabase.from("notifications").update({ read: true }).neq("read", true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  const unreadCount = data.notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        view={currentView}
        onNavigate={handleNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          onMenuClick={() => setSidebarOpen(true)}
          unreadCount={unreadCount}
          notifications={data.notifications}
          onRefresh={handleMarkNotificationsRead}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {currentView === "dashboard" && (
            <Dashboard
              data={data}
              loading={loading}
              onNavigate={handleNavigate}
              onUploadDocument={handleUploadDocument}
            />
          )}
          {currentView === "knowledge" && (
            <KnowledgeBase onUploadClick={handleUploadDocument} refreshKey={refreshKey} />
          )}
          {(currentView === "generator" ||
            currentView === "prompts" ||
            currentView === "drafts" ||
            currentView === "calendar" ||
            currentView === "analytics" ||
            currentView === "settings") && (
            <div className="flex h-[60vh] flex-col items-center justify-center text-center">
              <h2 className="text-lg font-semibold text-slate-700">Coming Soon</h2>
              <p className="mt-1 text-sm text-slate-400">This module is not yet built.</p>
            </div>
          )}
        </main>
      </div>

      {showUpload && (
        <UploadDocument onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}
    </div>
  );
}

export default App;
