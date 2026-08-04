import { useRef, useEffect, useCallback } from "react";
import { Send, Loader2, X } from "lucide-react";

interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  maxLength: number;
  onClear?: () => void;
}

export default function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  maxLength,
  onClear,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && value.trim()) onSend();
      }
    },
    [disabled, value, onSend],
  );

  const remaining = maxLength - value.length;
  const showCounter = remaining < 100;

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
            onKeyDown={handleKeyDown}
            placeholder="Ask MediaMind AI about your documents…"
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: "160px" }}
            aria-label="Message input"
          />
          {value.trim() && !disabled && onClear && (
            <button
              onClick={() => { onChange(""); onClear(); }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Enter to send · Shift+Enter for new line
          </p>
          {showCounter && (
            <span className={`text-[11px] ${remaining < 20 ? "text-red-500" : "text-slate-400"}`}>
              {remaining} characters left
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
