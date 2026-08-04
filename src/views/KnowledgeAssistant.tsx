import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  Plus,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Search,
  FileEdit,
  ChevronRight,
  Brain,
  Inbox,
  X,
} from "lucide-react";
import { useKnowledgeChat } from "../hooks/useKnowledgeChat";
import { saveGeneratedDraft } from "../services/contentGenerator";
import { logChatActivity, type ChatSource } from "../services/knowledgeChat";
import SourceCard from "../components/SourceCard";

interface KnowledgeAssistantProps {
  onNavigateToDocument: (documentId: string) => void;
  onDraftCreated: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Summarize my uploaded documents",
  "What are the main themes in the Knowledge Base?",
  "What does the selected report say about advertising rates?",
  "Compare two uploaded documents",
  "Create content ideas from my documents",
];

export default function KnowledgeAssistant({ onNavigateToDocument, onDraftCreated }: KnowledgeAssistantProps) {
  const {
    sessions,
    currentSession,
    messages,
    asking,
    error,
    status,
    input,
    setInput,
    sendMessage,
    newChat,
    openSession,
    deleteSession,
    clearError,
    lastFollowUps,
  } = useKnowledgeChat();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedFor, setDraftSavedFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  const handleSend = useCallback(() => {
    sendMessage();
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleCreateDraft = async (content: string, msgId: string, sources: ChatSource[] | null) => {
    setDraftSaving(true);
    try {
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const title = `AI Assistant Answer — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      const sourceDocIds = sources ? sources.map((s) => s.id) : [];

      await saveGeneratedDraft({
        title,
        content,
        platform: "AI Assistant",
        wordCount,
        sourceDocumentIds: sourceDocIds,
        generationPrompt: "Generated from AI Knowledge Assistant",
        tone: "Professional",
        targetAudience: "General",
      });

      await logChatActivity("draft_from_answer", `Converted AI answer into draft: "${title}"`, {
        word_count: wordCount,
        source_document_ids: sourceDocIds,
      });

      setDraftSavedFor(msgId);
      setTimeout(() => setDraftSavedFor(null), 3000);
      onDraftCreated();
    } catch (err: any) {
      console.error("Failed to create draft:", err);
    } finally {
      setDraftSaving(false);
    }
  };

  const handleNavigateToDocument = (documentId: string) => {
    onNavigateToDocument(documentId);
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const showWelcome = !currentSession && messages.length === 0 && !asking;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden">
      {/* ── Session History Panel ── */}
      <div className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Chat History</h2>
          <button
            onClick={newChat}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <Inbox className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs text-slate-400">No conversations yet</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Ask a question to start</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 transition ${
                    currentSession?.id === session.id
                      ? "bg-blue-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <button
                    onClick={() => openSession(session.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <MessageSquare className={`h-4 w-4 shrink-0 ${currentSession?.id === session.id ? "text-blue-600" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-medium ${currentSession?.id === session.id ? "text-blue-700" : "text-slate-700"}`}>
                        {session.title}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatTime(session.updated_at)}</p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(session.id); }}
                    className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-600/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">AI Knowledge Assistant</h1>
              <p className="text-xs text-slate-500">Ask questions grounded in your Knowledge Base</p>
            </div>
          </div>
          <button
            onClick={newChat}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 md:hidden"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-6">
          {showWelcome ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 shadow-lg shadow-blue-100/50">
                <Brain className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-slate-900">Ask about your documents</h2>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                I search your Knowledge Base, find the most relevant documents, and answer with cited sources. Try one of these to get started:
              </p>
              <div className="mt-6 w-full space-y-2.5">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm"
                  >
                    <Search className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-500" />
                    <span className="flex-1">{q}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "user" ? (
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 shadow-sm">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="w-full max-w-[90%]">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{msg.content}</p>

                          {/* Source cards */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 border-t border-slate-100 pt-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Sources</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {msg.sources.map((source) => (
                                  <SourceCard
                                    key={source.id}
                                    source={source}
                                    onNavigate={handleNavigateToDocument}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                              {copiedId === msg.id ? (
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
                              onClick={() => handleCreateDraft(msg.content, msg.id, msg.sources)}
                              disabled={draftSaving && draftSavedFor !== msg.id}
                              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                            >
                              {draftSavedFor === msg.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-emerald-600">Draft saved</span>
                                </>
                              ) : draftSaving ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <FileEdit className="h-3.5 w-3.5" />
                                  Create Draft
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {asking && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <Sparkles className="h-4 w-4 animate-pulse text-blue-600" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        {status === "retrieving" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="text-sm text-slate-500">Searching documents...</span>
                          </>
                        ) : (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="text-sm text-slate-500">Generating answer...</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Follow-up suggestions */}
              {!asking && lastFollowUps.length > 0 && messages.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-10">
                  {lastFollowUps.map((fu, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(fu)}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
                    >
                      {fu}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 sm:mx-6">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="rounded p-0.5 hover:bg-red-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents..."
                rows={1}
                disabled={asking}
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
                style={{ maxHeight: "150px" }}
              />
              <button
                onClick={handleSend}
                disabled={asking || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
              >
                {asking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete conversation?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  This conversation and all its messages will be permanently deleted. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteSession(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
