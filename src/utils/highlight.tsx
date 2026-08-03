import { type ReactNode, Fragment } from "react";

export function highlightText(
  text: string,
  query: string,
  className = "bg-yellow-200 text-yellow-900 rounded px-0.5",
): ReactNode {
  if (!query.trim() || !text) return text;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.toLowerCase() === query.trim().toLowerCase()) {
      return (
        <mark key={i} className={className}>
          {part}
        </mark>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function highlightKeywords(
  keywords: string[],
  query: string,
  matchedClassName = "bg-yellow-200 text-yellow-900 rounded px-0.5",
  normalClassName = "bg-blue-50 text-blue-700",
): ReactNode[] {
  if (!query.trim()) {
    return keywords.map((kw) => (
      <span key={kw} className={`rounded-md px-2.5 py-1 text-xs font-medium ${normalClassName}`}>
        {kw}
      </span>
    ));
  }

  const lowerQuery = query.trim().toLowerCase();

  return keywords.map((kw) => {
    if (kw.toLowerCase().includes(lowerQuery)) {
      return (
        <span key={kw} className={`rounded-md px-2.5 py-1 text-xs font-medium ${matchedClassName}`}>
          {kw}
        </span>
      );
    }
    return (
      <span key={kw} className={`rounded-md px-2.5 py-1 text-xs font-medium ${normalClassName}`}>
        {kw}
      </span>
    );
  });
}
