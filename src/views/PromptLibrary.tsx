import { useState, useMemo } from "react";
import { Search, Star, Copy, Check, Library, Plus, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Prompt } from "../lib/supabase";

interface PromptLibraryProps {
  prompts: Prompt[];
  loading: boolean;
  onRefresh: () => void;
}

const categoryColors: Record<string, string> = {
  LinkedIn: "bg-blue-50 text-blue-700 ring-blue-100",
  Advertising: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Proposal: "bg-amber-50 text-amber-700 ring-amber-100",
  Strategy: "bg-violet-50 text-violet-700 ring-violet-100",
};

export default function PromptLibrary({ prompts, loading, onRefresh }: PromptLibraryProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Prompt | null>(null);
  const [copied, setCopied] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(prompts.map((p) => p.category));
    return ["All", ...Array.from(set)];
  }, [prompts]);

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchCat = category === "All" || p.category === category;
      return matchSearch && matchCat;
    });
  }, [prompts, search, category]);

  const toggleFavorite = async (prompt: Prompt) => {
    await supabase.from("prompts").update({ is_favorite: !prompt.is_favorite }).eq("id", prompt.id);
    onRefresh();
  };

  const handleCopy = (template: string) => {
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prompt Library</h1>
          <p className="mt-1 text-sm text-slate-500">Reusable AI prompt templates for content generation, analysis, and proposals.</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          New Prompt
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
            placeholder="Search prompts..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
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
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((prompt) => (
            <div
              key={prompt.id}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                  <Library className="h-5 w-5" />
                </div>
                <button
                  onClick={() => toggleFavorite(prompt)}
                  className="rounded-lg p-1.5 transition hover:bg-slate-100"
                >
                  <Star
                    className={`h-4 w-4 transition ${
                      prompt.is_favorite ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400"
                    }`}
                  />
                </button>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">{prompt.name}</h3>
              <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{prompt.description}</p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${categoryColors[prompt.category] ?? "bg-slate-50 text-slate-600 ring-slate-100"}`}>
                  {prompt.category}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-0.5 text-xs text-slate-400">
                    <TrendingUp className="h-3 w-3" />
                    {prompt.uses} uses
                  </span>
                  <button
                    onClick={() => setSelected(prompt)}
                    className="text-xs font-medium text-blue-600 transition hover:text-blue-700"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${categoryColors[selected.category] ?? "bg-slate-50 text-slate-600 ring-slate-100"}`}>
                    {selected.category}
                  </span>
                  <span className="text-xs text-slate-400">{selected.uses} uses</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm text-slate-400 transition hover:text-slate-700">
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm text-slate-600">{selected.description}</p>
              <h4 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Template</h4>
              <div className="rounded-xl bg-slate-50 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{selected.template}</pre>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => handleCopy(selected.template)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy Template"}
              </button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                Use Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
