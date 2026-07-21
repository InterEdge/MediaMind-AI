import {
  FileText,
  PenSquare,
  Sparkles,
  CalendarDays,
  Upload,
  Library,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  FileEdit,
  AlertCircle,
} from "lucide-react";
import type { DataState, ViewId } from "../App";
 
interface DashboardProps {
  data: DataState;
  loading: boolean;
  onNavigate: (v: ViewId) => void;
  onUploadDocument: () => void;
}
 
export default function Dashboard({ data, loading, onNavigate, onUploadDocument }: DashboardProps) {
  const stats = [
    {
      label: "Documents Uploaded",
      value: data.documents.length,
      icon: FileText,
      color: "blue",
      trend: "+12%",
      trendUp: true,
    },
    {
      label: "Drafts Created",
      value: data.drafts.length,
      icon: PenSquare,
      color: "emerald",
      trend: "+8%",
      trendUp: true,
    },
    {
      label: "Posts Generated",
      value: data.posts.length,
      icon: Sparkles,
      color: "violet",
      trend: "+24%",
      trendUp: true,
    },
    {
      label: "Scheduled Posts",
      value: data.posts.filter((p) => p.status === "Scheduled").length,
      icon: CalendarDays,
      color: "amber",
      trend: "+3",
      trendUp: true,
    },
  ];
 
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100" },
  };
 
  const quickActions = [
    { label: "Upload Document", icon: Upload, action: "upload" as "upload" | ViewId, color: "bg-blue-600 hover:bg-blue-700" },
    { label: "Generate LinkedIn Post", icon: Sparkles, action: "generator" as ViewId, color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Open Prompt Library", icon: Library, action: "prompts" as ViewId, color: "bg-slate-800 hover:bg-slate-900" },
  ];
 
  const activityIcon = (type: string) => {
    switch (type) {
      case "upload": return { icon: Upload, color: "bg-blue-100 text-blue-600" };
      case "generate": return { icon: Sparkles, color: "bg-violet-100 text-violet-600" };
      case "draft": return { icon: FileEdit, color: "bg-emerald-100 text-emerald-600" };
      case "schedule": return { icon: CalendarDays, color: "bg-amber-100 text-amber-600" };
      case "publish": return { icon: CheckCircle2, color: "bg-sky-100 text-sky-600" };
      default: return { icon: AlertCircle, color: "bg-slate-100 text-slate-600" };
    }
  };
 
  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return "Just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };
 
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Draft: "bg-slate-100 text-slate-600",
      "In Review": "bg-amber-100 text-amber-700",
      Approved: "bg-emerald-100 text-emerald-700",
      Published: "bg-blue-100 text-blue-700",
      Processing: "bg-amber-100 text-amber-700",
      Indexed: "bg-sky-100 text-sky-700",
      Ready: "bg-emerald-100 text-emerald-700",
      Archived: "bg-slate-100 text-slate-500",
    };
    return map[status] ?? "bg-slate-100 text-slate-600";
  };
 
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, Alex. Here\'s what\'s happening with your media operations.
        </p>
      </div>
 
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))
          : stats.map((stat) => {
              const c = colorMap[stat.color];
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60"
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} ${c.text} ring-1 ${c.ring}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold ${stat.trendUp ? "text-emerald-600" : "text-red-500"}`}>
                      <TrendingUp className="h-3.5 w-3.5" />
                      {stat.trend}
                    </div>
                  </div>
                  <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
                </div>
              );
            })}
      </div>
 
      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => action.action === "upload" ? onUploadDocument() : onNavigate(action.action)}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg active:scale-[0.98] ${action.color}`}
              >
                <Icon className="h-5 w-5" />
                {action.label}
                <ArrowRight className="ml-auto h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>
 
      {/* Recent Activity + Recent Drafts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
            <button className="text-xs font-medium text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="h-2.5 w-1/4 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))
            ) : (
              data.activities.slice(0, 8).map((activity) => {
                const { icon: Icon, color } = activityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-slate-50">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{activity.description}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {formatTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
 
        {/* Recent Drafts */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Recent Drafts</h2>
            <button onClick={() => onNavigate("drafts")} className="text-xs font-medium text-blue-600 hover:text-blue-700">
              View All
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                  </div>
                ))
              : data.drafts.slice(0, 5).map((draft) => (
                  <div key={draft.id} className="group flex items-center justify-between px-5 py-3.5 transition hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{draft.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-slate-400">{draft.platform}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{draft.word_count} words</span>
                        {draft.ai_generated && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="flex items-center gap-0.5 text-xs text-violet-500">
                              <Sparkles className="h-3 w-3" /> AI
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(draft.status)}`}>
                      {draft.status}
                    </span>
                  </div>
                ))}
          </div>
        </div>
 
        {/* Recent Documents */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Recent Documents</h2>
            <button onClick={() => onNavigate("knowledge")} className="text-xs font-medium text-blue-600 hover:text-blue-700">
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Document</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                  <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell">Category</th>
                  <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell">Size</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4"><div className="h-4 w-48 animate-pulse rounded bg-slate-100" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                        <td className="hidden px-5 py-4 sm:table-cell"><div className="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                        <td className="hidden px-5 py-4 sm:table-cell"><div className="h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
                        <td className="px-5 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" /></td>
                      </tr>
                    ))
                  : data.documents.slice(0, 6).map((doc) => (
                      <tr key={doc.id} className="group transition hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <FileText className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-slate-800">{doc.title}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{doc.type}</td>
                        <td className="hidden px-5 py-3.5 text-sm text-slate-500 sm:table-cell">{doc.category}</td>
                        <td className="hidden px-5 py-3.5 text-sm text-slate-500 sm:table-cell">{doc.file_size}</td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(doc.status)}`}>
                            {doc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
