import { useState, useCallback } from "react";
import {
  Sparkles,
  Copy,
  Check,
  FileEdit,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import type { ChatMessage, ChatSource } from "../../services/knowledgeChat";
import SourceCard from "../SourceCard";
import MarkdownRenderer from "./MarkdownRenderer";

interface ChatMessageProps {
  message: ChatMessage;
  isLast: boolean;
  copied: boolean;
  draftSaving: boolean;
  draftSaved: boolean;
  onCopy: (content: string, msgId: string) => void;
  onCreateDraft: (content: string, msgId: string, sources: ChatSource[] | null) => void;
  onRegenerate: () => void;
  onFollowUp: (text: string) => void;
  onNavigateDocument: (docId: string) => void;
  followUps: string[];
}

const QUICK_FOLLOW_UPS = [
  "Summarize this",
  "Explain further",
  "Create content ideas",
  "Compare with another document",
  "Turn this into a LinkedIn post",
];

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ChatMessageItem({
  message,
  isLast,
  copied,
  draftSaving,
  draftSaved,
  onCopy,
  onCreateDraft,
  onRegenerate,
  onFollowUp,
  onNavigateDocument,
  followUps,
}: ChatMessageProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const safeSources = Array.isArray(message.sources) ? message.sources : [];

  const handleCopy = useCallback(() => {
    onCopy(message.content, message.id);
  }, [onCopy, message.content, message.id]);

  const handleCreateDraft = useCallback(() => {
    onCreateDraft(message.content, message.id, safeSources);
  }, [onCreateDraft, message.content, message.id, safeSources]);

  const handleRegenerate = useCallback(() => {
    onRegenerate();
  }, [onRegenerate]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-2">
        <div className="flex max-w-[80%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 shadow-sm">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{message.content}</p>
          </div>
          <span className="px-1 text-[10px] text-slate-400">{formatTime(message.created_at)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
        <Sparkles className="h-4 w-4 text-blue-600" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <MarkdownRenderer content={message.content} />

          {/* Sources section */}
          {safeSources.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                onClick={() => setSourcesExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 transition hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 rounded"
                aria-expanded={sourcesExpanded}
                aria-label="Toggle sources"
              >
                Sources ({safeSources.length})
                {sourcesExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {sourcesExpanded && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {safeSources.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      onNavigate={onNavigateDocument}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              aria-label="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleCreateDraft}
              disabled={draftSaving}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
              aria-label="Create draft from answer"
            >
              {draftSaved ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600">Draft saved</span>
                </>
              ) : draftSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FileEdit className="h-3.5 w-3.5" />
                  Create Draft
                </>
              )}
            </button>
            {isLast && (
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                aria-label="Regenerate answer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            )}
            {followUps.length > 0 && (
              <button
                onClick={() => setShowFollowUps((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                aria-label="Ask follow-up"
                aria-expanded={showFollowUps}
              >
                Ask Follow-up
                {showFollowUps ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {/* Follow-up chips */}
          {showFollowUps && followUps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {followUps.map((fu, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp(fu)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {fu}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 px-1">
          <Clock className="h-2.5 w-2.5 text-slate-300" />
          <span className="text-[10px] text-slate-400">{formatTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export { QUICK_FOLLOW_UPS };
