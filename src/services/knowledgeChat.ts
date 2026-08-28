import { supabase } from "../lib/supabase";
import { requireActiveWorkspaceId, withActiveWorkspace } from "../utils/workspaceOwnership";
import { invokeAuthenticatedEdgeFunction } from "./edgeFunctions";

export interface ChatSource {
  id: string;
  title: string;
  category: string;
  type: string;
  excerpt: string;
  citation_number: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[] | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  workspace_id: string | null;
}

export interface KnowledgeChatResult {
  answer: string;
  sources: ChatSource[];
  retrieved_document_ids: string[];
  follow_ups: string[];
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export function normalizeSources(value: unknown): ChatSource[] {
  const isValidSource = (entry: unknown): entry is ChatSource => {
    if (!entry || typeof entry !== "object") return false;

    const source = entry as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const title = typeof source.title === "string" ? source.title.trim() : "";
    const category = typeof source.category === "string" ? source.category.trim() : "";
    const type = typeof source.type === "string" ? source.type.trim() : "";
    const excerpt = typeof source.excerpt === "string" ? source.excerpt : "";
    const citationNumber = Number(source.citation_number);

    return (
      Boolean(id) &&
      Boolean(title) &&
      Boolean(category) &&
      Boolean(type) &&
      Number.isFinite(citationNumber) &&
      citationNumber >= 0 &&
      typeof excerpt === "string"
    );
  };

  if (Array.isArray(value)) {
    return value.filter(isValidSource);
  }

  if (typeof value === "string") {
    try {
      return normalizeSources(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;

    if (Array.isArray(candidate.sources)) {
      return normalizeSources(candidate.sources);
    }

    const nestedArray = Object.values(candidate).find(Array.isArray);
    if (nestedArray) {
      return normalizeSources(nestedArray);
    }
  }

  return [];
}

const MAX_HISTORY = 10;

export async function askKnowledgeBase(
  question: string,
  history: HistoryMessage[],
): Promise<KnowledgeChatResult> {
  const response = await invokeAuthenticatedEdgeFunction("knowledge-chat", {
    question,
    history: history.slice(-MAX_HISTORY),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to get an answer. Please try again.");
  }

  return {
    answer: data.answer || "",
    sources: normalizeSources(data.sources),
    retrieved_document_ids: Array.isArray(data.retrieved_document_ids) ? data.retrieved_document_ids : [],
    follow_ups: Array.isArray(data.follow_ups) ? data.follow_ups : [],
  };
}

export async function createChatSession(title: string): Promise<ChatSession> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert(withActiveWorkspace({ title }))
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create chat session: ${error.message}`);
  return data as ChatSession;
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("workspace_id", requireActiveWorkspaceId())
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to load chat sessions: ${error.message}`);
  return (data || []) as ChatSession[];
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);

  return (data || []).map((message) => ({
    ...message,
    sources: normalizeSources(message?.sources ?? []),
  })) as ChatMessage[];
}

export async function saveChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  sources: ChatSource[] | null,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      sources: sources ? JSON.stringify(sources) : null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);

  return {
    ...data,
    sources: normalizeSources(data?.sources ?? []),
  } as ChatMessage;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw new Error(`Failed to delete session: ${error.message}`);
}

export async function updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) throw new Error(`Failed to update session title: ${error.message}`);
}

export function generateSessionTitle(question: string): string {
  const trimmed = question.trim();
  if (trimmed.length <= 50) return trimmed;
  return trimmed.slice(0, 47) + "...";
}

export async function logChatActivity(
  type: "knowledge_question" | "ai_answer" | "draft_from_answer",
  description: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("activities").insert(withActiveWorkspace({
      type,
      description,
      metadata,
    }));
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
