import { Brain, ChevronRight } from "lucide-react";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const PROMPTS = [
  "Summarize my uploaded documents",
  "What are the key themes in my Knowledge Base?",
  "Compare my two most recent documents",
  "What advertising insights appear in my reports?",
  "Create five content ideas from my documents",
  "Turn a document insight into a LinkedIn post",
];

export default function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-8 text-center sm:py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 shadow-lg shadow-blue-100/50">
        <Brain className="h-8 w-8 text-blue-600" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-900 sm:text-2xl">
        How can MediaMind AI help?
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Ask questions about your uploaded documents, compare reports, extract insights, or create content.
      </p>
      <div className="mt-6 grid w-full gap-2.5 sm:grid-cols-2">
        {PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt)}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <span className="flex-1">{prompt}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
