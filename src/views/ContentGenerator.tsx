import { useState } from "react";
import { Sparkles, Copy, Check, Save, Wand2, Hash, Target, Zap } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Prompt, Draft } from "../lib/supabase";

interface ContentGeneratorProps {
  prompts: Prompt[];
  drafts: Draft[];
  onCreated: () => void;
}

const toneOptions = ["Professional", "Conversational", "Authoritative", "Inspirational", "Analytical"];
const audienceOptions = ["Media Buyers", "Agency Leaders", "Brand Marketers", "Ad Tech Professionals", "CMOs"];

export default function ContentGenerator({ prompts, onCreated }: ContentGeneratorProps) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [audience, setAudience] = useState("Media Buyers");
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const linkedinPrompts = prompts.filter((p) => p.category === "LinkedIn");

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setOutput("");
    setSaved(false);

    // Simulate AI generation with realistic content
    await new Promise((r) => setTimeout(r, 1500));

    const generated = `${topic.charAt(0).toUpperCase() + topic.slice(1)} is reshaping how media professionals think about their craft.

After analyzing 200+ campaigns across the industry, three patterns stand out:

1. Data-driven creative decisions outperform gut-based ones by 3.2x
2. Cross-platform consistency increases brand recall by 47%
3. AI-assisted content generation cuts production time by 60%

The brands winning right now aren't the ones with the biggest budgets. They're the ones with the smartest systems.

What's your approach to ${topic.toLowerCase()} in 2025?

#MediaStrategy #${audience.replace(/\s/g, "")} #Advertising

— Generated with a ${tone} tone for ${audience}`;

    setOutput(generated);
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!output) return;
    setSaving(true);
    await supabase.from("drafts").insert({
      title: topic.charAt(0).toUpperCase() + topic.slice(1),
      content: output,
      platform: "LinkedIn",
      status: "Draft",
      word_count: output.split(/\s+/).length,
      ai_generated: true,
    });
    // Log activity
    await supabase.from("activities").insert({
      type: "generate",
      description: `AI generated LinkedIn post "${topic.charAt(0).toUpperCase() + topic.slice(1)}"`,
      metadata: { platform: "LinkedIn", word_count: output.split(/\s+/).length },
    });
    setSaving(false);
    setSaved(true);
    onCreated();
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Content Generator</h1>
        <p className="mt-1 text-sm text-slate-500">Generate LinkedIn posts, ad copy, and media proposals powered by AI.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Input */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Configure Your Post</h2>

            {/* Topic */}
            <div>
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
                  Generate Post
                </>
              )}
            </button>
          </div>

          {/* Prompt suggestions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Suggested Prompts</h2>
            <div className="space-y-2">
              {linkedinPrompts.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPrompt(p)}
                  className={`block w-full rounded-lg border p-3 text-left transition ${
                    selectedPrompt?.id === p.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-700">{p.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="lg:col-span-3">
          <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Generated Output</h2>
              {output && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
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

            {generating ? (
              <div className="flex h-96 flex-col items-center justify-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                    <Wand2 className="h-8 w-8 animate-pulse text-blue-600" />
                  </div>
                  <div className="absolute -inset-2 animate-ping rounded-2xl border-2 border-blue-200 opacity-40" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-600">Crafting your post...</p>
                <p className="mt-1 text-xs text-slate-400">Analyzing tone, audience, and topic context</p>
              </div>
            ) : output ? (
              <div className="rounded-xl bg-slate-50 p-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{output}</pre>
                <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-slate-400">
                    {output.split(/\s+/).length} words · Engagement score: {Math.floor(70 + Math.random() * 25)}/100
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-96 flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Sparkles className="h-8 w-8 text-slate-300" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">No content generated yet</p>
                <p className="mt-1 text-xs text-slate-400">Enter a topic and click Generate to create AI-powered content</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
