import { useState, useEffect, useCallback } from "react";
import { X, FileEdit, Check, Loader2, ExternalLink } from "lucide-react";

interface CreateDraftModalProps {
  open: boolean;
  content: string;
  sourceDocumentIds: string[];
  onClose: () => void;
  onSave: (params: { title: string; platform: string }) => Promise<void>;
  onOpenDrafts?: () => void;
}

const PLATFORMS = [
  "LinkedIn",
  "Facebook",
  "X",
  "Instagram",
  "Blog",
  "Newsletter",
  "General",
];

export default function CreateDraftModal({
  open,
  content,
  sourceDocumentIds,
  onClose,
  onSave,
  onOpenDrafts,
}: CreateDraftModalProps) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("LinkedIn");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(`AI Assistant Answer — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
      setPlatform("LinkedIn");
      setSaved(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, saving, onClose]);

  const handleSave = useCallback(async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), platform });
      setSaved(true);
    } catch (err: any) {
      setError(err.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }, [title, platform, saving, onSave]);

  if (!open) return null;

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !saving && !saved && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create draft from AI answer"
      >
        {saved ? (
          <div className="flex flex-col items-center p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Draft saved!</h3>
            <p className="mt-1 text-sm text-slate-500">
              Your draft has been saved to the Drafts page with {wordCount} words and {sourceDocumentIds.length} source document{sourceDocumentIds.length !== 1 ? "s" : ""}.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {onOpenDrafts && (
                <button
                  onClick={onOpenDrafts}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Drafts
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <FileEdit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Draft</h3>
                  <p className="text-xs text-slate-500">{wordCount} words · {sourceDocumentIds.length} source{sourceDocumentIds.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Draft Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-100"
                  placeholder="Enter a title for this draft..."
                  aria-label="Draft title"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Platform
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                        platform === p
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      aria-pressed={platform === p}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || saving}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileEdit className="h-4 w-4" />
                    Save Draft
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
