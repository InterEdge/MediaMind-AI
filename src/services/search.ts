import { supabase } from "../lib/supabase";
import type { DocumentRow } from "./documents";

export interface SearchFilters {
  type: string;
  category: string;
  aiStatus: string;
}

export interface SearchResult {
  doc: DocumentRow;
  score: number;
  matchedFields: MatchedField[];
}

export type MatchedFieldName =
  | "title"
  | "summary"
  | "extracted_text"
  | "keywords"
  | "category"
  | "type";

export interface MatchedField {
  field: MatchedFieldName;
  snippet: string;
}

const FIELD_WEIGHTS: Record<MatchedFieldName, number> = {
  title: 100,
  summary: 50,
  keywords: 30,
  category: 15,
  type: 10,
  extracted_text: 5,
};

const DEFAULT_FILTERS: SearchFilters = {
  type: "All",
  category: "All",
  aiStatus: "All",
};

const AI_STATUS_MAP: Record<string, string[]> = {
  Ready: ["ready"],
  Processing: ["pending", "extracting", "ai_processing"],
  Failed: ["failed"],
};

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeForIlike(text: string): string {
  return text.replace(/[%_\\]/g, "\\$&");
}

function buildIlikePattern(query: string): string {
  return `%${escapeForIlike(query)}%`;
}

function findMatches(
  text: string,
  query: string,
): { count: number; snippet: string } {
  if (!text) return { count: 0, snippet: "" };
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const count = (lowerText.match(new RegExp(escapeRegex(lowerQuery), "g")) || []).length;

  let snippet = "";
  if (count > 0) {
    const idx = lowerText.indexOf(lowerQuery);
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + lowerQuery.length + 60);
    snippet = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
  }
  return { count, snippet };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreDocument(
  doc: DocumentRow,
  query: string,
): { score: number; matchedFields: MatchedField[] } {
  let score = 0;
  const matchedFields: MatchedField[] = [];

  const titleMatch = findMatches(doc.title || "", query);
  if (titleMatch.count > 0) {
    score += FIELD_WEIGHTS.title * titleMatch.count;
    matchedFields.push({ field: "title", snippet: doc.title });
  }

  const summaryMatch = findMatches(doc.summary || "", query);
  if (summaryMatch.count > 0) {
    score += FIELD_WEIGHTS.summary * summaryMatch.count;
    matchedFields.push({ field: "summary", snippet: summaryMatch.snippet });
  }

  const keywordList = doc.keywords?.length ? doc.keywords : doc.tags || [];
  const keywordMatches = keywordList.filter((k) =>
    k.toLowerCase().includes(query.toLowerCase()),
  );
  if (keywordMatches.length > 0) {
    score += FIELD_WEIGHTS.keywords * keywordMatches.length;
    matchedFields.push({ field: "keywords", snippet: keywordMatches.join(", ") });
  }

  const categoryMatch = findMatches(doc.category || "", query);
  if (categoryMatch.count > 0) {
    score += FIELD_WEIGHTS.category * categoryMatch.count;
    matchedFields.push({ field: "category", snippet: doc.category });
  }

  const typeMatch = findMatches(doc.type || "", query);
  if (typeMatch.count > 0) {
    score += FIELD_WEIGHTS.type * typeMatch.count;
    matchedFields.push({ field: "type", snippet: doc.type });
  }

  const textMatch = findMatches(doc.extracted_text || "", query);
  if (textMatch.count > 0) {
    score += FIELD_WEIGHTS.extracted_text * textMatch.count;
    matchedFields.push({ field: "extracted_text", snippet: textMatch.snippet });
  }

  return { score, matchedFields };
}

export async function searchDocuments(
  rawQuery: string,
  filters: SearchFilters = DEFAULT_FILTERS,
  allDocs?: DocumentRow[],
): Promise<SearchResult[]> {
  const query = normalizeQuery(rawQuery);

  // When there is no search term, use the already-fetched allDocs cache so we
  // avoid an extra round-trip.  getDocumentsLite() intentionally omits
  // extracted_text to keep the list payload small — that's fine here because
  // filter-only results don't need body-text scoring.
  if (allDocs && allDocs.length > 0 && !query) {
    return applyFiltersAndSort(allDocs, filters);
  }

  // When a query is active we always go to the database and fetch
  // extracted_text explicitly so scoreDocument() can match against document
  // body text.  Do NOT replace this select list with a cached allDocs that
  // omits extracted_text — that would silently break full-text scoring.
  let baseQuery = supabase.from("documents").select(
    "id, title, type, category, file_size, status, summary, tags, uploaded_at, file_path, keywords, ai_status, extracted_text",
  );

  if (query) {
    const pattern = buildIlikePattern(query);
    baseQuery = baseQuery.or(
      `title.ilike.${pattern},summary.ilike.${pattern},extracted_text.ilike.${pattern},category.ilike.${pattern},type.ilike.${pattern}`,
    );
  }

  if (filters.type !== "All") {
    baseQuery = baseQuery.eq("type", filters.type);
  }
  if (filters.category !== "All") {
    baseQuery = baseQuery.eq("category", filters.category);
  }

  const { data, error } = await baseQuery.order("uploaded_at", { ascending: false });

  if (error) throw error;
  const docs = (data || []) as DocumentRow[];

  let filtered = docs;

  if (filters.aiStatus !== "All") {
    const statuses = AI_STATUS_MAP[filters.aiStatus] || [];
    filtered = docs.filter((d) => {
      const stage = d.ai_status || (d.status === "Ready" ? "ready" : "pending");
      return statuses.includes(stage);
    });
  }

  if (!query) {
    return filtered.map((doc) => ({
      doc,
      score: 0,
      matchedFields: [],
    }));
  }

  return filtered
    .map((doc) => {
      const { score, matchedFields } = scoreDocument(doc, query);
      return { doc, score, matchedFields };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function applyFiltersAndSort(
  docs: DocumentRow[],
  filters: SearchFilters,
): SearchResult[] {
  let filtered = docs;

  if (filters.type !== "All") {
    filtered = filtered.filter((d) => d.type === filters.type);
  }
  if (filters.category !== "All") {
    filtered = filtered.filter((d) => d.category === filters.category);
  }
  if (filters.aiStatus !== "All") {
    const statuses = AI_STATUS_MAP[filters.aiStatus] || [];
    filtered = filtered.filter((d) => {
      const stage = d.ai_status || (d.status === "Ready" ? "ready" : "pending");
      return statuses.includes(stage);
    });
  }

  return filtered.map((doc) => ({ doc, score: 0, matchedFields: [] }));
}

export function getMatchedFieldLabel(field: MatchedFieldName): string {
  switch (field) {
    case "title": return "Title";
    case "summary": return "Summary";
    case "extracted_text": return "Document Text";
    case "keywords": return "Keywords";
    case "category": return "Category";
    case "type": return "Type";
  }
}
