import { useState, useMemo } from "react";
import { Search, FileText, Sparkles, Trash2, Eye, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Draft } from "../lib/supabase";

interface DraftsProps {
  drafts: Draft[];
  loading: boolean;
  onRefresh: () => void;
}

export default function Drafts({ drafts, loading, onRefresh }: DraftsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState<Draft | null>(null);

  const statuses = ["All", "Draft", "In Review", "Approved", "Published"];

  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      const matchSearch = d.title.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [drafts, search, statusFilter]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Draft: "bg-slate-100 text-slate-600",
      "In Review": "bg-amber-100 text-amber-700",
      Approved: "bg-emerald-100 text-emerald-700",
      Published: "bg-blue-100 text-blue-700",
    };
    return map[status] ?? "bg-slate-100 text-slate-600";
  };

  const handleDelete = async (id: string) => {
    await supabase.from("drafts").delete().eq("id", id);
    onRefresh();
    setSelected(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Drafts</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your content drafts across all platforms.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drafts..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((draft) => (
            <div
              key={draft.id}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-slate-800">{draft.title}</h3>
                  {draft.ai_generated && (
                    <span className="flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                      <Sparkles className="h-2.5 w-2.5" /> AI
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{draft.platform}</span>
                  <span>·</span>
                  <span>{draft.word_count} words</span>
                  <span>·</span>
                  <span>{formatDate(draft.created_at)}</span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(draft.status)}`}>
                {draft.status}
              </span>
              <button
                onClick={() => setSelected(draft)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200">
              <p className="text-sm text-slate-400">No drafts found</p>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selected.title}</h3>
                  {selected.ai_generated && (
                    <span className="flex items-center gap-0.5 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-600">
                      <Sparkles className="h-3 w-3" /> AI Generated
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>{selected.platform}</span>
                  <span>·</span>
                  <span>{selected.word_count} words</span>
                  <span>·</span>
                  <span>{formatDate(selected.created_at)}</span>
                  <span>·</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${statusBadge(selected.status)}`}>{selected.status}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{selected.content}</pre>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => handleDelete(selected.id)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <div className="flex items-center gap-3">
                <button className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
                  Edit
                </button>
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
