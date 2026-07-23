import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Save,
  Wand2,
  Hash,
  Target,
  Zap,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { supabase, type Prompt, type Draft } from "../lib/supabase";
import { getDocuments, type DocumentRow } from "../services/documents";

interface ContentGeneratorProps {
  prompts: Prompt[];
  documents: DocumentRow[];
  onDraftCreated: () => void;
}

const contentTypeOptions = [
  "LinkedIn Post",
  "Twitter Thread",
  "Newsletter",
  "Sales Email",
  "Blog Post",
  "Ad Copy",
];

const toneOptions = ["Professional", "Conversational", "Authoritative", "Inspirational", "Analytical"];
const audienceOptions = ["Media Buyers", "Agency Leaders", "Brand Marketers", "Ad Tech Professionals", "CMOs"];

const platformMap: Record<string, string> = {
  "LinkedIn Post": "LinkedIn",
  "Twitter Thread": "Twitter",
  "Newsletter": "Email",
  "Sales Email": "Email",
  "Blog Post": "Blog",
  "Ad Copy": "Advertising",
};

export default function ContentGenerator({ prompts, documents, onDraftCreated }: ContentGeneratorProps) {
  const [contentType, setContentType] = useState("LinkedIn Post");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [audience, setAudience] = useState("Media Buyers");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const indexedDocs = documents.filter((d) => d.status === "Indexed" || d.status === "Ready");
  const relevantPrompts = prompts.filter((p) => {
    if (contentType === "LinkedIn Post") return p.category === "LinkedIn";
    if (contentType === "Ad Copy") return p.category === "Advertising";
    if (contentType === "Sales Email" || contentType === "Newsletter") return p.category === "Proposal" || p.category === "Strategy";
    return true;
  });

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setOutput("");
    setError(null);
    setSaved(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          contentType,
          topic,
          tone,
          audience,
          documentIds: selectedDocIds,
          promptTemplate: selectedPrompt?.template || undefined,
          additionalInstructions: additionalInstructions.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setOutput(data.content);
    } catch (err: any) {
      setError(err.message || "Failed to generate content. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!output) return;
    setSaving(true);
    const title = topic.length > 60 ? topic.substring(0, 60) + "..." : topic;
    const wordCount = output.split(/\s+/).length;

    const { error: insertError } = await supabase.from("drafts").insert({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      content: output,
      platform: platformMap[contentType] || "LinkedIn",
      status: "Draft",
      word_count: wordCount,
      ai_generated: true,
    });

    if (insertError) {
      setError("Failed to save draft: " + insertError.message);
      setSaving(false);
      return;
    }

    await supabase.from("activities").insert({
      type: "generate",
      description: `AI generated ${contentType}: "${title}"`,
      metadata: { platform: platformMap[contentType], word_count: wordCount, content_type: contentType },
    });

    setSaving(false);
    setSaved(true);
    onDraftCreated();
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Content Generator</h1>
        <p className="mt-1 text-sm text-slate-500">Generate LinkedIn posts, ad copy, newsletters, and more — powered by AI with your knowledge base as context.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Configuration */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Configure Your Content</h2>

            {/* Content Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Content Type</label>
              <div className="flex flex-wrap gap-2">
                {contentTypeOptions.map((t) => (
                  <button
                    key={t}
                    onClick={() => setContentType(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      contentType === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                placeholder="e.g. Programmatic advertising trends in 2025"
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Tone */}
            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Target className="h-3.5 w-3.5" /> Tone
              </label>
              <div className="flex flex-wrap gap-2">
                {toneOptions.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      tone === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Hash className="h-3.5 w-3.5" /> Target Audience
              </label>
              <div className="flex flex-wrap gap-2">
                {audienceOptions.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      audience === a ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Instructions */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Additional Instructions (optional)</label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Keep it under 150 words, mention our DSP partnership..."
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Wand2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate {contentType}
                </>
              )}
            </button>
          </div>

          {/* Knowledge Base Context */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <button
              onClick={() => setShowDocPicker(!showDocPicker)}
              className="flex w-full items-center justify-between"
            >
              <h2 className="text-sm font-semibold text-slate-800">Knowledge Base Context</h2>
              {showDocPicker ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {selectedDocIds.length > 0 && (
              <p className="mt-1 text-xs text-blue-600">{selectedDocIds.length} document{selectedDocIds.length !== 1 ? "s" : ""} selected as context</p>
            )}
            {showDocPicker && (
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {indexedDocs.length === 0 ? (
                  <p className="text-xs text-slate-400">No indexed documents available. Upload and process documents first.</p>
                ) : (
                  indexedDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => toggleDoc(doc.id)}
                      className={`block w-full rounded-lg border p-3 text-left transition ${
                        selectedDocIds.includes(doc.id)
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedDocIds.includes(doc.id) ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}>
                          {selectedDocIds.includes(doc.id) && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-700">{doc.title}</p>
                          {doc.summary && <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{doc.summary}</p>}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Prompt suggestions */}
          {relevantPrompts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Suggested Prompts</h2>
              <div className="space-y-2">
                {relevantPrompts.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPrompt(selectedPrompt?.id === p.id ? null : p)}
                    className={`block w-full rounded-lg border p-3 text-left transition ${
                      selectedPrompt?.id === p.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">{p.name}</p>
                      {selectedPrompt?.id === p.id && <Check className="h-3.5 w-3.5 text-blue-600" />}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Output */}
        <div className="lg:col-span-3">
          <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Generated Output</h2>
              {output && !generating && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saved ? <Check className="h-3.5 w-3.5" /> : saving ? <Save className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
                    {saved ? "Saved!" : saving ? "Saving..." : "Save Draft"}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {generating ? (
              <div className="flex h-96 flex-col items-center justify-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                    <Wand2 className="h-8 w-8 animate-pulse text-blue-600" />
                  </div>
                  <div className="absolute -inset-2 animate-ping rounded-2xl border-2 border-blue-200 opacity-40" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">Crafting your {contentType.toLowerCase()}...</p>
                <p className="mt-1 text-xs text-slate-400">Analyzing tone, audience, and topic context with AI</p>
              </div>
            ) : output ? (
              <div className="rounded-xl bg-slate-50 p-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{output}</pre>
                <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-slate-400">
                    {output.split(/\s+/).length} words · {contentType}
                    {selectedDocIds.length > 0 && ` · ${selectedDocIds.length} source document${selectedDocIds.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-96 flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Sparkles className="h-8 w-8 text-slate-300" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">No content generated yet</p>
                <p className="mt-1 text-xs text-slate-400">Enter a topic, optionally select knowledge base documents as context, and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
