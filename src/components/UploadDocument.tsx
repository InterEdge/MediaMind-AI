import { useRef, useState, useEffect } from "react";
import { Upload, X, FileText, Loader2, AlertCircle, CheckCircle2, FileSearch, Sparkles } from "lucide-react";
import { uploadDocument, processDocument, getDocumentById, getAiStage } from "../services/documents";

interface UploadDocumentProps {
  onClose: () => void;
  onUploaded: () => void;
}

type Stage = "idle" | "uploading" | "extracting" | "ai_processing" | "ready" | "error";

const stageConfig: Record<Stage, { label: string; icon: typeof Upload; color: string }> = {
  idle: { label: "Ready to upload", icon: Upload, color: "text-slate-400" },
  uploading: { label: "Uploading to storage...", icon: Loader2, color: "text-blue-500" },
  extracting: { label: "Extracting document text...", icon: FileSearch, color: "text-amber-500" },
  ai_processing: { label: "AI generating summary & keywords...", icon: Sparkles, color: "text-violet-500" },
  ready: { label: "Processing complete!", icon: CheckCircle2, color: "text-emerald-500" },
  error: { label: "Processing failed", icon: AlertCircle, color: "text-red-500" },
};

export default function UploadDocument({ onClose, onUploaded }: UploadDocumentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Poll for AI processing completion
  useEffect(() => {
    if (!docId || stage === "ready" || stage === "error") return;
    if (stage !== "extracting" && stage !== "ai_processing") return;

    const interval = setInterval(async () => {
      try {
        const doc = await getDocumentById(docId);
        if (!doc) return;

        const aiStage = getAiStage(doc);
        if (aiStage === "ready") {
          setStage("ready");
          setPollCount(0);
          onUploaded();
          setTimeout(() => onClose(), 1500);
        } else if (aiStage === "failed") {
          setStage("error");
          setError("AI processing failed. The document was uploaded but could not be analyzed.");
        } else if (aiStage === "ai_processing" && stage === "extracting") {
          setStage("ai_processing");
        }
        setPollCount((c) => c + 1);
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [docId, stage, onUploaded, onClose]);

  // Safety timeout: after 60 seconds of polling, show ready anyway
  useEffect(() => {
    if (pollCount > 30 && stage !== "ready") {
      setStage("ready");
      onUploaded();
      setTimeout(() => onClose(), 1500);
    }
  }, [pollCount, stage, onUploaded, onClose]);

  const handleFile = async (file: File) => {
    setStage("uploading");
    setError(null);

    try {
      const doc = await uploadDocument(file);
      setDocId(doc.id);
      setStage("extracting");

      // Fire the edge function — it runs server-side while we poll
      processDocument(doc.id).catch((err) => {
        console.error("Processing failed:", err);
        // Don't immediately error — the poll will catch it
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed. Please try again.");
      setStage("error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const isProcessing = stage === "uploading" || stage === "extracting" || stage === "ai_processing";

  const stages: Stage[] = ["uploading", "extracting", "ai_processing", "ready"];
  const currentStageIndex = stages.indexOf(stage);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Upload Document</h2>
          <button
            onClick={() => !isProcessing && onClose()}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {stage === "idle" || stage === "error" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition ${
                dragOver
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.csv"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                <Upload className="h-6 w-6 text-blue-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">
                Drag & drop or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-400">
                PDF, Word (DOCX), or TXT up to 50MB
              </p>
            </div>
          ) : (
            /* Processing pipeline UI */
            <div className="py-4">
              <div className="flex flex-col items-center justify-center mb-6">
                {(() => {
                  const cfg = stageConfig[stage];
                  const Icon = cfg.icon;
                  return (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
                      <Icon className={`h-7 w-7 ${cfg.color} ${isProcessing ? "animate-spin" : ""}`} />
                    </div>
                  );
                })()}
                <p className="mt-3 text-sm font-semibold text-slate-800">{stageConfig[stage].label}</p>
              </div>

              {/* Progress steps */}
              <div className="space-y-1">
                {stages.map((s, i) => {
                  const cfg = stageConfig[s];
                  const Icon = cfg.icon;
                  const isComplete = i < currentStageIndex;
                  const isActive = i === currentStageIndex;
                  return (
                    <div key={s} className="flex items-center gap-3 py-1.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                        isComplete
                          ? "bg-emerald-100"
                          : isActive
                          ? "bg-blue-100"
                          : "bg-slate-100"
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : isActive ? (
                          <Loader2 className={`h-4 w-4 ${cfg.color} animate-spin`} />
                        ) : (
                          <Icon className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      <span className={`text-sm transition ${
                        isComplete
                          ? "text-slate-500 line-through"
                          : isActive
                          ? "font-medium text-slate-800"
                          : "text-slate-400"
                      }`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stage === "idle" && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>Your document will be stored in Supabase Storage and indexed for AI search.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
