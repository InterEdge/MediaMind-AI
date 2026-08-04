import { useMemo } from "react";

interface MarkdownProps {
  content: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInline(text: string): string {
  let escaped = escapeHtml(text);

  escaped = escaped.replace(/(\[(\d+)\])/g, (_, full, num) => {
    return `<sup class="citation-ref" data-citation="${num}">${full}</sup>`;
  });

  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/\*(.+?)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">$1</code>');

  return escaped;
}

export default function MarkdownRenderer({ content }: MarkdownProps) {
  const html = useMemo(() => {
    const lines = content.split("\n");
    const result: string[] = [];
    let inList: "ul" | "ol" | null = null;
    let listItems: string[] = [];

    const closeList = () => {
      if (inList) {
        const tag = inList === "ol" ? "ol" : "ul";
        const listClass = inList === "ol" ? "list-decimal" : "list-disc";
        result.push(
          `<${tag} class="${listClass} ml-5 space-y-1">${listItems.map((i) => `<li>${i}</li>`).join("")}</${tag}>`,
        );
        inList = null;
        listItems = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        closeList();
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        const sizes: Record<number, string> = {
          1: "text-lg font-bold mt-4 mb-2",
          2: "text-base font-bold mt-3 mb-1.5",
          3: "text-sm font-bold mt-2 mb-1",
          4: "text-sm font-semibold mt-2 mb-1",
        };
        result.push(`<h${level} class="${sizes[level]}">${renderInline(headingMatch[2])}</h${level}>`);
        continue;
      }

      const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (olMatch) {
        if (inList !== "ol") {
          closeList();
          inList = "ol";
        }
        listItems.push(renderInline(olMatch[2]));
        continue;
      }

      const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        if (inList !== "ul") {
          closeList();
          inList = "ul";
        }
        listItems.push(renderInline(ulMatch[1]));
        continue;
      }

      closeList();
      result.push(`<p class="mb-2 last:mb-0">${renderInline(trimmed)}</p>`);
    }

    closeList();
    return result.join("");
  }, [content]);

  return (
    <div
      className="text-sm leading-relaxed text-slate-700 [&_p]:leading-relaxed [&_li]:leading-relaxed [&_sup.citation-ref]:ml-0.5 [&_sup.citation-ref]:inline-flex [&_sup.citation-ref]:h-4 [&_sup.citation-ref]:min-w-4 [&_sup.citation-ref]:items-center [&_sup.citation-ref]:justify-center [&_sup.citation-ref]:rounded [&_sup.citation-ref]:bg-blue-100 [&_sup.citation-ref]:px-1 [&_sup.citation-ref]:text-[10px] [&_sup.citation-ref]:font-bold [&_sup.citation-ref]:text-blue-600"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
