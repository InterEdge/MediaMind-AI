import { useState, useCallback, useRef, useEffect } from "react";
import {
  askKnowledgeBase,
  createChatSession,
  getChatSessions,
  getChatMessages,
  saveChatMessage,
  deleteChatSession,
  generateSessionTitle,
  logChatActivity,
  type ChatSession,
  type ChatMessage,
  type ChatSource,
  type HistoryMessage,
} from "../services/knowledgeChat";

interface UseKnowledgeChatReturn {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  loading: boolean;
  asking: boolean;
  error: string | null;
  status: "idle" | "retrieving" | "generating" | "done" | "error";
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => Promise<void>;
  newChat: () => void;
  openSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
  lastSources: ChatSource[];
  lastFollowUps: string[];
}

export function useKnowledgeChat(): UseKnowledgeChatReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "retrieving" | "generating" | "done" | "error">("idle");
  const [input, setInput] = useState("");
  const [lastSources, setLastSources] = useState<ChatSource[]>([]);
  const [lastFollowUps, setLastFollowUps] = useState<string[]>([]);
  const sessionRef = useRef<ChatSession | null>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getChatSessions();
      setSessions(s);
    } catch (err: any) {
      setError(err.message || "Failed to load chat history");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const s = await getChatSessions();
      setSessions(s);
    } catch {
      // silent
    }
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || asking) return;

    setError(null);
    setInput("");
    setAsking(true);
    setStatus("retrieving");
    setLastSources([]);
    setLastFollowUps([]);

    let session = sessionRef.current;

    // Create session on first message
    if (!session) {
      try {
        session = await createChatSession(generateSessionTitle(question));
        sessionRef.current = session;
        setCurrentSession(session);
        refreshSessions();
      } catch (err: any) {
        setError(err.message || "Failed to create chat session");
        setAsking(false);
        setStatus("error");
        return;
      }
    }

    // Save user message
    let userMsg: ChatMessage;
    try {
      userMsg = await saveChatMessage(session.id, "user", question, null);
      setMessages((prev) => [...prev, userMsg]);
    } catch (err: any) {
      setError(err.message || "Failed to save message");
      setAsking(false);
      setStatus("error");
      return;
    }

    // Log question activity
    logChatActivity("knowledge_question", `Knowledge question asked: "${question.slice(0, 60)}"`, {
      session_id: session.id,
      question_length: question.length,
    });

    // Build history from current messages (exclude the just-added user msg since it goes in the request)
    const history: HistoryMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setStatus("generating");

    try {
      const result = await askKnowledgeBase(question, history);

      // Save assistant message
      const assistantMsg = await saveChatMessage(session.id, "assistant", result.answer, result.sources);
      setMessages((prev) => [...prev, assistantMsg]);
      setLastSources(result.sources);
      setLastFollowUps(result.follow_ups);
      setStatus("done");
      refreshSessions();

      // Log answer activity
      logChatActivity("ai_answer", `AI answered knowledge question (${result.sources.length} sources cited)`, {
        session_id: session.id,
        source_count: result.sources.length,
        retrieved_doc_ids: result.retrieved_document_ids,
      });
    } catch (err: any) {
      setError(err.message || "Failed to get an answer");
      setStatus("error");
    } finally {
      setAsking(false);
    }
  }, [input, asking, messages, refreshSessions]);

  const newChat = useCallback(() => {
    sessionRef.current = null;
    setCurrentSession(null);
    setMessages([]);
    setError(null);
    setStatus("idle");
    setLastSources([]);
    setLastFollowUps([]);
    setInput("");
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = sessions.find((x) => x.id === sessionId) || (await getChatSessions()).find((x) => x.id === sessionId);
      if (!s) {
        setError("Session not found");
        return;
      }
      sessionRef.current = s;
      setCurrentSession(s);
      const msgs = await getChatMessages(sessionId);
      setMessages(msgs);
      setStatus("idle");
      setLastSources([]);
      setLastFollowUps([]);
    } catch (err: any) {
      setError(err.message || "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, [sessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (sessionRef.current?.id === sessionId) {
        newChat();
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete conversation");
    }
  }, [newChat]);

  const clearError = useCallback(() => setError(null), []);

  return {
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
    newChat,
    openSession,
    deleteSession,
    clearError,
    lastSources,
    lastFollowUps,
  };
}
