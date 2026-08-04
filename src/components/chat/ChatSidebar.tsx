import { useState, useMemo, useCallback } from "react";
import {
  MessageSquare,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  X,
  Pencil,
  Check,
} from "lucide-react";
import type { ChatSession } from "../../services/knowledgeChat";

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  loading: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onOpenSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

interface SessionGroup {
  label: string;
  sessions: ChatSession[];
}

function groupSessions(sessions: ChatSession[]): SessionGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);

  const groups: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    Older: [],
  };

  for (const s of sessions) {
    const d = new Date(s.updated_at);
    if (d >= todayStart) groups["Today"].push(s);
    else if (d >= yesterdayStart) groups["Yesterday"].push(s);
    else if (d >= sevenDaysAgo) groups["Previous 7 Days"].push(s);
    else groups["Older"].push(s);
  }

  return Object.entries(groups)
    .filter(([, s]) => s.length > 0)
    .map(([label, s]) => ({ label, sessions: s }));
}

export default function ChatSidebar({
  sessions,
  currentSessionId,
  loading,
  collapsed,
  onToggleCollapse,
  onNewChat,
  onOpenSession,
  onDeleteSession,
  onRenameSession,
  isMobile = false,
  onCloseMobile,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => groupSessions(filteredSessions), [filteredSessions]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirmId) {
      onDeleteSession(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, onDeleteSession]);

  const handleStartRename = useCallback((e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setRenameId(session.id);
    setRenameValue(session.title);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (renameId && renameValue.trim()) {
      onRenameSession(renameId, renameValue.trim());
    }
    setRenameId(null);
    setRenameValue("");
  }, [renameId, renameValue, onRenameSession]);

  if (collapsed && !isMobile) {
    return (
      <div className="hidden w-14 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-3 md:flex">
        <button
          onClick={onToggleCollapse}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Expand chat history"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          onClick={onNewChat}
          className="mt-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`${isMobile ? "fixed inset-0 z-50 flex md:hidden" : "hidden md:flex"} ${
          isMobile ? "" : collapsed ? "w-14" : "w-64"
        } shrink-0 flex-col border-r border-slate-200 bg-white`}
      >
        {isMobile && (
          <div className="absolute inset-0 -z-10 bg-slate-900/30" onClick={onCloseMobile} />
        )}
        <div className={`relative z-10 flex h-full flex-col ${isMobile ? "max-w-[80%] shadow-2xl" : ""}`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Chat History</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={onNewChat}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="New chat"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
              {!isMobile && (
                <button
                  onClick={onToggleCollapse}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  aria-label="Collapse chat history"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {isMobile && (
                <button
                  onClick={onCloseMobile}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close history"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-100"
                aria-label="Search conversations"
              />
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {loading ? (
              <div className="space-y-2 px-1 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Inbox className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs text-slate-400">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {searchQuery ? "Try a different search" : "Ask a question to start"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map((group) => (
                  <div key={group.label}>
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 transition ${
                            currentSessionId === session.id
                              ? "bg-blue-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <button
                            onClick={() => onOpenSession(session.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <MessageSquare
                              className={`h-4 w-4 shrink-0 ${
                                currentSessionId === session.id ? "text-blue-600" : "text-slate-400"
                              }`}
                            />
                            {renameId === session.id ? (
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleConfirmRename();
                                  if (e.key === "Escape") { setRenameId(null); setRenameValue(""); }
                                }}
                                onBlur={handleConfirmRename}
                                className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-200"
                                autoFocus
                                aria-label="Rename conversation"
                              />
                            ) : (
                              <span
                                className={`truncate text-xs font-medium ${
                                  currentSessionId === session.id ? "text-blue-700" : "text-slate-700"
                                }`}
                              >
                                {session.title}
                              </span>
                            )}
                          </button>
                          {renameId === session.id ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }}
                              className="shrink-0 rounded p-1 text-blue-500 hover:bg-blue-100"
                              aria-label="Confirm rename"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                              <button
                                onClick={(e) => handleStartRename(e, session)}
                                className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
                                aria-label="Rename conversation"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(e, session.id)}
                                className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                                aria-label="Delete conversation"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete conversation confirmation"
          >
            <div className="flex items-start gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete conversation?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  This conversation and all its messages will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
