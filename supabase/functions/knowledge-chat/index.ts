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
  score: number;
  matched_excerpt: string;
}

const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_DOCS_TO_RETRIEVE = 5;
const MAX_EXCERPT_LENGTH = 1500;
const MAX_CONTEXT_CHARS = 8000;
const MAX_ANSWER_TOKENS = 1200;

const SYSTEM_PROMPT = `You are MediaMind AI, a knowledge assistant for a media and advertising company. You answer questions based ONLY on the supplied document context from the user's Knowledge Base.

GROUNDING RULES:
1. Answer only from the supplied document context when the question concerns the Knowledge Base.
2. If the documents do not contain enough information to answer, clearly say: "The uploaded documents do not contain enough information to answer this question."
3. Never invent facts, figures, document names, or citations.
4. Cite sources using [1], [2], [3] notation matching the SOURCE numbers provided in the context.
5. Keep answers clear, professional, and well-structured.
6. Distinguish document facts from general suggestions — if you offer a general suggestion not from the documents, label it as "General suggestion (not from documents)."
7. When comparing documents, reference them by their titles and citation numbers.
8. When creating content ideas, base them on themes and topics found in the documents.

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

    // ── Retrieval: fetch documents with ai_status ready or status Ready/Indexed ──
    const { data: allDocs, error: fetchError } = await supabase
      .from("documents")
      .select("id, title, summary, keywords, category, type, extracted_text, ai_status, status")
      .or("ai_status.eq.ready,status.in.(Ready,Indexed)");

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
    const relevantDocs = scored
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_DOCS_TO_RETRIEVE) as RetrievedDoc[];

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

    if (relevantDocs.length > 0) {
      const contextParts: string[] = [];
      let totalChars = 0;

      for (let i = 0; i < relevantDocs.length; i++) {
        const doc = relevantDocs[i];
        const citationNum = i + 1;

        // Truncate excerpt to safe size
        let excerpt = doc.matched_excerpt || doc.summary || "";
        if (excerpt.length > MAX_EXCERPT_LENGTH) {
          excerpt = excerpt.slice(0, MAX_EXCERPT_LENGTH) + "...";
        }

        const block = [
          `SOURCE ${citationNum}`,
          `Document ID: ${doc.id}`,
          `Title: ${doc.title}`,
          `Summary: ${doc.summary || "N/A"}`,
          `Keywords: ${(doc.keywords || []).join(", ") || "N/A"}`,
          `Category: ${doc.category}`,
          `Relevant excerpt: ${excerpt}`,
        ].join("\n");

        if (totalChars + block.length > MAX_CONTEXT_CHARS) break;
        contextParts.push(block);
        totalChars += block.length;

        sources.push({
          id: doc.id,
          title: doc.title,
          category: doc.category,
          type: doc.type,
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
        retrieved_document_ids: relevantDocs.map((d) => d.id),
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
