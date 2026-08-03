import { useState, useEffect, useRef, useCallback } from "react";
import {
  searchDocuments,
  type SearchFilters,
  type SearchResult,
} from "../services/search";
import type { DocumentRow } from "../services/documents";

interface UseDocumentSearchOptions {
  initialDocs?: DocumentRow[];
  debounceMs?: number;
}

interface UseDocumentSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  filters: SearchFilters;
  setFilters: (f: Partial<SearchFilters>) => void;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  isSearchActive: boolean;
  clearSearch: () => void;
}

const DEFAULT_FILTERS: SearchFilters = {
  type: "All",
  category: "All",
  aiStatus: "All",
};

export function useDocumentSearch({
  initialDocs,
  debounceMs = 250,
}: UseDocumentSearchOptions = {}): UseDocumentSearchReturn {
  const [query, setQuery] = useState("");
  const [filters, setFiltersState] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRequestId = useRef(0);

  const setFilters = useCallback((f: Partial<SearchFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }));
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setError(null);
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const requestId = ++currentRequestId.current;

    if (!query.trim()) {
      setLoading(true);
      searchDocuments("", filters, initialDocs)
        .then((res) => {
          if (requestId !== currentRequestId.current) return;
          setResults(res);
          setError(null);
        })
        .catch((err: Error) => {
          if (requestId !== currentRequestId.current) return;
          setError(err.message || "Search failed");
        })
        .finally(() => {
          if (requestId !== currentRequestId.current) return;
          setLoading(false);
        });
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(() => {
      searchDocuments(query, filters, initialDocs)
        .then((res) => {
          if (requestId !== currentRequestId.current) return;
          setResults(res);
          setError(null);
        })
        .catch((err: Error) => {
          if (requestId !== currentRequestId.current) return;
          setError(err.message || "Search failed");
        })
        .finally(() => {
          if (requestId !== currentRequestId.current) return;
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, filters, initialDocs, debounceMs]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    results,
    loading,
    error,
    isSearchActive: query.trim().length > 0,
    clearSearch,
  };
}
