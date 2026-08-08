import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getOpenRouterApiKey } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface KnowledgeChatRequest {
  question: string;
  history?: ChatHistoryMessage[];
}

interface RetrievedDoc {
  id: string;
  title: string;
  summary: string | null;
  keywords: string[] | null;
  category: string;
  type: string;
  extracted_text: string | null;
  uploaded_at?: string | null;
    score: number;
  matched_excerpt: string;
}

const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_DOCS_TO_RETRIEVE = 5;
const MAX_EXCERPT_LENGTH = 1500;
const MAX_CONTEXT_CHARS = 8000;
const MAX_ANSWER_TOKENS = 1200;

const AGGREGATE_PATTERNS = [
  /summarize\s+(my\s+)?(uploaded\s+)?documents?/i,
  /summarize\s+(my\s+)?knowledge\s+base/i,
  /what\s+(are\s+the\s+)?main\s+themes?\s+in\s+(my\s+)?knowledge\s+base/i,
  /compare\s+(my\s+)?(recent\s+)?documents?/i,
  /create\s+(content\s+)?ideas?\s+from\s+(my\s+)?documents?/i,
  /what\s+insights?\s+appear\s+in\s+(my\s+)?reports?/i,
  /summarize\s+(my\s+)?reports?/i,
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function isAggregateKnowledgeQuestion(question: string): boolean {
  const normalized = normalizeText(question).toLowerCase();
  if (!normalized) return false;
  return AGGREGATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isReadyStatus(value: string | null | undefined): boolean {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "ready" || normalized === "indexed";
}

function isUnavailableOrProcessing(value: string | null | undefined): boolean {
  const normalized = normalizeText(value).toLowerCase();
  return (
    normalized.includes("failed") ||
    normalized.includes("processing") ||
    normalized.includes("pending") ||
    normalized.includes("extracting") ||
    normalized.includes("ai_processing") ||
    normalized.includes("running")
  );
}

function getRecentUsableDocuments(docs: Array<{ id: string; title: string; summary: string | null; keywords: string[] | null; category: string; type: string; extracted_text: string | null; ai_status: string | null; status: string | null; uploaded_at?: string | null;  }>): RetrievedDoc[] {
  return docs
    .filter((doc) => {
      const hasReadyAiStatus = isReadyStatus(doc.ai_status);
      const hasReadyStatus = isReadyStatus(doc.status);
      const hasProcessingIssue = isUnavailableOrProcessing(doc.ai_status) || isUnavailableOrProcessing(doc.status);
      const hasUsefulContent = Boolean(normalizeText(doc.summary) || normalizeText(doc.extracted_text));

      return (hasReadyAiStatus || hasReadyStatus) && !hasProcessingIssue && hasUsefulContent;
    })
    .sort((a, b) => {
      const aTime = new Date(a.uploaded_at || a.uploaded_at || 0).getTime();
      const bTime = new Date(b.uploaded_at || b.uploaded_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, MAX_DOCS_TO_RETRIEVE)
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      summary: doc.summary,
      keywords: doc.keywords,
      category: doc.category,
      type: doc.type,
      extracted_text: doc.extracted_text,
      uploaded_at: doc.uploaded_at,
      
      score: 0,
      matched_excerpt: "",
    }));
}

const SYSTEM_PROMPT = `You are MediaMind AI, a knowledge assistant for a media and advertising company. You answer questions based ONLY on the supplied document context from the user's Knowledge Base.

GROUNDING RULES:
1. Answer only from the supplied document context when the question concerns the Knowledge Base.
2. If the documents do not contain enough information to answer, clearly say: "The uploaded documents do not contain enough information to answer this question."
3. Never invent facts, figures, document names, or citations.
4. Never guess, infer, speculate, or use phrases such as "likely", "probably", "may", or "appears to" when the document does not explicitly provide the information. Instead, state: "The document does not provide specific details on this point."
5. Cite sources using [1], [2], [3] notation matching the SOURCE numbers provided in the context.
6. Keep answers clear, professional, and well-structured.
7. Distinguish document facts from general suggestions — if you offer a general suggestion not from the documents, label it as "General suggestion (not from documents)."
8. When comparing documents, reference them by their titles and citation numbers.
9. When creating content ideas, base them on themes and topics found in the documents.

Return your response as a JSON object:
{
  "answer": "Your detailed answer with [1], [2] citations",
  "follow_ups": ["Optional follow-up question 1", "Optional follow-up question 2"]
}
Return ONLY valid JSON with no markdown formatting or code blocks.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: KnowledgeChatRequest = await req.json();
    const { question, history = [] } = body;

    // ── Input validation ──────────────────────────────────────
    if (!question || !question.trim()) {
      return new Response(
        JSON.stringify({ error: "Question is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmedHistory = (history || []).slice(-MAX_HISTORY_MESSAGES);

    // ── Environment ────────────────────────────────────────────
    // Load OpenRouter API key with automatic fallback to the backup key.
    // See supabase/functions/_shared/openrouter.ts for details.
    const openrouterApiKey = getOpenRouterApiKey();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const aggregateIntent = isAggregateKnowledgeQuestion(question);
    console.log("[knowledge-chat] aggregateIntent", {
      detected: aggregateIntent,
      questionPreview: question.slice(0, 120),
    });

    // ── Retrieval: fetch documents with ai_status ready or status Ready/Indexed ──
    const { data: allDocs, error: fetchError } = await supabase
      .from("documents")
      .select("id, title, summary, keywords, category, type, extracted_text, ai_status, status, uploaded_at")
      .or("ai_status.eq.ready,status.in.(Ready,Indexed)")
      .order("uploaded_at", { ascending: false });

    if (fetchError) {
      console.error("Document retrieval error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to retrieve documents from the knowledge base." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const docs = (allDocs || []) as Array<{
      id: string;
      title: string;
      summary: string | null;
      keywords: string[] | null;
      category: string;
      type: string;
      extracted_text: string | null;
      ai_status: string | null;
      status: string;
    }>;

    // ── Rank documents by relevance to the question ────────────
    const queryLower = question.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    const scored = docs.map((doc) => {
      let score = 0;
      let matchedExcerpt = "";

      // Title matches — highest weight
      const titleLower = (doc.title || "").toLowerCase();
      if (titleLower.includes(queryLower)) {
        score += 100;
        matchedExcerpt = doc.title;
      } else {
        for (const term of queryTerms) {
          if (titleLower.includes(term)) score += 20;
        }
      }

      // Summary matches — high weight
      const summaryLower = (doc.summary || "").toLowerCase();
      if (summaryLower) {
        if (summaryLower.includes(queryLower)) {
          score += 60;
          if (!matchedExcerpt) {
            const idx = summaryLower.indexOf(queryLower);
            const start = Math.max(0, idx - 50);
            const end = Math.min(summaryLower.length, idx + queryLower.length + 100);
            matchedExcerpt = (doc.summary || "").slice(start, end);
          }
        } else {
          for (const term of queryTerms) {
            if (summaryLower.includes(term)) score += 10;
          }
        }
      }

      // Keywords matches — medium weight
      const keywords = doc.keywords || [];
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        if (queryLower.includes(kwLower) || kwLower.includes(queryLower)) {
          score += 40;
          if (!matchedExcerpt) matchedExcerpt = kw;
        } else {
          for (const term of queryTerms) {
            if (kwLower.includes(term)) score += 8;
          }
        }
      }

      // Category matches — low weight
      const catLower = (doc.category || "").toLowerCase();
      if (catLower && queryLower.includes(catLower)) {
        score += 15;
      }

      // Extracted text matches — lowest weight but can find deep content
      const textLower = (doc.extracted_text || "").toLowerCase();
      if (textLower) {
        if (textLower.includes(queryLower)) {
          score += 25;
          const idx = textLower.indexOf(queryLower);
          const start = Math.max(0, idx - 80);
          const end = Math.min(textLower.length, idx + queryLower.length + 120);
          matchedExcerpt = (doc.extracted_text || "").slice(start, end);
        } else {
          let termHits = 0;
          for (const term of queryTerms) {
            if (textLower.includes(term)) termHits++;
          }
          if (termHits > 0) {
            score += termHits * 5;
            // Find first matching term for excerpt
            for (const term of queryTerms) {
              const idx = textLower.indexOf(term);
              if (idx >= 0) {
                const start = Math.max(0, idx - 80);
                const end = Math.min(textLower.length, idx + term.length + 120);
                matchedExcerpt = (doc.extracted_text || "").slice(start, end);
                break;
              }
            }
          }
        }
      }

      return { ...doc, score, matched_excerpt: matchedExcerpt };
    });

    // Filter to docs with some relevance, sort by score, limit
    const rankedDocs = scored
      .filter((d) => d.score >= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, aggregateIntent ? MAX_DOCS_TO_RETRIEVE : 1) as RetrievedDoc[];

    const fallbackDocs = aggregateIntent && rankedDocs.length === 0
      ? getRecentUsableDocuments(docs)
      : [];

    const finalDocs = rankedDocs.length > 0 ? rankedDocs : fallbackDocs;
    const usedFallback = aggregateIntent && rankedDocs.length === 0 && fallbackDocs.length > 0;

    console.log("[knowledge-chat] retrieval-summary", {
      aggregateIntent,
      rankedCount: rankedDocs.length,
      finalCount: finalDocs.length,
      fallbackUsed: usedFallback,
    });

    // ── Build context ──────────────────────────────────────────
    let context = "";
    const sources: Array<{
      id: string;
      title: string;
      category: string;
      type: string;
      excerpt: string;
      citation_number: number;
    }> = [];

    if (finalDocs.length > 0) {
      const contextParts: string[] = [];
      let totalChars = 0;

      for (let i = 0; i < finalDocs.length; i++) {
        const doc = finalDocs[i];
        const citationNum = i + 1;

        const excerptSource = doc.matched_excerpt || doc.summary || doc.extracted_text || "";
        const excerpt = truncateText(excerptSource, MAX_EXCERPT_LENGTH);
        const title = normalizeText(doc.title) || "Untitled document";
        const summary = normalizeText(doc.summary) || "No summary available";
        const keywords = (doc.keywords || []).join(", ") || "N/A";
        const category = normalizeText(doc.category) || "Uncategorized";
        const type = normalizeText(doc.type) || "Document";
        const extractedText = truncateText(doc.extracted_text, 5000);

        const block = [
          `SOURCE ${citationNum}`,
          `Document ID: ${doc.id}`,
          `Title: ${title}`,
          `Summary: ${summary}`,
          `Keywords: ${keywords}`,
          `Category: ${category}`,
          `Type: ${type}`,
          `Relevant excerpt: ${excerpt}`,
          `Extracted text: ${extractedText}`,
        ].join("\n");

        if (totalChars + block.length > MAX_CONTEXT_CHARS) break;
        contextParts.push(block);
        totalChars += block.length;

        sources.push({
          id: doc.id,
          title,
          category,
          type,
          excerpt,
          citation_number: citationNum,
        });
      }

      context = contextParts.join("\n\n");
    }

    // ── Build messages for OpenRouter ──────────────────────────
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history (safe max already applied)
    for (const msg of trimmedHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Build user message with context
    let userMessage = "";
    if (context) {
      userMessage += `Here are the relevant documents from the Knowledge Base:\n\n${context}\n\n`;
    } else {
      userMessage += "No relevant documents were found in the Knowledge Base for this question.\n\n";
    }
    userMessage += `Question: ${question.trim()}`;

    messages.push({ role: "user", content: userMessage });

    // ── Call OpenRouter ─────────────────────────────────────────
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        temperature: 0.3,
        max_tokens: MAX_ANSWER_TOKENS,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenRouter API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI failed to generate an answer. Please try again in a moment." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const rawContent: string | null = aiData.choices?.[0]?.message?.content ?? null;

    if (!rawContent) {
      return new Response(
        JSON.stringify({ error: "AI returned no content. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Parse structured JSON response ──────────────────────────
    let answer = rawContent;
    let followUps: string[] = [];

    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.answer === "string" && parsed.answer.trim()) {
        answer = parsed.answer;
      }
      if (Array.isArray(parsed.follow_ups)) {
        followUps = parsed.follow_ups.filter((f: unknown) => typeof f === "string").slice(0, 3);
      }
    } catch {
      // If JSON parsing fails, use raw content as the answer
    }

    return new Response(
      JSON.stringify({
        answer,
        sources,
        retrieved_document_ids: finalDocs.map((d) => d.id),
        follow_ups: followUps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Knowledge chat error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
