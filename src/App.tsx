import { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabase";
import type { Document, Draft, Post, Prompt, Activity, Notification } from "./lib/supabase";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import Dashboard from "./views/Dashboard";
import KnowledgeBase from "./views/KnowledgeBase";
import ContentGenerator from "./views/ContentGenerator";
import Drafts from "./views/Drafts";
import Calendar from "./views/Calendar";
import PromptLibrary from "./views/PromptLibrary";
import Analytics from "./views/Analytics";
import Settings from "./views/Settings";

export type ViewId =
  | "dashboard"
  | "knowledge"
  | "generator"
  | "drafts"
  | "calendar"
  | "prompts"
  | "analytics"
  | "settings";

export interface DataState {
  documents: Document[];
  drafts: Draft[];
  posts: Post[];
  prompts: Prompt[];
  activities: Activity[];
  notifications: Notification[];
}

export default function App() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<DataState>({
    documents: [],
    drafts: [],
    posts: [],
    prompts: [],
    activities: [],
    notifications: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [docs, drafts, posts, prompts, activities, notifications] = await Promise.all([
      supabase.from("documents").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("drafts").select("*").order("created_at", { ascending: false }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
      supabase.from("prompts").select("*").order("created_at", { ascending: false }),
      supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    ]);

    setData({
      documents: docs.data ?? [],
      drafts: drafts.data ?? [],
      posts: posts.data ?? [],
      prompts: prompts.data ?? [],
      activities: activities.data ?? [],
      notifications: notifications.data ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const navigate = (v: ViewId) => {
    setView(v);
    setSidebarOpen(false);
  };

  const unreadCount = data.notifications.filter((n) => !n.read).length;

  const renderView = () => {
    switch (view) {
      case "dashboard":
        return <Dashboard data={data} loading={loading} onNavigate={navigate} />;
      case "knowledge":
        return <KnowledgeBase />;
      case "generator":
        return <ContentGenerator prompts={data.prompts} drafts={data.drafts} onCreated={fetchAll} />;
      case "drafts":
        return <Drafts drafts={data.drafts} loading={loading} onRefresh={fetchAll} />;
      case "calendar":
        return <Calendar posts={data.posts} loading={loading} />;
      case "prompts":
        return <PromptLibrary prompts={data.prompts} loading={loading} onRefresh={fetchAll} />;
      case "analytics":
        return <Analytics data={data} loading={loading} />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard data={data} loading={loading} onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar view={view} onNavigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} unreadCount={unreadCount} notifications={data.notifications} onRefresh={fetchAll} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{renderView()}</div>
        </main>
      </div>
    </div>
  );
}
