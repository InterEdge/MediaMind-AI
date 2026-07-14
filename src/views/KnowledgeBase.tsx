import { useState, useMemo } from "react";
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

interface DocItem {
  id: string;
  name: string;
  category: string;
  type: "PDF" | "Word" | "Presentation";
  fileSize: string;
  dateUploaded: string;
  status: "Indexed" | "Processing" | "Ready";
  summary: string;
  keywords: string[];
  aiStatus: string;
}

const sampleDocs: DocItem[] = [
  {
    id: "1",
    name: "TVC Communications Rate Card 2026",
    category: "Rate Cards",
    type: "PDF",
    fileSize: "3.2 MB",
    dateUploaded: "2026-07-12",
    status: "Ready",
    summary:
      "Comprehensive rate card covering TVC Communications' full media inventory for 2026, including prime time slots, regional breakdowns, package pricing tiers, and volume discount structures. Updated with Q1 market corrections.",
    keywords: ["rate card", "TVC", "media buying", "pricing", "2026", "television"],
    aiStatus: "Indexed — ready for AI search",
  },
  {
    id: "2",
    name: "Media Buying Guide",
    category: "Guides",
    type: "PDF",
    fileSize: "5.1 MB",
    dateUploaded: "2026-07-10",
    status: "Indexed",
    summary:
      "Step-by-step media buying guide covering audience targeting, bid strategy, frequency capping, cross-platform optimization, and post-campaign measurement. Includes 12 case studies and benchmark data.",
    keywords: ["media buying", "guide", "optimization", "targeting", "benchmarks"],
    aiStatus: "Indexed — ready for AI search",
  },
  {
    id: "3",
    name: "Advertising Sales Playbook",
    category: "Playbooks",
    type: "Word",
    fileSize: "2.8 MB",
    dateUploaded: "2026-07-08",
    status: "Indexed",
    summary:
      "Internal sales playbook for advertising teams. Covers objection handling, pricing negotiation frameworks, upsell strategies, and client retention protocols. Includes scripts for common client scenarios.",
    keywords: ["sales", "playbook", "advertising", "negotiation", "retention"],
    aiStatus: "Indexed — ready for AI search",
  },
  {
    id: "4",
    name: "FMCG Campaign Case Study",
    category: "Case Studies",
    type: "PDF",
    fileSize: "4.5 MB",
    dateUploaded: "2026-07-05",
    status: "Indexed",
    summary:
      "Detailed case study of a fast-moving consumer goods campaign across digital and traditional channels. Covers strategy, creative approach, media mix, KPIs, and post-campaign ROI analysis with 34% lift in brand recall.",
    keywords: ["FMCG", "case study", "campaign", "ROI", "brand recall", "digital"],
    aiStatus: "Indexed — ready for AI search",
  },
  {
    id: "5",
    name: "LinkedIn Marketing Notes",
    category: "Notes",
    type: "Word",
    fileSize: "1.2 MB",
    dateUploaded: "2026-07-03",
    status: "Processing",
    summary:
      "Working notes from LinkedIn marketing strategy sessions. Covers audience segmentation, content pillars, ad format preferences, and engagement patterns observed across B2B campaigns in Q2.",
    keywords: ["LinkedIn", "marketing", "B2B", "content strategy", "engagement"],
    aiStatus: "Processing — AI indexing in progress",
  },
  {
    id: "6",
    name: "TV Sponsorship Proposal Template",
    category: "Templates",
    type: "Presentation",
    fileSize: "8.7 MB",
    dateUploaded: "2026-06-28",
    status: "Ready",
    summary:
      "Reusable sponsorship proposal template for television partnerships. Includes audience demographics slides, package tiers, integration examples, and ROI projection charts. Fully customizable with brand guidelines.",
    keywords: ["sponsorship", "template", "TV", "proposal", "partnership"],
    aiStatus: "Indexed — ready for AI search",
  },
  {
    id: "7",
    name: "Programmatic Advertising Report Q1",
    category: "Reports",
    type: "PDF",
    fileSize: "6.3 MB",
    dateUploaded: "2026-06-25",
    status: "Indexed",
    summary:
      "Q1 programmatic advertising performance report with DSP comparisons, CTR benchmarks, viewability metrics, and fraud detection analysis. Covers display, native, and video inventory across 14 markets.",
    keywords: ["programmatic", "Q1", "report", "DSP", "viewability", "benchmarks"],
    aiStatus: "Indexed — ready for AI search",
  },
  {
    id: "8",
    name: "Brand Strategy Framework",
    category: "Frameworks",
    type: "Word",
    fileSize: "2.1 MB",
    dateUploaded: "2026-06-20",
    status: "Ready",
    summary:
      "Strategic framework for brand positioning, messaging architecture, and competitive differentiation. Includes brand pyramid model, voice guidelines, and a decision tree for brand extension scenarios.",
    keywords: ["brand strategy", "framework", "positioning", "messaging", "framework"],
    aiStatus: "Indexed — ready for AI search",
  },
  {
    id: "9",
    name: "Social Media Analytics Dashboard",
    category: "Dashboards",
    type: "Presentation",
    fileSize: "12.4 MB",
    dateUploaded: "2026-06-18",
    status: "Processing",
    summary:
      "Presentation deck with social media analytics dashboards covering engagement rates, follower growth, content performance, and audience demographics across Meta, LinkedIn, TikTok, and X platforms.",
    keywords: ["social media", "analytics", "dashboard", "engagement", "demographics"],
    aiStatus: "Processing — AI indexing in progress",
  },
  {
    id: "10",
    name: "Creative Brief Template",
    category: "Templates",
    type: "Word",
    fileSize: "0.8 MB",
    dateUploaded: "2026-06-15",
    status: "Indexed",
    summary:
      "Standardized creative brief template for advertising campaigns. Includes sections for objectives, target audience, key messaging, deliverables, timeline, and budget. Designed for cross-team alignment.",
    keywords: ["creative brief", "template", "campaign", "deliverables"],
    aiStatus: "Indexed — ready for AI search",
  },
];

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
  const [docs, setDocs] = useState<DocItem[]>(sampleDocs);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "alpha">("newest");
  const [selected, setSelected] = useState<DocItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DocItem | null>(null);

  const categories = useMemo(() => {
    const set = new Set(docs.map((d) => d.category));
    return ["All", ...Array.from(set)];
  }, [docs]);

  const types = ["All", "PDF", "Word", "Presentation"];

  const filtered = useMemo(() => {
    let result = docs.filter((d) => {
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase()));
      const matchType = typeFilter === "All" || d.type === typeFilter;
      const matchCat = categoryFilter === "All" || d.category === categoryFilter;
      return matchSearch && matchType && matchCat;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime();
      if (sortBy === "oldest") return new Date(a.dateUploaded).getTime() - new Date(b.dateUploaded).getTime();
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

  const handleDelete = (doc: DocItem) => {
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
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98]">
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
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Document</th>
                    <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:table-cell">Category</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                    <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 md:table-cell">Size</th>
                    <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 md:table-cell">Uploaded</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                        No documents match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((doc) => {
                      const ti = typeIcon(doc.type);
                      const TypeIcon = ti.icon;
                      const sb = statusBadge(doc.status);
                      const StatusIcon = sb.icon;
                      const isSelected = selected?.id === doc.id;
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelected(doc)}
                          className={`cursor-pointer transition hover:bg-slate-50 ${
                            isSelected ? "bg-blue-50/60" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${ti.color}`}>
                                <TypeIcon className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-medium text-slate-800 line-clamp-1">{doc.name}</span>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 sm:table-cell">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {doc.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{doc.type}</td>
                          <td className="hidden px-4 py-3 text-sm text-slate-500 md:table-cell">{doc.fileSize}</td>
                          <td className="hidden px-4 py-3 text-sm text-slate-500 md:table-cell">{formatDate(doc.dateUploaded)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${sb.class}`}>
                              <StatusIcon className="h-3 w-3" />
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelected(doc); }}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                title="Edit Metadata"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(doc); }}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Delete"
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
          </div>
        </div>

        {/* Right: Preview Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {selected ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                {/* File header */}
                <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ${typeIcon(selected.type).color}`}>
                    {(() => {
                      const Icon = typeIcon(selected.type).icon;
                      return <Icon className="h-6 w-6" />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{selected.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">{selected.type} · {selected.fileSize}</p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* File info */}
                <div className="space-y-3 py-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">File Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400">Size</p>
                        <p className="text-xs font-medium text-slate-700">{selected.fileSize}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400">Uploaded</p>
                        <p className="text-xs font-medium text-slate-700">{formatDate(selected.dateUploaded)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <Tag className="h-3.5 w-3.5 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400">Category</p>
                        <p className="text-xs font-medium text-slate-700">{selected.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400">Type</p>
                        <p className="text-xs font-medium text-slate-700">{selected.type}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-slate-100 py-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Summary</h4>
                  <p className="text-sm leading-relaxed text-slate-600">{selected.summary}</p>
                </div>

                {/* Keywords */}
                <div className="border-t border-slate-100 py-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Hash className="h-3.5 w-3.5" /> Keywords
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.keywords.map((kw) => (
                      <span key={kw} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Categories */}
                <div className="border-t border-slate-100 py-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Categories</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{selected.category}</span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{selected.type}</span>
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
                    <span className="text-xs font-medium">{selected.aiStatus}</span>
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
                  Are you sure you want to delete <span className="font-medium text-slate-700">"{deleteConfirm.name}"</span>? This action cannot be undone.
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
    </div>
  );
}
