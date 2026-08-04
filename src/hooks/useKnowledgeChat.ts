import { useState, useCallback, useRef, useEffect } from "react";
import {
  askKnowledgeBase,
  createChatSession,
  getChatSessions,
  getChatMessages,
  saveChatMessage,
  deleteChatSession,
  updateChatSessionTitle,
  generateSessionTitle,
  logChatActivity,
  normalizeSources,
  type ChatSession,
  type ChatMessage,
  type HistoryMessage,
} from "../services/knowledgeChat";

type ChatStatus = "idle" | "retrieving" | "generating" | "done" | "error";

interface UseKnowledgeChatReturn {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  loading: boolean;
  asking: boolean;
  error: string | null;
  status: ChatStatus;
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => Promise<void>;
  regenerate: () => Promise<void>;
  retryLast: () => Promise<void>;
  newChat: () => void;
  openSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  clearConversation: () => void;
  clearError: () => void;
  lastFollowUps: string[];
  lastQuestion: string | null;
}

const MAX_HISTORY = 10;
const MAX_HISTORY_CHARS = 8000;

function buildHistory(messages: ChatMessage[]): HistoryMessage[] {
  const recent = messages.slice(-MAX_HISTORY);
  let totalChars = 0;
  const result: HistoryMessage[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const msg = recent[i];
    if (totalChars + msg.content.length > MAX_HISTORY_CHARS) break;
    result.unshift({ role: msg.role, content: msg.content });
    totalChars += msg.content.length;
  }
  return result;
}

