import { useState, useEffect, useCallback } from "react";
import Dashboard from "./views/Dashboard";
import KnowledgeBase from "./views/KnowledgeBase";
import ContentGenerator from "./views/ContentGenerator";
import PromptLibrary from "./views/PromptLibrary";
import Drafts from "./views/Drafts";
import Calendar from "./views/Calendar";
import Analytics from "./views/Analytics";
import Settings from "./views/Settings";
import KnowledgeAssistant from "./views/KnowledgeAssistant";
import UploadDocument from "./components/UploadDocument";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import { supabase, type Notification, type Prompt, type Draft, type Post, type Activity } from "./lib/supabase";
import { getDocuments, type DocumentRow } from "./services/documents";

export type ViewId = "dashboard" | "knowledge" | "generator" | "assistant" | "prompts" | "drafts" | "calendar" | "analytics" | "settings";

export interface DataState {
  documents: DocumentRow[];
  drafts: Draft[];
  prompts: Prompt[];
  posts: Post[];
  activities: Activity[];
  notifications: Notification[];
}

function App() {
  const [currentView, setCurrentView] = useState<ViewId>("dashboard");
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<DataState>({
    documents: [],
    drafts: [],
    prompts: [],
    posts: [],
    activities: [],
    notifications: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [pendingPromptId, setPendingPromptId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [documents, notifications, drafts, prompts, posts, activities] = await Promise.all([
        getDocuments(),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("drafts").select("*").order("created_at", { ascending: false }),
        supabase.from("prompts").select("*").order("created_at", { ascending: false }),
        supabase.from("posts").select("*").order("created_at", { ascending: false }),
        supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      setData({
        documents,
        drafts: (drafts.data || []) as Draft[],
        prompts: (prompts.data || []) as Prompt[],
        posts: (posts.data || []) as Post[],
        activities: (activities.data || []) as Activity[],
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
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
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
            <KnowledgeBase onUploadClick={handleUploadDocument} refreshKey={refreshKey} initialDocumentId={pendingDocumentId} onDocumentOpened={() => setPendingDocumentId(null)} />
          )}
          {currentView === "assistant" && (
            <KnowledgeAssistant
              onNavigateToDocument={(docId) => {
                setPendingDocumentId(docId);
                setCurrentView("knowledge");
                setSidebarOpen(false);
              }}
              onDraftCreated={() => setRefreshKey((k) => k + 1)}
              onNavigateToKnowledgeBase={() => { setCurrentView("knowledge"); setSidebarOpen(false); }}
              onOpenDrafts={() => { setCurrentView("drafts"); setSidebarOpen(false); }}
            />
          )}
          {currentView === "generator" && (
            <ContentGenerator
              prompts={data.prompts}
              documents={data.documents}
              pendingPromptId={pendingPromptId}
              onPendingPromptHandled={() => setPendingPromptId(null)}
              onDraftCreated={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {currentView === "prompts" && (
            <PromptLibrary
              prompts={data.prompts}
              loading={loading}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              onUseTemplate={(promptId) => {
                setPendingPromptId(promptId);
                setCurrentView("generator");
                setSidebarOpen(false);
              }}
            />
          )}
          {currentView === "drafts" && (
            <Drafts
              drafts={data.drafts}
              loading={loading}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {currentView === "calendar" && (
            <Calendar posts={data.posts} loading={loading} />
          )}
          {currentView === "analytics" && (
            <Analytics data={data} loading={loading} />
          )}
          {currentView === "settings" && <Settings />}
        </main>
      </div>

      {showUpload && (
        <UploadDocument onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}
    </div>
  );
}

export default App;
