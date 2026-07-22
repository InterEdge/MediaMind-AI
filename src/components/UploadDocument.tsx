import { useRef, useState } from "react";
import { Upload, X, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { uploadDocument, processDocument } from "../services/documents";

interface UploadDocumentProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDocument({ onClose, onUploaded }: UploadDocumentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const doc = await uploadDocument(file);
      setIsUploading(false);
      setIsProcessing(true);
      // Fire and forget — the edge function processes asynchronously.
      // We don't block the UI on AI processing; the Knowledge Base will
      // refresh and show the document. Processing completes server-side.
      processDocument(doc.id).catch((err) => console.error("Processing failed:", err));
      setSuccess(true);
      setTimeout(() => {
        onUploaded();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={() => !isUploading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Upload Document</h2>
          <button
            onClick={() => !isUploading && onClose()}
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

          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">Document uploaded successfully!</p>
              <p className="mt-1 text-xs text-slate-500">AI indexing started — check Knowledge Base shortly.</p>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isUploading && inputRef.current?.click()}
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
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv"
              />
              {isUploading ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <p className="mt-3 text-sm font-medium text-slate-600">Uploading...</p>
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                  <p className="mt-3 text-sm font-medium text-slate-600">AI indexing in progress...</p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Upload className="h-6 w-6 text-blue-500" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Drag & drop or click to browse
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    PDF, Word, PowerPoint, TXT up to 50MB
                  </p>
                </>
              )}
            </div>
          )}

          {!success && (
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