export function useKnowledgeChat(): UseKnowledgeChatReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [input, setInput] = useState("");
  const [lastFollowUps, setLastFollowUps] = useState<string[]>([]);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const sessionRef = useRef<ChatSession | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const askingRef = useRef(false);
  const requestCounter = useRef(0);
  const lastQuestionRef = useRef<string | null>(null);
  const inputRef = useRef("");

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { askingRef.current = asking; }, [asking]);
  useEffect(() => { inputRef.current = input; }, [input]);

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

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const upsertSessionInList = useCallback((session: ChatSession) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = session;
        return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      }
      return [session, ...prev];
    });
  }, []);

  const normalizeMessages = useCallback((items: ChatMessage[]): ChatMessage[] => {
    return items.map((msg) => ({
      ...msg,
      sources: normalizeSources(msg.sources),
    }));
  }, []);

  const runAssistant = useCallback(
    async (question: string, existingSession: ChatSession | null, isRegenerate: boolean) => {
      const reqId = ++requestCounter.current;

      setError(null);
      setAsking(true);
      askingRef.current = true;
      setStatus("retrieving");
      setLastFollowUps([]);

      let session = existingSession;

      if (!session) {
        try {
          session = await createChatSession(generateSessionTitle(question));
          sessionRef.current = session;
          setCurrentSession(session);
          upsertSessionInList(session);
        } catch (err: any) {
          if (reqId !== requestCounter.current) return;
          setError(err.message || "Failed to create chat session");
          setAsking(false);
          askingRef.current = false;
          setStatus("error");
          return;
        }
      }

      if (!isRegenerate) {
        try {
          const userMsg = await saveChatMessage(session.id, "user", question, null);
          if (reqId !== requestCounter.current) return;
          const normalizedUserMsg = { ...userMsg, sources: normalizeSources(userMsg.sources) };
          setMessages((prev) => [...prev, normalizedUserMsg]);
          messagesRef.current = [...messagesRef.current, normalizedUserMsg];
        } catch (err: any) {
          if (reqId !== requestCounter.current) return;
          setError(err.message || "Failed to save message");
          setAsking(false);
          askingRef.current = false;
          setStatus("error");
          return;
        }
      }

      logChatActivity("knowledge_question", `Knowledge question asked: "${question.slice(0, 60)}"`, {
        session_id: session.id,
        question_length: question.length,
      });

      setStatus("generating");

      try {
        const history = buildHistory(messagesRef.current);
        const result = await askKnowledgeBase(question, history);

        if (reqId !== requestCounter.current) return;

        const assistantMsg = await saveChatMessage(session.id, "assistant", result.answer, result.sources);
        if (reqId !== requestCounter.current) return;

        const normalizedAssistantMsg = { ...assistantMsg, sources: normalizeSources(assistantMsg.sources) };
        setMessages((prev) => [...prev, normalizedAssistantMsg]);
        messagesRef.current = [...messagesRef.current, normalizedAssistantMsg];
        setLastFollowUps(result.follow_ups);
        setLastQuestion(question);
        lastQuestionRef.current = question;
        setStatus("done");
        upsertSessionInList({ ...session, updated_at: new Date().toISOString() });

        logChatActivity("ai_answer", `AI answered knowledge question (${result.sources.length} sources cited)`, {
          session_id: session.id,
          source_count: result.sources.length,
          retrieved_doc_ids: result.retrieved_document_ids,
        });
      } catch (err: any) {
        if (reqId !== requestCounter.current) return;
        setError(err.message || "Failed to get an answer");
        setStatus("error");
      } finally {
        if (reqId === requestCounter.current) {
          setAsking(false);
          askingRef.current = false;
        }
      }
    },
    [upsertSessionInList],
  );

  const sendMessage = useCallback(
    async (text?: string) => {
      const question = (text ?? inputRef.current).trim();
      if (!question || askingRef.current) return;

      setInput("");
      setLastQuestion(question);
      lastQuestionRef.current = question;

      await runAssistant(question, sessionRef.current, false);
    },
    [runAssistant],
  );

  const regenerate = useCallback(async () => {
    const question = lastQuestionRef.current;
    if (!question || askingRef.current || !sessionRef.current) return;

    const msgs = messagesRef.current;
    if (msgs.length >= 2) {
      const lastAssistant = msgs[msgs.length - 1];
      if (lastAssistant.role === "assistant") {
        setMessages((prev) => prev.slice(0, -1));
        messagesRef.current = messagesRef.current.slice(0, -1);
      }
    }

    await runAssistant(question, sessionRef.current, true);
  }, [runAssistant]);

  const retryLast = useCallback(async () => {
    const question = lastQuestionRef.current;
    if (!question || askingRef.current) return;

    const msgs = messagesRef.current;
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
      setMessages((prev) => prev.slice(0, -1));
      messagesRef.current = messagesRef.current.slice(0, -1);
    }

    await runAssistant(question, sessionRef.current, true);
  }, [runAssistant]);

  const newChat = useCallback(() => {
    requestCounter.current++;
    sessionRef.current = null;
    setCurrentSession(null);
    setMessages([]);
    messagesRef.current = [];
    setError(null);
    setStatus("idle");
    setLastFollowUps([]);
    setLastQuestion(null);
    lastQuestionRef.current = null;
    setAsking(false);
    askingRef.current = false;
  }, []);

  const openSession = useCallback(
    async (sessionId: string) => {
      if (askingRef.current) {
        requestCounter.current++;
        setAsking(false);
        askingRef.current = false;
      }

      const reqId = ++requestCounter.current;
      setLoading(true);
      setError(null);
      try {
        const s = sessions.find((x) => x.id === sessionId);
        if (!s) {
          setError("Session not found");
          return;
        }
        if (reqId !== requestCounter.current) return;

        sessionRef.current = s;
        setCurrentSession(s);
        const msgs = normalizeMessages(await getChatMessages(sessionId));
        if (reqId !== requestCounter.current) return;

        setMessages(msgs);
        messagesRef.current = msgs;
        setStatus("idle");
        setLastFollowUps([]);
        setLastQuestion(null);
        lastQuestionRef.current = null;

        if (msgs.length > 0) {
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "user") {
              lastQuestionRef.current = msgs[i].content;
              setLastQuestion(msgs[i].content);
              break;
            }
          }
        }
      } catch (err: any) {
        if (reqId !== requestCounter.current) return;
        setError(err.message || "Failed to load conversation");
      } finally {
        if (reqId === requestCounter.current) {
          setLoading(false);
        }
      }
    },
    [sessions],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteChatSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        logChatActivity("knowledge_question", "Deleted a chat session", { session_id: sessionId });

        if (sessionRef.current?.id === sessionId) {
          newChat();
        }
      } catch (err: any) {
        setError(err.message || "Failed to delete conversation");
      }
    },
    [newChat],
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      try {
        await updateChatSessionTitle(sessionId, title);
        setSessions((prev) =>
          prev
            .map((s) => (s.id === sessionId ? { ...s, title, updated_at: new Date().toISOString() } : s))
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
        );
        if (sessionRef.current?.id === sessionId) {
          const updated = { ...sessionRef.current, title };
          sessionRef.current = updated;
          setCurrentSession(updated);
        }
      } catch (err: any) {
        setError(err.message || "Failed to rename conversation");
      }
    },
    [],
  );

  const clearConversation = useCallback(() => {
    requestCounter.current++;
    setMessages([]);
    messagesRef.current = [];
    setError(null);
    setStatus("idle");
    setLastFollowUps([]);
    setLastQuestion(null);
    lastQuestionRef.current = null;
    setAsking(false);
    askingRef.current = false;
  }, []);

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
    regenerate,
    retryLast,
    newChat,
    openSession,
    deleteSession,
    renameSession,
    clearConversation,
    clearError,
    lastFollowUps,
    lastQuestion,
  };
}
