import { useState, useMemo, useEffect } from "react";
import UploadDocument from "../components/UploadDocument"; 
import {
  FileText,
  FileType2,
  Presentation,
  Upload,
  Search,
  Eye,
  Pencil,
  Trash2,
  Sparkles,
  FileCheck2,
  Loader2,
  X,
  Brain,
  Calendar,
  HardDrive,
  Tag,
  Hash,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
 
interface DocItem extends SupabaseDocument {
  // Add any additional fields specific to DocItem if needed, or remove if SupabaseDocument is sufficient
}
 
const typeIcon = (type: string) => {
  switch (type) {
    case "PDF":
      return { icon: FileType2, color: "text-red-500 bg-red-50 ring-red-100" };
    case "Word":
      return { icon: FileText, color: "text-blue-500 bg-blue-50 ring-blue-100" };
    case "Presentation":
      return { icon: Presentation, color: "text-amber-500 bg-amber-50 ring-amber-100" };
    default:
      return { icon: FileText, color: "text-slate-500 bg-slate-50 ring-slate-100" };
  }
};
 
const statusBadge = (status: string) => {
  switch (status) {
    case "Indexed":
      return { class: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
    case "Processing":
      return { class: "bg-amber-100 text-amber-700", icon: Clock };
    case "Ready":
      return { class: "bg-sky-100 text-sky-700", icon: FileCheck2 };
    default:
      return { class: "bg-slate-100 text-slate-600", icon: AlertCircle };
  }
};
 
const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
 
export default function KnowledgeBase() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "alpha">("newest");
  const [selected, setSelected] = useState<DocItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DocItem | null>(null);
 
  const loadDocuments = async () => {
    setLoading(true);
    try {
      const fetchedDocs = await fetchDocuments();
      setDocs(fetchedDocs as DocItem[]); // Cast to DocItem[] if SupabaseDocument is compatible
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    loadDocuments();
  }, []);
 
  const categories = useMemo(() => {
    const set = new Set(docs.map((d) => d.category));
    return ["All", ...Array.from(set)];
  }, [docs]);
 
  const types = ["All", "PDF", "Word", "Presentation", "UNKNOWN"]; // Added UNKNOWN for files without extension
 
  const filtered = useMemo(() => {
    let result = docs.filter((d) => {
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.tags.some((k) => k.toLowerCase().includes(search.toLowerCase()));
      const matchType = typeFilter === "All" || d.type === typeFilter;
      const matchCat = categoryFilter === "All" || d.category === categoryFilter;
      return matchSearch && matchType && matchCat;
    });
 
    result = [...result].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      if (sortBy === "oldest") return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
      return a.name.localeCompare(b.name);
    });
 
    return result;
  }, [docs, search, typeFilter, categoryFilter, sortBy]);
 
  const stats = {
    total: docs.length,
    pdfs: docs.filter((d) => d.type === "PDF").length,
    word: docs.filter((d) => d.type === "Word").length,
    presentations: docs.filter((d) => d.type === "Presentation").length,
    indexed: docs.filter((d) => d.status === "Indexed").length,
  };
 
  const statCards = [
    { label: "Total Documents", value: stats.total, icon: FileText, color: "bg-blue-50 text-blue-600 ring-blue-100" },
    { label: "PDFs", value: stats.pdfs, icon: FileType2, color: "bg-red-50 text-red-500 ring-red-100" },
    { label: "Word Documents", value: stats.word, icon: FileText, color: "bg-sky-50 text-sky-600 ring-sky-100" },
    { label: "Presentations", value: stats.presentations, icon: Presentation, color: "bg-amber-50 text-amber-600 ring-amber-100" },
    { label: "Indexed Documents", value: stats.indexed, icon: FileCheck2, color: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  ];
 
  const handleDelete = async (doc: DocItem) => {
    // Implement Supabase delete logic here
    // For now, just filter from local state
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    if (selected?.id === doc.id) setSelected(null);
    setDeleteConfirm(null);
  };
 
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Knowledge Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your AI knowledge library for media, advertising and marketing.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>
 
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:border-slate-300 hover:shadow-md"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${stat.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>
 
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Search + Table */}
        <div className="space-y-4 lg:col-span-2">
          {/* Search & Filters */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents by name or keyword..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Type filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="shrink-0 text-xs font-medium text-slate-400">Type:</span>
                  {types.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                        typeFilter === t
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {/* Category filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>
                  ))}
                </select>
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "alpha")}
                  className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>
 
          {/* Document Table */}
          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Document</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                    <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell">Category</th>
                    <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell">Size</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4"><div className="h-4 w-48 animate-pulse rounded bg-slate-100" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                        <td className="hidden px-5 py-4 sm:table-cell"><div className="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                        <td className="hidden px-5 py-4 sm:table-cell"><div className="h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
                        <td className="px-5 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" /></td>
                        <td className="px-5 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" /></td>
                      </tr>
                    ))
                  ) : (
                    filtered.map((doc) => {
                      const { icon: TypeIcon, color: typeColor } = typeIcon(doc.type);
                      const { class: statusClass, icon: StatusIcon } = statusBadge(doc.status);
                      return (
                        <tr key={doc.id} className="group transition hover:bg-slate-50">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${typeColor}`}>
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-medium text-slate-800">{doc.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-500">{doc.type}</td>
                          <td className="hidden px-5 py-3.5 text-sm text-slate-500 sm:table-cell">{doc.category}</td>
                          <td className="hidden px-5 py-3.5 text-sm text-slate-500 sm:table-cell">{doc.file_size}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                              <StatusIcon className="h-3 w-3" />
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelected(doc)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                                title="View Document"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(doc)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                                title="Delete Document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filtered.length === 0 && (
              <div className="p-5 text-center text-sm text-slate-500">
                No documents found matching your criteria.
              </div>
            )}
          </div>
        </div>
 
        {/* Right: Document Details / AI Section */}
        <div className="space-y-4 lg:col-span-1">
          {selected ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">Uploaded: {formatDate(selected.uploaded_at)}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  title="Close Details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
 
              <div className="mt-4 space-y-4">
                {/* File Info */}
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeIcon(selected.type).color}`}>
                    {(() => {
  const Icon = typeIcon(selected.type).icon;
  return <Icon className="h-5 w-5" />;
})()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{selected.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{selected.file_size}</span>
                      <span>·</span>
                      <span>{selected.type}</span>
                    </div>
                  </div>
                </div>
 
                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-400">Category</p>
                    <p className="text-xs font-medium text-slate-700">{selected.category}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-400">Type</p>
                    <p className="text-xs font-medium text-slate-700">{selected.type}</p>
                  </div>
                </div>
              </div>
 
              {/* Summary */}
              <div className="border-t border-slate-100 py-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Summary</h4>
                <p className="text-sm leading-relaxed text-slate-600">{selected.summary || "No summary available."}</p>
              </div>
 
              {/* Keywords */}
              <div className="border-t border-slate-100 py-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Hash className="h-3.5 w-3.5" /> Keywords
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.length > 0 ? (
                    selected.tags.map((kw) => (
                      <span key={kw} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No keywords available.</span>
                  )}
                </div>
              </div>
 
              {/* AI Status */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Sparkles className="h-3.5 w-3.5" /> AI Status
                </h4>
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${
                  selected.status === "Indexed"
                    ? "bg-emerald-50 text-emerald-700"
                    : selected.status === "Processing"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-sky-50 text-sky-700"
                }`}>
                  {selected.status === "Processing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium">{selected.status}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <FileText className="h-7 w-7 text-slate-300" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">No document selected</p>
                <p className="mt-1 text-xs text-slate-400">Select a document from the table to preview its details</p>
              </div>
            </div>
          )}
 
          {/* Future AI Section */}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500">AI Knowledge Search</h3>
                <p className="text-xs text-slate-400">Coming Soon</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Ask questions across all your indexed documents. AI will search, synthesize, and cite sources from your knowledge library.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400">
              <Sparkles className="h-3 w-3" />
              Disabled — Coming Soon
            </div>
          </div>
        </div>
      </div>
 
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Document?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Are you sure you want to delete <span className="font-medium text-slate-700">\"{deleteConfirm.name}\"</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showUpload && (
        <UploadDocument
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            loadDocuments(); // Reload documents after successful upload
          }}
        />
      )}
    </div>
  );
}
