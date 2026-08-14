import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Save,
  Wand2,
  Hash,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  FileText,
  Download,
  Type,
  Headphones,
  Megaphone,
  Mail,
  Newspaper,
  FileBarChart,
  MessageSquare,
  Send,
  Trash2,
  Minimize2,
  Maximize2,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { type Prompt } from "../lib/supabase";
import { type DocumentRow } from "../services/documents";
import {
  CONTENT_OBJECTIVES,
  AUDIENCE_OPTIONS,
  CONTENT_TYPE_PLATFORM,
  OUTPUT_LENGTHS,
  TONE_OPTIONS,
  type ContentObjective,
  type ContentType,
} from "../types/content";
import {
  generateContent,
  incrementPromptUses,
  saveGeneratedDraft,
  logGenerationActivity,
  buildGenerationPrompt,
  downloadAsMarkdown,
  type TransformationAction,
} from "../services/contentGenerator";
import { detectTemplatePlaceholders, getValidPromptDefaults, resolvePromptTemplate } from "../utils/promptTemplate";
import {
  summarizeOriginalResult,
  canRevertTransformation,
  type SuccessfulGenerationSnapshot,
} from "../utils/contentTransformation";
import { useContentTransformation } from "../hooks/useContentTransformation";

interface ContentGeneratorProps {
  prompts: Prompt[];
  documents: DocumentRow[];
  pendingPromptId: string | null;
  onPendingPromptHandled: () => void;
  onDraftCreated: () => void;
}

const contentTypeOptions: Array<{ label: ContentType; icon: typeof Megaphone }> = [
  { label: "LinkedIn Post", icon: Megaphone },
  { label: "Facebook Post", icon: MessageSquare },
  { label: "X Post", icon: Send },
  { label: "X Thread", icon: Send },
  { label: "Instagram Caption", icon: Hash },
  { label: "Press Release", icon: Newspaper },
  { label: "Newsletter", icon: Mail },
  { label: "Blog Article", icon: FileBarChart },
  { label: "Sales Email", icon: Mail },
];

