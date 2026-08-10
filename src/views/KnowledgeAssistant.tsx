import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain,
  Plus,
  AlertCircle,
  X,
  Menu,
  RotateCcw,
  Library,
  Eraser,
} from "lucide-react";
import { useKnowledgeChat } from "../hooks/useKnowledgeChat";
import { saveGeneratedDraft } from "../services/contentGenerator";
import { logChatActivity, type ChatSource, type ChatMessage } from "../services/knowledgeChat";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatMessageItem, { QUICK_FOLLOW_UPS } from "../components/chat/ChatMessage";
import ChatComposer from "../components/chat/ChatComposer";
import SuggestedPrompts from "../components/chat/SuggestedPrompts";
import ChatLoadingState from "../components/chat/ChatLoadingState";
import CreateDraftModal from "../components/chat/CreateDraftModal";

interface KnowledgeAssistantProps {
  onNavigateToDocument: (documentId: string) => void;
  onDraftCreated: () => void;
  onNavigateToKnowledgeBase: () => void;
  onOpenDrafts: () => void;
}

const MAX_INPUT_LENGTH = 1000;

export default function KnowledgeAssistant({
  onNavigateToDocument,
  onDraftCreated,
  onNavigateToKnowledgeBase,
  onOpenDrafts,
}: KnowledgeAssistantProps) {
  const {
    sessions,
    currentSession,
    messages,
    loading,
    asking,
    error,
    status,
    input,
    setInput,
    sendMessage,
    regenerate,
    retryLast,
    newChat,
    openSession,
    deleteSession,
    renameSession,
    clearConversation,
    clearError,
    lastFollowUps,
  } = useKnowledgeChat();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [draftModal, setDraftModal] = useState<{
    open: boolean;
    content: string;
    sources: ChatSource[] | null;
    prompt: string;
  }>({ open: false, content: "", sources: null, prompt: "" });
  const [draftSavingFor, setDraftSavingFor] = useState<string | null>(null);
  const [draftSavedFor, setDraftSavedFor] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  const showWelcome = !currentSession && messages.length === 0 && !asking;

  const lastAssistant = messages.length > 0 && messages[messages.length - 1].role === "assistant"
    ? messages[messages.length - 1]
    : null;
  const noSources = lastAssistant && (!lastAssistant.sources || lastAssistant.sources.length === 0) && !asking;

  const handleSend = useCallback(() => {
    sendMessage();
  }, [sendMessage]);

  const handleCopy = useCallback(async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard not available
    }
  }, []);

  const handleOpenDraftModal = useCallback((content: string, msgId: string, sources: ChatSource[] | null) => {
    const userQuestion = messagesRef.current.find((m) => m.role === "user");
    setDraftModal({
      open: true,
      content,
      sources,
      prompt: userQuestion?.content || "Generated from AI Knowledge Assistant",
    });
    setDraftSavingFor(msgId);
  }, []);

  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const handleSaveDraft = useCallback(
    async (params: { title: string; platform: string }) => {
      const wordCount = draftModal.content.trim().split(/\s+/).filter(Boolean).length;
      const sourceDocIds = draftModal.sources ? draftModal.sources.map((s) => s.id) : [];

      await saveGeneratedDraft({
        title: params.title,
        content: draftModal.content,
        platform: params.platform,
        wordCount,
        sourceDocumentIds: sourceDocIds,
        generationPrompt: draftModal.prompt,
        tone: "Professional",
        targetAudience: "General",
        contentType: null,
        objective: null,
        promptId: null,
        generationConfig: {
          contentType: null,
          objective: null,
          topic: draftModal.prompt,
          tone: "Professional",
          audience: "General",
          outputLength: null,
          additionalInstructions: null,
          documentIds: sourceDocIds,
          promptId: null,
          origin: "knowledge-assistant",
        },
      });

      await logChatActivity("draft_from_answer", `Converted AI answer into draft: "${params.title}"`, {
        word_count: wordCount,
        source_document_ids: sourceDocIds,
        platform: params.platform,
      });

      setDraftSavedFor(draftSavingFor);
      setTimeout(() => setDraftSavedFor(null), 3000);
      onDraftCreated();
    },
    [draftModal, draftSavingFor, onDraftCreated],
  );

  const handleNewChat = useCallback(() => {
    newChat();
    setMobileSidebarOpen(false);
  }, [newChat]);

  const handleOpenSession = useCallback(
    async (id: string) => {
      await openSession(id);
      setMobileSidebarOpen(false);
    },
    [openSession],
  );

  const handleNavigateToDocument = useCallback(
    (docId: string) => {
      onNavigateToDocument(docId);
    },
    [onNavigateToDocument],
  );

  const handleClearConversation = useCallback(() => {
    clearConversation();
    setClearConfirm(false);
  }, [clearConversation]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSession?.id ?? null}
        loading={loading}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onNewChat={handleNewChat}
        onOpenSession={handleOpenSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
      />

      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSession?.id ?? null}
          loading={loading}
          collapsed={false}
          onToggleCollapse={() => {}}
          onNewChat={handleNewChat}
          onOpenSession={handleOpenSession}
          onDeleteSession={deleteSession}
          onRenameSession={renameSession}
          isMobile
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main chat panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-200 md:hidden"
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-600/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">AI Knowledge Assistant</h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Ask questions grounded in your Knowledge Base
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setClearConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {showWelcome ? (
            <SuggestedPrompts onSelect={(prompt) => sendMessage(prompt)} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1;
                const isLastAssistant = isLast && msg.role === "assistant" && !asking;
                return (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    isLast={isLastAssistant}
                    copied={copiedId === msg.id}
                    draftSaving={draftSavingFor === msg.id}
                    draftSaved={draftSavedFor === msg.id}
                    onCopy={handleCopy}
                    onCreateDraft={handleOpenDraftModal}
                    onRegenerate={regenerate}
                    onFollowUp={(text) => sendMessage(text)}
                    onNavigateDocument={handleNavigateToDocument}
                    followUps={isLastAssistant ? [...lastFollowUps, ...QUICK_FOLLOW_UPS] : []}
                  />
                );
              })}

              {/* Loading state */}
              {asking && (
                <ChatLoadingState status={status === "retrieving" ? "retrieving" : "generating"} />
              )}

              {/* Error state with retry */}
              {error && !asking && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center" role="alert">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Something went wrong</p>
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                  </div>
                  <button
                    onClick={() => {
                      clearError();
                      retryLast();
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retry
                  </button>
                </div>
              )}

              {/* No sources state */}
              {noSources && !asking && !error && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-6 text-center">
                  <Library className="h-8 w-8 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">No relevant documents found</p>
                    <p className="mt-1 text-sm text-slate-500">
                      The Knowledge Base does not contain enough information to answer this question.
                      Try uploading a relevant document, rephrasing your question, or exploring your Knowledge Base.
                    </p>
                  </div>
                  <button
                    onClick={onNavigateToKnowledgeBase}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <Library className="h-4 w-4" />
                    Go to Knowledge Base
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error banner (non-blocking, dismissible) */}
        {error && asking && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700 sm:mx-6">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">Retrying may take a moment…</span>
            <button onClick={clearError} className="rounded p-0.5 hover:bg-amber-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Composer */}
        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={asking}
          maxLength={MAX_INPUT_LENGTH}
          onClear={() => {}}
        />
      </div>

      {/* Create Draft Modal */}
      <CreateDraftModal
        open={draftModal.open}
        content={draftModal.content}
        sourceDocumentIds={draftModal.sources ? draftModal.sources.map((s) => s.id) : []}
        onClose={() => setDraftModal((prev) => ({ ...prev, open: false }))}
        onSave={handleSaveDraft}
        onOpenDrafts={onOpenDrafts}
      />

      {/* Clear conversation confirmation */}
      {clearConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setClearConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Clear conversation confirmation"
          >
            <div className="flex items-start gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Eraser className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Clear conversation?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  This will remove all messages from the current view. The conversation will still be saved in your history.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setClearConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClearConversation}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
