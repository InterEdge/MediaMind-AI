import { TrendingUp, FileText, PenSquare, Sparkles, CalendarDays, BarChart3, Activity } from "lucide-react";
import type { DataState } from "../App";

interface AnalyticsProps {
  data: DataState;
  loading: boolean;
}

export default function Analytics({ data, loading }: AnalyticsProps) {
  const totalDocs = data.documents.length;
  const totalDrafts = data.drafts.length;
  const totalPosts = data.posts.length;
  const scheduledPosts = data.posts.filter((p) => p.status === "Scheduled").length;
  const publishedPosts = data.posts.filter((p) => p.status === "Published").length;
  const avgEngagement = data.posts.length > 0
    ? Math.round(data.posts.reduce((sum, p) => sum + p.engagement_score, 0) / data.posts.length)
    : 0;
  const aiDrafts = data.drafts.filter((d) => d.ai_generated).length;
  const aiRate = totalDrafts > 0 ? Math.round((aiDrafts / totalDrafts) * 100) : 0;

  const statusBreakdown = [
    { label: "Draft", count: data.drafts.filter((d) => d.status === "Draft").length, color: "bg-slate-400" },
    { label: "In Review", count: data.drafts.filter((d) => d.status === "In Review").length, color: "bg-amber-400" },
    { label: "Approved", count: data.drafts.filter((d) => d.status === "Approved").length, color: "bg-emerald-400" },
    { label: "Published", count: data.drafts.filter((d) => d.status === "Published").length, color: "bg-blue-400" },
  ];
  const maxStatus = Math.max(...statusBreakdown.map((s) => s.count), 1);

  const docStatusBreakdown = [
    { label: "Ready", count: data.documents.filter((d) => d.status === "Ready").length, color: "bg-emerald-400" },
    { label: "Processing", count: data.documents.filter((d) => d.status === "Processing").length, color: "bg-amber-400" },
    { label: "Indexed", count: data.documents.filter((d) => d.status === "Indexed").length, color: "bg-sky-400" },
    { label: "Archived", count: data.documents.filter((d) => d.status === "Archived").length, color: "bg-slate-400" },
  ];

  // Weekly activity simulation
  const weeklyData = [
    { day: "Mon", value: 12 },
    { day: "Tue", value: 19 },
    { day: "Wed", value: 8 },
    { day: "Thu", value: 24 },
    { day: "Fri", value: 31 },
    { day: "Sat", value: 6 },
    { day: "Sun", value: 4 },
  ];
  const maxWeekly = Math.max(...weeklyData.map((d) => d.value));

  const topPosts = [...data.posts]
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 5);

  const metrics = [
    { label: "Total Documents", value: totalDocs, icon: FileText, color: "text-blue-600 bg-blue-50" },
    { label: "Total Drafts", value: totalDrafts, icon: PenSquare, color: "text-emerald-600 bg-emerald-50" },
    { label: "Posts Generated", value: totalPosts, icon: Sparkles, color: "text-violet-600 bg-violet-50" },
    { label: "Avg. Engagement", value: `${avgEngagement}/100`, icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Performance insights across your content, documents, and publishing pipeline.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))
          : metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-slate-900">{m.value}</p>
                      <p className="text-xs text-slate-500">{m.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Weekly Activity</h2>
          </div>
          <div className="flex h-48 items-end justify-between gap-2">
            {weeklyData.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-end justify-center" style={{ height: "160px" }}>
                  <div
                    className="w-full max-w-[2.5rem] rounded-t-lg bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-500 hover:from-blue-600 hover:to-blue-500"
                    style={{ height: `${(d.value / maxWeekly) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Draft Status Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Draft Status Breakdown</h2>
          </div>
          <div className="space-y-4">
            {statusBreakdown.map((s) => (
              <div key={s.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{s.label}</span>
                  <span className="text-slate-400">{s.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${s.color} transition-all duration-700`}
                    style={{ width: `${(s.count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs text-slate-400">AI-Generated Rate</p>
              <p className="text-xl font-bold text-slate-900">{aiRate}%</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Document Status + Top Posts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Document Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-5 text-sm font-semibold text-slate-800">Document Status</h2>
          <div className="grid grid-cols-2 gap-4">
            {docStatusBreakdown.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                  <span className="text-xs font-medium text-slate-600">{s.label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{s.count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Posts by Engagement */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Top Posts by Engagement</h2>
          </div>
          <div className="space-y-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)
              : topPosts.map((post, i) => (
                <div key={post.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{post.title}</p>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                        style={{ width: `${post.engagement_score}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-slate-600">{post.engagement_score}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Publishing Pipeline Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Publishing Pipeline</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-3xl font-bold text-slate-900">{totalDrafts}</p>
            <p className="mt-1 text-xs text-slate-500">Total Drafts</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{scheduledPosts}</p>
            <p className="mt-1 text-xs text-amber-600">Scheduled</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 text-center">
            <p className="text-3xl font-bold text-emerald-700">{publishedPosts}</p>
            <p className="mt-1 text-xs text-emerald-600">Published</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{avgEngagement}</p>
            <p className="mt-1 text-xs text-blue-600">Avg. Engagement</p>
          </div>
        </div>
      </div>
    </div>
  );
}
