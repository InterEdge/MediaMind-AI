import { useState, useMemo } from "react";
import { FileText, Search, Filter, Upload, Download, Eye, BookOpen } from "lucide-react";
import type { Document } from "../lib/supabase";

interface KnowledgeBaseProps {
  documents: Document[];
  loading: boolean;
}

export default function KnowledgeBase({ documents, loading }: KnowledgeBaseProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Document | null>(null);

  const categories = useMemo(() => {
    const set = new Set(documents.map((d) => d.category));
    return ["All", ...Array.from(set)];
  }, [documents]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch =
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchCat = category === "All" || d.category === category;
      return matchSearch && matchCat;
    });
  }, [documents, search, category]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Ready: "bg-emerald-100 text-emerald-700",
      Processing: "bg-amber-100 text-amber-700",
      Indexed: "bg-sky-100 text-sky-700",
      Archived: "bg-slate-100 text-slate-500",
    };
    return map[status] ?? "bg-slate-100 text-slate-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Knowledge Base</h1>
          <p className="mt-1 text-sm text-slate-500">Your AI-indexed library of advertising knowledge, case studies, and playbooks.</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98]">
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or tag..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 shrink-0 text-slate-400" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                category === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
              onClick={() => setSelected(doc)}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <FileText className="h-5 w-5" />
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(doc.status)}`}>
                  {doc.status}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-800 line-clamp-2">{doc.title}</h3>
              <p className="mt-2 text-xs text-slate-500 line-clamp-2">{doc.summary}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{doc.type}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{doc.category}</span>
                </div>
                <span className="text-xs text-slate-400">{doc.file_size}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selected.title}</h3>
                  <p className="text-sm text-slate-400">{selected.type} · {selected.category} · {selected.file_size}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(selected.status)}`}>
                {selected.status}
              </span>
            </div>
            <div className="px-6 py-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Summary</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{selected.summary}</p>
              <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Tags</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
                <Download className="h-4 w-4" /> Download
              </button>
              <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                <Eye className="h-4 w-4" /> View Full Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
