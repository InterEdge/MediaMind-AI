import { FileText, FileType2, Presentation, BookOpen } from "lucide-react";
import type { ChatSource } from "../services/knowledgeChat";

interface SourceCardProps {
  source: ChatSource;
  onNavigate: (documentId: string) => void;
}

const typeIcon = (type: string) => {
  switch (type) {
    case "PDF":
      return { icon: FileType2, color: "text-red-500 bg-red-50 ring-red-100" };
    case "Word":
      return { icon: FileText, color: "text-blue-500 bg-blue-50 ring-blue-100" };
    case "Presentation":
      return { icon: Presentation, color: "text-amber-500 bg-amber-50 ring-amber-100" };
    default:
      return { icon: FileText, color: "text-slate-500 bg-slate-50 ring-slate-100" };
  }
};

export default function SourceCard({ source, onNavigate }: SourceCardProps) {
  const ti = typeIcon(source.type);
  const Icon = ti.icon;

  return (
    <button
      onClick={() => onNavigate(source.id)}
      className="group flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${ti.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">
              {source.citation_number}
            </span>
            <p className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-700">
              {source.title}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {source.category}
            </span>
            <span>·</span>
            <span>{source.type}</span>
          </div>
        </div>
      </div>
      {source.excerpt && (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
          {source.excerpt}
        </p>
      )}
      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
        <span>Relevant source</span>
      </div>
    </button>
  );
}
