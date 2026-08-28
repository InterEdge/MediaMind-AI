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
import { markAllNotificationsRead, markNotificationRead } from "./services/notifications";
import { resolveUnreadCount } from "./utils/notifications";
import { useAuth } from "./contexts/AuthContext";
import { getDisplayName } from "./utils/auth";

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
  const { user, profile, workspace, signOut } = useAuth();
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [pendingPromptId, setPendingPromptId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [documents, notifications, unreadNotifications, drafts, prompts, posts, activities] = await Promise.all([
        getDocuments(),
        supabase.from("notifications").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("read", false),
        supabase.from("drafts").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("prompts").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("posts").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("activities").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(20),
      ]);

      setData({
        documents,
        drafts: (drafts.data || []) as Draft[],
        prompts: (prompts.data || []) as Prompt[],
        posts: (posts.data || []) as Post[],
        activities: (activities.data || []) as Activity[],
        notifications: (notifications.data || []) as Notification[],
      });
      setUnreadCount(resolveUnreadCount(unreadNotifications.count));
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

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

  const handleMarkNotificationRead = async (id: string) => {
    const notification = data.notifications.find((item) => item.id === id);
    if (!notification || notification.read) return;
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => item.id === id ? { ...item, read: true } : item),
    }));
    setUnreadCount((count) => Math.max(0, count - 1));
    const result = await markNotificationRead(id);
    if (result.warning) console.error(result.warning);
    setRefreshKey((key) => key + 1);
  };

  const handleMarkAllNotificationsRead = async () => {
    setData((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
    }));
    setUnreadCount(0);
    const result = await markAllNotificationsRead();
    if (result.warning) console.error(result.warning);
    setRefreshKey((key) => key + 1);
  };

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
          onMarkRead={handleMarkNotificationRead}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          userName={getDisplayName(profile?.display_name, user?.email)}
          userEmail={user?.email ?? ""}
          workspaceName={workspace?.name ?? ""}
          onSignOut={signOut}
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
            <Calendar posts={data.posts} loading={loading} onRefresh={() => setRefreshKey((k) => k + 1)} />
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
