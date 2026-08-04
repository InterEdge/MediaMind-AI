import { Sparkles, Loader2 } from "lucide-react";

interface ChatLoadingStateProps {
  status: "retrieving" | "generating";
}

const STATUS_MESSAGES: Record<string, string[]> = {
  retrieving: [
    "Searching knowledge base…",
    "Reviewing relevant documents…",
  ],
  generating: [
    "Generating grounded answer…",
    "Synthesizing insights…",
  ],
};

export default function ChatLoadingState({ status }: ChatLoadingStateProps) {
  const messages = STATUS_MESSAGES[status] || STATUS_MESSAGES.retrieving;

  return (
    <div className="flex justify-start gap-2.5" role="status" aria-live="polite">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
        <Sparkles className="h-4 w-4 animate-pulse text-blue-600" />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-1.5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              style={{ animation: `chatFadeIn 0.3s ease-out ${i * 0.4}s both` }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              <span className="text-sm text-slate-500">{msg}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
