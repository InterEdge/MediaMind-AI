import { getOpenRouterApiKey } from "../_shared/openrouter.ts";
import { authenticateEdgeRequest, edgeAuthorizationResponse, requireWorkspaceMembership } from "../_shared/edgeAuth.ts";

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
  workspaceId?: string;
}

interface RetrievedDoc {
  id: string;
  title: string;
  summary: string | null;
  keywords: string[] | null;
  category: string;
  type: string;
  extracted_text: string | null;
  uploaded_at: string | null;
  score: number;
  title_match_count: number;
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

function isBroadCoverageQuestion(question: string): boolean {
  const normalized = normalizeText(question).toLowerCase();
  return /\b(all|each|every)\b/.test(normalized) && /\b(programmes?|programs?|shows?|sections?)\b/.test(normalized);
}

const QUERY_STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "does", "each", "every", "for", "from",
  "have", "how", "into", "listed", "say", "that", "the", "their", "this", "what",
  "when", "where", "which", "with", "would", "your",
]);

function getMeaningfulQueryTerms(question: string): string[] {
  return [...new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !QUERY_STOP_WORDS.has(term)),
  )];
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function selectBestDensityWindow(text: string, queryTerms: string[], maxLength: number): string {
  if (text.length <= maxLength) return text;

  const lower = text.toLowerCase();
  const lastStart = text.length - maxLength;
  const candidates = new Set<number>([0, lastStart]);
  for (const term of queryTerms) {
    let index = lower.indexOf(term);
    while (index >= 0) {
      candidates.add(Math.max(0, Math.min(lastStart, index - Math.floor(maxLength / 2))));
      index = lower.indexOf(term, index + term.length);
    }
  }

  let bestStart = 0;
  let bestScore = -1;
  for (const start of candidates) {
    const window = lower.slice(start, start + maxLength);
    const score = queryTerms.reduce((sum, term) => {
      let occurrences = 0;
      let index = window.indexOf(term);
      while (index >= 0) {
        occurrences++;
        index = window.indexOf(term, index + term.length);
      }
      return sum + occurrences * term.length;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  return text.slice(bestStart, bestStart + maxLength).trim();
}

function selectRelevantText(
  value: string | null | undefined,
  queryTerms: string[],
  maxLength: number,
  broadCoverage: boolean,
): string {
  const text = normalizeText(value);
  if (!text || maxLength <= 0) return "";
  if (text.length <= maxLength) return text;

  if (broadCoverage) {
    const starts = new Set<number>([0]);
    for (const match of text.matchAll(/(?:about|host(?:s|\(s\))?)\s*:/gi)) {
      if (match.index !== undefined) starts.add(Math.max(0, match.index - 80));
    }
    const orderedStarts = [...starts].sort((a, b) => a - b);
    if (orderedStarts.length > 1) {
      const sections = orderedStarts.map((start, index) => text.slice(start, orderedStarts[index + 1] ?? text.length).trim());
      const separator = "\n\n";
      let remaining = Math.max(0, maxLength - separator.length * (sections.length - 1));
      const selected = sections.map((section, index) => {
        const share = Math.floor(remaining / (sections.length - index));
        const selectedSection = section.slice(0, share).trimEnd();
        remaining -= selectedSection.length;
        return selectedSection;
      });
      return selected.join(separator).slice(0, maxLength).trimEnd();
    }
  }

  return selectBestDensityWindow(text, queryTerms, maxLength);
}

function allocateMeasuredBudgets(lengths: number[], weights: number[], totalBudget: number): number[] {
  const budgets = lengths.map(() => 0);
  const remainingLengths = [...lengths];
  let remainingBudget = Math.max(0, totalBudget);

  while (remainingBudget > 0 && remainingLengths.some((length) => length > 0)) {
    const active = remainingLengths.map((length, index) => length > 0 ? index : -1).filter((index) => index >= 0);
    const totalWeight = active.reduce((sum, index) => sum + Math.max(1, weights[index]), 0);
    let distributed = 0;

    for (const index of active) {
      const share = Math.max(1, Math.floor(remainingBudget * Math.max(1, weights[index]) / totalWeight));
      const allocation = Math.min(share, remainingLengths[index], remainingBudget - distributed);
      budgets[index] += allocation;
      remainingLengths[index] -= allocation;
      distributed += allocation;
      if (distributed >= remainingBudget) break;
    }

    if (distributed <= 0) break;
    remainingBudget -= distributed;
  }

  return budgets;
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
      const aTime = new Date(a.uploaded_at || 0).getTime();
      const bTime = new Date(b.uploaded_at || 0).getTime();
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
      title_match_count: 0,
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

CRITICAL FORMATTING RULES:
- The "answer" value MUST be a plain Markdown/prose string — never an object, array, or any nested structure.
- Lists, tables, headings, programme details, and all structured information MUST be expressed as Markdown text within that string (e.g. use ## headings, - bullet points, **bold**, numbered lists).
- Do NOT return { "answer": { ... } } or { "answer": [ ... ] }. The answer key must always map to a string.
Return ONLY valid JSON with no markdown formatting or code blocks.`;

// ─── Structured-answer normaliser ───────────────────────────────────────────
// Used as a safety net when the model violates the schema and returns an object
// or array inside "answer" instead of a plain Markdown string.
// Converts arbitrary nested values into readable Markdown text so the UI never
// displays raw JSON. Does NOT make any network/API calls.

function structuredAnswerToMarkdown(value: unknown, depth = 0): string {
  // Primitives — return as string directly
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  const indent = depth > 0 ? "  ".repeat(depth) : "";

  // Array — render as a numbered or bulleted list
  if (Array.isArray(value)) {
    return value
      .map((item, i) => {
        const rendered = structuredAnswerToMarkdown(item, depth + 1);
        // Use numbered list at top level, bullets for nested
        const prefix = depth === 0 ? `${i + 1}. ` : `${indent}- `;
        return `${prefix}${rendered}`;
      })
      .join("\n");
  }

  // Plain object — render each key as a bold label followed by its value
  if (typeof value === "object") {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Convert snake_case / camelCase keys to Title Case for readability
      const label = k
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const rendered = structuredAnswerToMarkdown(v, depth + 1);

      if (rendered.includes("\n")) {
        // Multi-line child — put label on its own line as a heading/section
        lines.push(depth === 0 ? `## ${label}\n${rendered}` : `**${label}**\n${rendered}`);
      } else if (rendered) {
        lines.push(`**${label}:** ${rendered}`);
      }
    }
    return lines.join("\n\n");
  }

  return String(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await authenticateEdgeRequest(req);
    const body: KnowledgeChatRequest = await req.json();
    const workspaceId = await requireWorkspaceMembership(auth, body.workspaceId);
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

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = auth.serviceClient;
    const aggregateIntent = isAggregateKnowledgeQuestion(question);
    console.log("[knowledge-chat] aggregateIntent", {
      detected: aggregateIntent,
      questionPreview: question.slice(0, 120),
    });

    // ── Retrieval: fetch documents with ai_status ready or status Ready/Indexed ──
    const { data: allDocs, error: fetchError } = await supabase
      .from("documents")
      .select("id, title, summary, keywords, category, type, extracted_text, ai_status, status, uploaded_at")
      .eq("workspace_id", workspaceId)
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
      uploaded_at: string | null;
    }>;

    // ── Rank documents by relevance to the question ────────────
    const queryLower = question.toLowerCase();
    const queryTerms = getMeaningfulQueryTerms(question);

    const scored = docs.map((doc) => {
      let score = 0;
      let titleMatchCount = 0;
      let matchedExcerpt = "";

      // Title matches — highest weight
      const titleLower = (doc.title || "").toLowerCase();
      if (titleLower.includes(queryLower)) {
        score += 100;
        matchedExcerpt = doc.title;
      } else {
        for (const term of queryTerms) {
          if (titleLower.includes(term)) {
            score += 20;
            titleMatchCount++;
          }
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

      return { ...doc, score, title_match_count: titleMatchCount, matched_excerpt: matchedExcerpt };
    });

    // Filter to docs with some relevance, sort by score, limit.
    // Aggregate queries get up to MAX_DOCS_TO_RETRIEVE (5).
    // Specific queries get up to 3 so multi-document questions get
    // adequate context without flooding the budget.
    const NON_AGGREGATE_CAP = 3;
    const eligibleDocs = scored
      .filter((d) => d.score >= 20)
      .sort((a, b) => b.score - a.score);
    const topDoc = eligibleDocs[0];
    const normalizedQuestion = normalizeMatchText(question);
    const explicitTitleTarget = !aggregateIntent && Boolean(
      topDoc && normalizeMatchText(topDoc.title).length > 0 && normalizedQuestion.includes(normalizeMatchText(topDoc.title)),
    );
    const rankedDocs = (explicitTitleTarget ? [topDoc] : eligibleDocs)
      .slice(0, aggregateIntent ? MAX_DOCS_TO_RETRIEVE : NON_AGGREGATE_CAP) as RetrievedDoc[];

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
      const broadCoverage = isBroadCoverageQuestion(question);
      const separatorChars = Math.max(0, finalDocs.length - 1) * 2;
      const maxMetadataPerDoc = Math.floor((MAX_CONTEXT_CHARS - separatorChars) / finalDocs.length / 2);
      const preparedDocs = finalDocs.map((doc, i) => {
        const citationNum = i + 1;

        const excerptSource = doc.matched_excerpt || doc.summary || doc.extracted_text || "";
        const excerpt = truncateText(excerptSource, MAX_EXCERPT_LENGTH);
        const title = normalizeText(doc.title) || "Untitled document";
        const summary = truncateText(doc.summary, 300);
        const keywords = (doc.keywords || []).join(", ") || "N/A";
        const category = normalizeText(doc.category) || "Uncategorized";
        const type = normalizeText(doc.type) || "Document";

        const metadataBlock = normalizeText([
          `SOURCE ${citationNum}`,
          `Document ID: ${doc.id}`,
          `Title: ${title}`,
          `Summary: ${summary || "No summary available"}`,
          `Keywords: ${keywords}`,
          `Category: ${category}`,
          `Type: ${type}`,
          `Relevant excerpt: ${excerpt}`,
          `Extracted text: `,
        ].join("\n")).slice(0, maxMetadataPerDoc).trimEnd();

        return { doc, citationNum, title, category, type, excerpt, metadataBlock };
      });
      const metadataChars = preparedDocs.reduce((sum, item) => sum + item.metadataBlock.length, 0);
      const textBudget = Math.max(0, MAX_CONTEXT_CHARS - metadataChars - separatorChars);
      const textBudgets = allocateMeasuredBudgets(
        preparedDocs.map((item) => normalizeText(item.doc.extracted_text).length),
        preparedDocs.map((item) => item.doc.score),
        textBudget,
      );

      for (let i = 0; i < preparedDocs.length; i++) {
        const { doc, citationNum, title, category, type, excerpt, metadataBlock } = preparedDocs[i];
        const extractedText = selectRelevantText(doc.extracted_text, queryTerms, textBudgets[i], broadCoverage);
        contextParts.push(metadataBlock + extractedText);

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
        // Happy path — model returned a plain prose/Markdown string as required.
        answer = parsed.answer;
      } else if (parsed.answer !== null && parsed.answer !== undefined) {
        // Model violated the schema and returned a structured value (object or
        // array) inside "answer".  Convert it to readable Markdown rather than
        // leaking raw JSON to the UI.
        console.warn(
          "[knowledge-chat] model returned a non-string answer value; converting to Markdown",
          typeof parsed.answer,
        );
        const converted = structuredAnswerToMarkdown(parsed.answer).trim();
        if (converted) {
          answer = converted;
        }
        // If conversion produced an empty string (e.g. answer was {} or []),
        // answer stays as rawContent — still better than an empty response.
      }
      // If parsed.answer is absent/null the raw model output is the best fallback.

      if (Array.isArray(parsed.follow_ups)) {
        followUps = parsed.follow_ups.filter((f: unknown) => typeof f === "string").slice(0, 3);
      }
    } catch {
      // JSON.parse failed (malformed output, preamble text, token truncation).
      // Use rawContent directly — the model's prose is at least human-readable.
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
    const authResponse = edgeAuthorizationResponse(err, corsHeaders);
    if (authResponse) return authResponse;
    console.error("Knowledge chat error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