export default function ContentGenerator({
  prompts,
  documents,
  pendingPromptId,
  onPendingPromptHandled,
  onDraftCreated,
}: ContentGeneratorProps) {
  const [contentType, setContentType] = useState<ContentType>("LinkedIn Post");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [audience, setAudience] = useState("Media Buyers");
  const [objective, setObjective] = useState<ContentObjective>("Inform");
  const [outputLength, setOutputLength] = useState<(typeof OUTPUT_LENGTHS)[number]>("Medium");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [generationAttribution, setGenerationAttribution] = useState<(SuccessfulGenerationSnapshot & {
    prompt: Prompt | null;
  }) | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(true);
  const [docSearch, setDocSearch] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const transformation = useContentTransformation();
  const transformationSession = transformation.session;
  const result = transformationSession.currentResult;
  const editableContent = transformationSession.editableContent;
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showToneSelector, setShowToneSelector] = useState(false);

  const applyTemplate = useCallback((prompt: Prompt) => {
    setSelectedPrompt(prompt);
    const defaults = getValidPromptDefaults(prompt);
    if (defaults.contentType) setContentType(defaults.contentType);
    if (defaults.audience) setAudience(defaults.audience);
    if (defaults.tone) setTone(defaults.tone);
    if (defaults.objective) setObjective(defaults.objective);
    if (defaults.outputLength) setOutputLength(defaults.outputLength);
  }, []);

  useEffect(() => {
    if (!pendingPromptId) return;
    const prompt = prompts.find((item) => item.id === pendingPromptId);
    if (prompt) applyTemplate(prompt);
    onPendingPromptHandled();
  }, [applyTemplate, onPendingPromptHandled, pendingPromptId, prompts]);

  const indexedDocs = useMemo(
    () => documents.filter((d) => d.status === "Indexed" || d.status === "Ready" || d.ai_status === "ready"),
    [documents],
  );

  const filteredDocs = useMemo(() => {
    if (!docSearch.trim()) return indexedDocs;
    const q = docSearch.toLowerCase();
    return indexedDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.summary || "").toLowerCase().includes(q) ||
        (d.keywords || []).some((k) => k.toLowerCase().includes(q)) ||
        d.category.toLowerCase().includes(q),
    );
  }, [indexedDocs, docSearch]);

  const selectedDocs = useMemo(
    () => indexedDocs.filter((d) => selectedDocIds.includes(d.id)),
    [indexedDocs, selectedDocIds],
  );

  const relevantPrompts = prompts.filter((p) => {
    if (contentType === "LinkedIn Post") return p.category === "LinkedIn";
    if (contentType === "Sales Email" || contentType === "Newsletter") return p.category === "Proposal" || p.category === "Strategy";
    return true;
  });

  const templateResolution = selectedPrompt
    ? resolvePromptTemplate(selectedPrompt.template, {
        topic: topic.trim(),
        audience,
        tone,
        objective,
        contentType,
        length: outputLength,
      })
    : null;
  const templatePlaceholders = selectedPrompt ? detectTemplatePlaceholders(selectedPrompt.template) : [];
  const unresolvedTemplatePlaceholders = templateResolution?.unresolvedPlaceholders ?? [];

  const isTransforming = transformationSession.status === "transforming";
  const canRevert = canRevertTransformation(transformationSession);
  const canGenerate = (topic.trim() || selectedDocIds.length > 0 || additionalInstructions.trim() || selectedPrompt)
    && !generating
    && !isTransforming;

  const transformationStatus: Record<TransformationAction, string> = {
    shorten: "Shortening...",
    expand: "Expanding...",
    change_tone: "Changing tone...",
    improve: "Improving...",
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (selectedPrompt && unresolvedTemplatePlaceholders.length > 0) {
      setError(`Resolve template placeholders before generating: ${unresolvedTemplatePlaceholders.map((item) => `{${item}}`).join(", ")}.`);
      return;
    }
    setGenerating(true);
    setError(null);
    setSourceNotice(null);
    setSaved(false);

    try {
      const params = {
        contentType,
        topic: topic.trim() || undefined,
        tone,
        audience,
        objective,
        outputLength,
        documentIds: selectedDocIds,
        templateInstructions: templateResolution?.text.trim() || undefined,
        additionalInstructions: additionalInstructions.trim() || undefined,
      };

      const generated = await generateContent(params);
      transformation.captureGeneration(generated);
      setGenerationAttribution({
        params: { ...params, documentIds: [...params.documentIds] },
        sourceUsage: {
          requestedIds: [...generated.sourceUsage.requestedIds],
          foundIds: [...generated.sourceUsage.foundIds],
          usableIds: [...generated.sourceUsage.usableIds],
          usedIds: [...generated.sourceUsage.usedIds],
          unavailableIds: [...generated.sourceUsage.unavailableIds],
          unusableIds: [...generated.sourceUsage.unusableIds],
        },
        prompt: selectedPrompt,
        resolvedTemplate: templateResolution?.text ?? null,
      });
      if (selectedPrompt) await incrementPromptUses(selectedPrompt.id);
      const unavailableCount = generated.sourceUsage.unavailableIds.length;
      const unusableCount = generated.sourceUsage.unusableIds.length;
      if (unavailableCount || unusableCount) {
        setSourceNotice([
          unavailableCount ? `${unavailableCount} selected document(s) were unavailable` : "",
          unusableCount ? `${unusableCount} selected document(s) had no usable extracted text` : "",
        ].filter(Boolean).join("; ") + ".");
      }

      // Log generation activity
      const wordCount = generated.content.split(/\s+/).filter(Boolean).length;
      await logGenerationActivity(contentType, topic, selectedDocIds.length, wordCount);
    } catch (err: any) {
      setError(err.message || "Failed to generate content. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTransform = async (action: TransformationAction, targetTone?: string) => {
    if (!result || !generationAttribution || isTransforming || generating) return;
    setError(null);
    setSaved(false);
    setShowToneSelector(false);
    try {
      const currentOutputTone = transformationSession.lineage.targetTone ?? generationAttribution.params.tone;
      await transformation.transform(
        generationAttribution,
        result,
        editableContent,
        action,
        targetTone,
        currentOutputTone,
      );
    } catch {
      // The transformation hook preserves the current result and exposes an actionable error.
    }
  };

  const handleRevertTransformation = () => {
    transformation.revert();
    setSaved(false);
    setShowToneSelector(false);
  };

  const handleSave = async () => {
    if (!result || !editableContent || !generationAttribution) return;
    setSaving(true);
    setError(null);

    try {
      const { params, prompt, resolvedTemplate } = generationAttribution;
      const title = (params.topic || result.headline || result.contentType).substring(0, 80);
      const wordCount = editableContent.split(/\s+/).filter(Boolean).length;
      const generationPrompt = buildGenerationPrompt({
        ...params,
        documentIds: result.sourceUsage.requestedIds,
      });

      await saveGeneratedDraft({
        title,
        content: editableContent,
        platform: CONTENT_TYPE_PLATFORM[params.contentType],
        wordCount,
        sourceDocumentIds: result.sourceUsage.usedIds,
        generationPrompt,
        tone: params.tone,
        targetAudience: params.audience,
        contentType: params.contentType,
        objective: params.objective,
        promptId: prompt?.id ?? null,
        generationConfig: {
          contentType: params.contentType,
          objective: params.objective,
          topic: params.topic ?? null,
          tone: params.tone,
          audience: params.audience,
          outputLength: params.outputLength,
          additionalInstructions: params.additionalInstructions ?? null,
          documentIds: [...result.sourceUsage.usedIds],
          requestedDocumentIds: [...result.sourceUsage.requestedIds],
          promptId: prompt?.id ?? null,
          template: prompt && resolvedTemplate !== null ? {
            promptId: prompt.id,
            name: prompt.name,
            resolvedText: resolvedTemplate,
            requestedDefaults: {
              contentType: prompt.content_type,
              audience: prompt.default_audience,
              tone: prompt.default_tone,
              objective: prompt.default_objective,
              outputLength: prompt.default_output_length,
            },
          } : null,
          transformation: {
            ...transformationSession.lineage,
            originalResult: summarizeOriginalResult(transformationSession.originalResult),
          },
          origin: "content-generator",
        },
        headline: result.headline,
        cta: result.cta,
        hashtags: result.hashtags,
      });

      setSaved(true);
      onDraftCreated();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (editableContent && !saved) {
      setShowClearConfirm(true);
      return;
    }
    doClear();
  };

  const doClear = () => {
    transformation.clear();
    setGenerationAttribution(null);
    setError(null);
    setSourceNotice(null);
    setSaved(false);
    setShowClearConfirm(false);
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const clearAllDocs = () => setSelectedDocIds([]);

  const handleDownload = () => {
    if (!result) return;
    const title = topic || result.headline || result.contentType;
    downloadAsMarkdown(title, editableContent, result.headline, result.cta, result.hashtags);
  };

  const wordCount = editableContent ? editableContent.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Content Generator</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate LinkedIn posts, ad copy, newsletters, and more — powered by AI with your knowledge base as context.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Configuration */}
        <div className="space-y-4 lg:col-span-2">
          {/* Content Type & Controls */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Configure Your Content</h2>

            {/* Content Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Content Type
              </label>
              <div className="flex flex-wrap gap-2">
                {contentTypeOptions.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.label}
                      onClick={() => setContentType(t.label)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        contentType === t.label
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic / Title */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Title / Topic (optional)
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
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
                {TONE_OPTIONS.map((t) => (
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

            {/* Target Audience */}
            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Hash className="h-3.5 w-3.5" /> Target Audience
              </label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCE_OPTIONS.map((a) => (
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

            {/* Objective */}
            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Target className="h-3.5 w-3.5" /> Objective
              </label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_OBJECTIVES.map((item) => (
                  <button
                    key={item}
                    onClick={() => setObjective(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      objective === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Output Length */}
            <div className="mt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Type className="h-3.5 w-3.5" /> Output Length
              </label>
              <div className="flex flex-wrap gap-2">
                {OUTPUT_LENGTHS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setOutputLength(l)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      outputLength === l ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Instructions */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Additional Instructions (optional)
              </label>
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
              disabled={!canGenerate}
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
            {!canGenerate && !generating && (
              <p className="mt-2 text-center text-xs text-slate-400">
                Enter a topic, select documents, or add instructions to generate
              </p>
            )}
          </div>

          {/* Knowledge Base Context */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <button onClick={() => setShowDocPicker(!showDocPicker)} className="flex w-full items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Knowledge Base Context</h2>
              {showDocPicker ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {selectedDocIds.length > 0 && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-blue-600">
                  {selectedDocIds.length} document{selectedDocIds.length !== 1 ? "s" : ""} selected as context
                </p>
                <button
                  onClick={clearAllDocs}
                  className="text-xs font-medium text-slate-400 transition hover:text-red-500"
                >
                  Clear all
                </button>
              </div>
            )}

            {showDocPicker && (
              <div className="mt-3">
                {/* Selected docs chips */}
                {selectedDocs.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {selectedDocs.map((doc) => (
                      <span
                        key={doc.id}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                      >
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[120px] truncate">{doc.title}</span>
                        <button
                          onClick={() => toggleDoc(doc.id)}
                          className="ml-0.5 rounded p-0.5 hover:bg-blue-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search documents..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Document list */}
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredDocs.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      {indexedDocs.length === 0
                        ? "No indexed documents available. Upload and process documents first."
                        : "No documents match your search"}
                    </p>
                  ) : (
                    filteredDocs.map((doc) => (
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
                          <div
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              selectedDocIds.includes(doc.id) ? "border-blue-500 bg-blue-500" : "border-slate-300"
                            }`}
                          >
                            {selectedDocIds.includes(doc.id) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-700">{doc.title}</p>
                            {doc.summary && (
                              <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{doc.summary}</p>
                            )}
                            {doc.keywords && doc.keywords.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {doc.keywords.slice(0, 3).map((kw) => (
                                  <span
                                    key={kw}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Prompt suggestions */}
          {selectedPrompt && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Selected Template</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-800">{selectedPrompt.name}</h2>
                  {templatePlaceholders.length > 0 && (
                    <p className="mt-2 text-xs text-slate-600">
                      Placeholders: {templatePlaceholders.map((item) => `{${item}}`).join(", ")}
                    </p>
                  )}
                  {unresolvedTemplatePlaceholders.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      Unresolved: {unresolvedTemplatePlaceholders.map((item) => `{${item}}`).join(", ")}
                    </p>
                  )}
                  {templatePlaceholders.length > 0 && unresolvedTemplatePlaceholders.length === 0 && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">All template variables resolved</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPrompt(null)}
                  className="shrink-0 rounded-lg p-1.5 text-blue-500 transition hover:bg-blue-100 hover:text-blue-700"
                  aria-label="Clear selected template"
                  title="Clear template"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {relevantPrompts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Suggested Prompts</h2>
              <div className="space-y-2">
                {relevantPrompts.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectedPrompt?.id === p.id ? setSelectedPrompt(null) : applyTemplate(p)}
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
              {result && !generating && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Markdown
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={isTransforming}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || isTransforming}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saved ? <Check className="h-3.5 w-3.5" /> : saving ? <Save className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
                    {saved ? "Saved!" : saving ? "Saving..." : "Save Draft"}
                  </button>
                </div>
              )}
            </div>

            {result && !generating && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Transform</span>
                <button
                  onClick={() => handleTransform("shorten")}
                  disabled={isTransforming}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Minimize2 className="h-3.5 w-3.5" /> Shorten
                </button>
                <button
                  onClick={() => handleTransform("expand")}
                  disabled={isTransforming}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Expand
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowToneSelector((open) => !open)}
                    disabled={isTransforming}
                    aria-expanded={showToneSelector}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Change Tone
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showToneSelector && !isTransforming && (
                    <div className="absolute left-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Current: {transformationSession.lineage.targetTone ?? generationAttribution?.params.tone}
                      </p>
                      {TONE_OPTIONS.map((option) => {
                        const currentTone = transformationSession.lineage.targetTone ?? generationAttribution?.params.tone;
                        return (
                          <button
                            key={option}
                            onClick={() => handleTransform("change_tone", option)}
                            disabled={option === currentTone}
                            className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleTransform("improve")}
                  disabled={isTransforming}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Improve
                </button>

                <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
                <button
                  onClick={handleGenerate}
                  disabled={isTransforming}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  title="Run a new full generation using the current controls"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </button>
                {canRevert && (
                  <button
                    onClick={handleRevertTransformation}
                    disabled={isTransforming}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Revert
                  </button>
                )}
                {isTransforming && transformationSession.activeAction && (
                  <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-blue-600" role="status">
                    <Wand2 className="h-3.5 w-3.5 animate-spin" />
                    {transformationStatus[transformationSession.activeAction]}
                  </span>
                )}
              </div>
            )}

            {(error || transformationSession.error) && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error || transformationSession.error}</span>
              </div>
            )}

            {sourceNotice && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{sourceNotice}</span>
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
            ) : result ? (
              <div className="space-y-4">
                {/* Headline */}
                {result.headline && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600">
                      <Headphones className="h-3.5 w-3.5" />
                      Suggested Headline / Hook
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">{result.headline}</p>
                  </div>
                )}

                {/* Editable content */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Content (editable)
                  </label>
                  <textarea
                    value={editableContent}
                    onChange={(e) => transformation.editContent(e.target.value)}
                    rows={16}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      {wordCount} words · {contentType}
                      {selectedDocIds.length > 0 && ` · ${selectedDocIds.length} source document${selectedDocIds.length !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                {result.cta && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                      <Megaphone className="h-3.5 w-3.5" />
                      Suggested Call to Action
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">{result.cta}</p>
                  </div>
                )}

                {/* Hashtags */}
                {result.hashtags.length > 0 && (
                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-600">
                      <Hash className="h-3.5 w-3.5" />
                      Suggested Hashtags
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-96 flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Sparkles className="h-8 w-8 text-slate-300" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">No content generated yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Enter a topic, optionally select knowledge base documents as context, and click Generate
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setShowClearConfirm(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Clear generated content?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  You have unsaved content. Clearing will discard it. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={doClear}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Clear content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
