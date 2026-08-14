import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getOpenRouterApiKey } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  contentType: string;
  topic?: string;
  tone: string;
  audience: string;
  outputLength?: string;
  documentIds?: string[];
  additionalInstructions?: string;
  templateInstructions?: string;
  objective: string;
}

interface SourceUsage {
  requestedIds: string[];
  foundIds: string[];
  usableIds: string[];
  usedIds: string[];
  unavailableIds: string[];
  unusableIds: string[];
}

interface SourceDocument {
  id: string;
  title: string;
  summary: string | null;
  extracted_text: string | null;
  keywords: string[] | null;
  category: string | null;
  type: string | null;
}

interface PassageQuery {
  phrases: string[];
  terms: string[];
}

interface ContentFormatConfig {
  system: string;
  maxTokens: number;
  supportsHeadline: boolean;
  supportsCTA: boolean;
  supportsHashtags: boolean;
}

const LENGTH_GUIDE: Record<string, { words: string; note: string }> = {
  Short: { words: "50-100 words", note: "Keep it concise and punchy." },
  Medium: { words: "150-250 words", note: "A balanced length with enough detail." },
  Long: { words: "400-600 words", note: "Comprehensive and detailed." },
};

const contentTypeConfig: Record<string, ContentFormatConfig> = {
  "LinkedIn Post": {
    system:
      "You are an expert B2B content writer for the media and advertising industry. Write a compelling LinkedIn post. Use a strong hook in the first line, structure with short paragraphs, include actionable insights, and end with a question to drive engagement.",
    maxTokens: 1000,
    supportsHeadline: true,
    supportsCTA: true,
    supportsHashtags: true,
  },
  "Facebook Post": {
    system:
      "You are an expert social media writer for the media and advertising industry. Write an engaging Facebook post that encourages comments and shares. Use a conversational tone, ask questions, and include a clear call to action.",
    maxTokens: 1000,
    supportsHeadline: true,
    supportsCTA: true,
    supportsHashtags: true,
  },
  "X Post": {
    system:
      "You are an expert social media writer. Write a single Twitter/X post (max 280 characters) that is punchy, engaging, and shareable. Make every word count.",
    maxTokens: 400,
    supportsHeadline: false,
    supportsCTA: true,
    supportsHashtags: true,
  },
  "X Thread": {
    system:
      "You are an expert B2B content writer. Write a Twitter/X thread of 5-8 tweets. Each tweet must be under 280 characters. Start with a strong hook tweet, deliver value in each subsequent tweet, and end with a CTA tweet. Format each tweet separated by '---'.",
    maxTokens: 1500,
    supportsHeadline: true,
    supportsCTA: true,
    supportsHashtags: true,
  },
  "Instagram Caption": {
    system:
      "You are an expert Instagram copywriter for the media and advertising industry. Write an engaging Instagram caption with a compelling opening, storytelling elements, and a clear call to action. Use emojis sparingly and appropriately.",
    maxTokens: 800,
    supportsHeadline: false,
    supportsCTA: true,
    supportsHashtags: true,
  },
  "Press Release": {
    system:
      "You are an expert PR writer for the media and advertising industry. Write a professional press release with a clear headline (prefixed with 'FOR IMMEDIATE RELEASE: '), dateline, introduction summarizing the news, 2-3 body paragraphs with quotes, and a boilerplate section. Use formal journalistic style.",
    maxTokens: 2000,
    supportsHeadline: true,
    supportsCTA: false,
    supportsHashtags: false,
  },
  "Newsletter": {
    system:
      "You are an expert newsletter writer for the media and advertising industry. Write a newsletter section with a compelling subject line (prefixed with 'SUBJECT: '), a brief intro, 3 key insights with subheadings, and a closing thought. Keep it informative and engaging.",
    maxTokens: 1800,
    supportsHeadline: true,
    supportsCTA: true,
    supportsHashtags: false,
  },
  "Blog Article": {
    system:
      "You are an expert B2B blog writer for the media and advertising industry. Write a well-structured blog article with a compelling title, an engaging introduction, 3-4 sections with H2 subheadings, and a conclusion with a CTA. Use markdown formatting with # for the title and ## for subheadings.",
    maxTokens: 2500,
    supportsHeadline: true,
    supportsCTA: true,
    supportsHashtags: true,
  },
  "Sales Email": {
    system:
      "You are an expert sales copywriter for a media and advertising technology company. Write a persuasive sales email. Include a compelling subject line (prefixed with 'SUBJECT: '), a personalized opening, a clear value proposition, social proof, and a soft CTA.",
    maxTokens: 800,
    supportsHeadline: true,
    supportsCTA: true,
    supportsHashtags: false,
  },
};

const VALID_CONTENT_TYPES = Object.keys(contentTypeConfig);
const VALID_TONES = ["Professional", "Conversational", "Authoritative", "Friendly", "Persuasive", "Educational"];
const VALID_LENGTHS = ["Short", "Medium", "Long"];
const VALID_OBJECTIVES = ["Inform", "Educate", "Promote", "Announce", "Engage", "Persuade"];
const MAX_DOCUMENT_CONTEXT_CHARS = 8000;
const DOCUMENT_CONTEXT_PREFIX = "\n\nReference material from the knowledge base:\n";
const MIN_BODY_CHARS = 200;
const QUERY_STOP_WORDS = new Set([
  "about", "additional", "also", "and", "are", "available", "base", "based", "contained",
  "content", "create", "description", "document", "estimate", "explicitly", "facts", "for", "from",
  "include", "infer", "information", "into", "invent", "knowledge", "missing", "not", "objective",
  "only", "please", "ratings", "selected", "summary", "target", "that", "the", "their", "this",
  "time", "tone", "use", "using", "what", "when", "where", "which", "with", "write", "your",
]);

const STRICT_GROUNDING_PATTERNS = [
  /\buse only facts?\b/i,
  /\bonly use information\b/i,
  /\bexplicitly contained\b/i,
  /\bbased only on\b/i,
  /\bdo not infer\b/i,
  /\bdo not estimate\b/i,
  /\bdo not invent\b/i,
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const text = normalizeText(value);
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function tokenizeQuery(value: string | null | undefined): string[] {
  return normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !QUERY_STOP_WORDS.has(term));
}

function buildPassageQuery(
  topic: string | null | undefined,
  objective: string | null | undefined,
  additionalInstructions: string | null | undefined,
): PassageQuery {
  const topicTerms = tokenizeQuery(topic);
  const terms = [...new Set([...topicTerms, ...tokenizeQuery(objective), ...tokenizeQuery(additionalInstructions)])];
  const phrases = new Set<string>();
  const topicRuns = normalizeText(topic).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .reduce<string[][]>((runs, term) => {
      if (term.length > 2 && !QUERY_STOP_WORDS.has(term)) {
        runs[runs.length - 1].push(term);
      } else if (runs[runs.length - 1].length > 0) {
        runs.push([]);
      }
      return runs;
    }, [[]]);
  for (const run of topicRuns) {
    for (const size of [3, 2]) {
      for (let index = 0; index <= run.length - size; index++) {
        phrases.add(run.slice(index, index + size).join(" "));
      }
    }
  }
  return { phrases: [...phrases], terms };
}

function isStrictGroundingRequest(...values: Array<string | null | undefined>): boolean {
  const requestText = values.map(normalizeText).filter(Boolean).join(" ");
  return STRICT_GROUNDING_PATTERNS.some((pattern) => pattern.test(requestText));
}

function countTermMatches(value: string | null | undefined, terms: string[]): number {
  const text = normalizeText(value).toLowerCase();
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function scoreDocument(doc: SourceDocument, query: PassageQuery): number {
  const phraseScore = query.phrases.reduce((score, phrase) => {
    return score + countTermMatches(doc.title, [phrase]) * 80 +
      countTermMatches(doc.summary, [phrase]) * 30 +
      countTermMatches(doc.extracted_text, [phrase]) * 10;
  }, 0);
  return phraseScore + countTermMatches(doc.title, query.terms) * 20 +
    countTermMatches(doc.summary, query.terms) * 8 +
    countTermMatches((doc.keywords ?? []).join(" "), query.terms) * 6 +
    countTermMatches(doc.extracted_text, query.terms) * 2;
}

function selectRelevantPassage(text: string, query: PassageQuery, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (text.length <= maxLength) return text;

  const lower = text.toLowerCase();
  const lastStart = text.length - maxLength;
  const candidates = new Set<number>([0, lastStart]);
  for (const anchor of [...query.phrases, ...query.terms]) {
    let index = lower.indexOf(anchor);
    while (index >= 0) {
      candidates.add(Math.max(0, Math.min(lastStart, index - Math.floor(maxLength / 2))));
      index = lower.indexOf(anchor, index + anchor.length);
    }
  }

  let bestStart = 0;
  let bestScore = -1;
  for (const start of candidates) {
    const window = lower.slice(start, start + maxLength);
    const phraseScore = query.phrases.reduce((sum, phrase) => {
      let matches = 0;
      let index = window.indexOf(phrase);
      while (index >= 0) {
        matches++;
        index = window.indexOf(phrase, index + phrase.length);
      }
      return sum + matches * phrase.length * 50;
    }, 0);
    const termScore = query.terms.reduce((sum, term) => {
      let matches = 0;
      let index = window.indexOf(term);
      while (index >= 0) {
        matches++;
        index = window.indexOf(term, index + term.length);
      }
      return sum + matches * term.length;
    }, 0);
    const score = phraseScore + termScore;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  return text.slice(bestStart, bestStart + maxLength).trim();
}

function allocateBudgets(lengths: number[], weights: number[], total: number): number[] {
  const budgets = lengths.map(() => 0);
  const remaining = [...lengths];
  let available = Math.max(0, total);

  while (available > 0 && remaining.some((length) => length > 0)) {
    const active = remaining.map((length, index) => length > 0 ? index : -1).filter((index) => index >= 0);
    const totalWeight = active.reduce((sum, index) => sum + Math.max(1, weights[index]), 0);
    let distributed = 0;
    for (const index of active) {
      const share = Math.max(1, Math.floor(available * Math.max(1, weights[index]) / totalWeight));
      const allocation = Math.min(share, remaining[index], available - distributed);
      budgets[index] += allocation;
      remaining[index] -= allocation;
      distributed += allocation;
      if (distributed >= available) break;
    }
    if (distributed === 0) break;
    available -= distributed;
  }

  return budgets;
}

function buildDocumentContext(docs: SourceDocument[], query: PassageQuery): { context: string; usedIds: string[] } {
  const blocksCap = MAX_DOCUMENT_CONTEXT_CHARS - DOCUMENT_CONTEXT_PREFIX.length;
  const ranked = docs
    .map((doc, requestIndex) => ({ doc, requestIndex, score: scoreDocument(doc, query) }))
    .sort((a, b) => b.score - a.score || a.requestIndex - b.requestIndex);

  const prepared = ranked.map(({ doc, score }) => {
    const metadata = [
      `Document ID: ${doc.id}`,
      `Title: ${truncateText(doc.title, 200) || "Untitled document"}`,
      `Summary: ${truncateText(doc.summary, 400) || "No summary available"}`,
      `Keywords: ${truncateText((doc.keywords ?? []).join(", "), 300) || "N/A"}`,
      `Category: ${truncateText(doc.category, 100) || "Uncategorized"}`,
      `Type: ${truncateText(doc.type, 100) || "Document"}`,
      "Content: ",
    ].join("\n");
    return { doc, score, metadata };
  });

  const included: typeof prepared = [];
  let fixedChars = 0;
  for (const item of prepared) {
    const separatorChars = included.length > 0 ? 2 : 0;
    const reservedBodyChars = (included.length + 1) * MIN_BODY_CHARS;
    if (fixedChars + separatorChars + item.metadata.length + reservedBodyChars <= blocksCap) {
      included.push(item);
      fixedChars += separatorChars + item.metadata.length;
    }
  }

  const bodyBudget = Math.max(0, blocksCap - fixedChars);
  const budgets = allocateBudgets(
    included.map(({ doc }) => normalizeText(doc.extracted_text).length),
    included.map(({ score }) => score),
    bodyBudget,
  );
  const blocks: string[] = [];
  const usedIds: string[] = [];
  for (let index = 0; index < included.length; index++) {
    const item = included[index];
    const passage = selectRelevantPassage(normalizeText(item.doc.extracted_text), query, budgets[index]);
    if (!passage) continue;
    const separator = blocks.length > 0 ? "\n\n" : "";
    const block = item.metadata + passage;
    if (blocks.join("\n\n").length + separator.length + block.length > blocksCap) continue;
    blocks.push(block);
    usedIds.push(item.doc.id);
  }

  return { context: blocks.join("\n\n"), usedIds };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: GenerateRequest = await req.json();
    const {
      contentType,
      topic,
      tone,
      audience,
      outputLength = "Medium",
      documentIds = [],
      additionalInstructions,
      templateInstructions,
      objective,
    } = body;

    // ── Input validation ──────────────────────────────────────
    if (!contentType || !VALID_CONTENT_TYPES.includes(contentType)) {
      return new Response(
        JSON.stringify({ error: `Invalid content type. Must be one of: ${VALID_CONTENT_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tone || !VALID_TONES.includes(tone)) {
      return new Response(
        JSON.stringify({ error: `Invalid tone. Must be one of: ${VALID_TONES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!outputLength || !VALID_LENGTHS.includes(outputLength)) {
      return new Response(
        JSON.stringify({ error: `Invalid output length. Must be one of: ${VALID_LENGTHS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!audience?.trim()) {
      return new Response(
        JSON.stringify({ error: "Target audience is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!objective || !VALID_OBJECTIVES.includes(objective)) {
      return new Response(
        JSON.stringify({ error: `Invalid objective. Must be one of: ${VALID_OBJECTIVES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Must have either a topic or documents or additional instructions
    const hasTopic = topic?.trim();
    const hasDocs = documentIds.length > 0;
    const hasInstructions = additionalInstructions?.trim();
    const hasTemplateInstructions = templateInstructions?.trim();

    if (!hasTopic && !hasDocs && !hasInstructions && !hasTemplateInstructions) {
      return new Response(
        JSON.stringify({ error: "Provide a topic, select at least one document, or add custom instructions to generate content." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    // ── Gather document context ───────────────────────────────
    let documentContext = "";
    const requestedIds = [...new Set(documentIds)];
    const sourceUsage: SourceUsage = {
      requestedIds,
      foundIds: [],
      usableIds: [],
      usedIds: [],
      unavailableIds: [],
      unusableIds: [],
    };
    const strictGrounding = requestedIds.length > 0
      && isStrictGroundingRequest(topic, [templateInstructions, additionalInstructions].filter(Boolean).join("\n"));
    if (documentIds.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("id, title, summary, extracted_text, keywords, category, type")
        .in("id", requestedIds);

      if (docsError) {
        return new Response(
          JSON.stringify({ error: "Selected Knowledge Base documents could not be retrieved." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const foundById = new Map(((docs ?? []) as SourceDocument[]).map((doc) => [doc.id, doc]));
      const foundDocs = requestedIds.flatMap((id) => foundById.has(id) ? [foundById.get(id)!] : []);
      const usableDocs = foundDocs.filter((doc) => normalizeText(doc.extracted_text).length > 0);
      sourceUsage.foundIds = foundDocs.map((doc) => doc.id);
      sourceUsage.usableIds = usableDocs.map((doc) => doc.id);
      sourceUsage.unavailableIds = requestedIds.filter((id) => !foundById.has(id));
      sourceUsage.unusableIds = foundDocs.filter((doc) => !normalizeText(doc.extracted_text)).map((doc) => doc.id);

      const passageQuery = buildPassageQuery(topic, objective, additionalInstructions);
      const built = buildDocumentContext(usableDocs, passageQuery);
      sourceUsage.usedIds = built.usedIds;
      if (built.context) {
        documentContext = DOCUMENT_CONTEXT_PREFIX + built.context;
      }
    }

    // ── Build prompts ──────────────────────────────────────────
    const config = contentTypeConfig[contentType];
    const lengthGuide = LENGTH_GUIDE[outputLength];

    let systemPrompt = config.system;
    systemPrompt += `\n\nTone: ${tone}.`;
    systemPrompt += `\nTarget audience: ${audience}.`;
    systemPrompt += `\nObjective: ${objective}.`;
    systemPrompt += `\nOutput length: ${outputLength} (${lengthGuide.words}). ${lengthGuide.note}`;
    if (sourceUsage.requestedIds.length > 0) {
      systemPrompt += "\n\nGrounding rules: Use the supplied Knowledge Base material as the only source for company-, programme-, product-, campaign-, or document-specific facts. Do not invent facts, names, figures, quotations, or claims that are absent from the supplied material. If a requested specific fact is missing, omit it or state the limitation without fabricating it. These grounding rules and the supplied facts always outrank template and additional instructions.";
    }
    if (strictGrounding) {
      systemPrompt += `\n\nSTRICT FACTUAL MODE: Follow this priority order:
1. Source fidelity: every factual statement must be directly supported by the supplied Knowledge Base material.
2. Requested-field completeness: include every factual field explicitly requested by the user when its value is available in the supplied material. Before responding, check each requested field against the context so an available value is not omitted.
3. Unsupported fields: never invent a value to complete a requested field. Omit an unavailable field or explicitly say the selected source does not provide it.
4. User-requested format and style.
5. Marketing creativity.
Do not reproduce every fact in the document; prioritize facts explicitly requested by the user and facts clearly necessary to answer the topic. Prefer neutral factual wording. Harmless descriptive language is allowed only when it does not imply an unsupported evaluation. Headlines and hooks may provide creative framing but must not add factual claims. CTAs and engagement questions may invite discussion but must not assert unsupported facts. Hashtags may describe supported topics or entities but must not introduce unsupported claims.`;
    }

    // Structured output instructions
    const structuredParts: string[] = [
      '\n\nReturn your response as a JSON object with the following structure:',
      '{',
      '  "content": "The main generated content as a single string (use \\n for line breaks)",',
    ];
    if (config.supportsHeadline) {
      structuredParts.push('  "headline": "A suggested headline or hook for this content",');
    }
    if (config.supportsCTA) {
      structuredParts.push('  "cta": "A suggested call to action",');
    }
    if (config.supportsHashtags) {
      structuredParts.push('  "hashtags": ["relevant", "hashtags", "without", "the", "hash", "symbol"]');
    }
    structuredParts.push('}');
    structuredParts.push('Return ONLY valid JSON with no markdown formatting, no code blocks, and no explanation.');
    systemPrompt += structuredParts.join("\n");

    let userPrompt = "";
    if (topic?.trim()) {
      userPrompt += `Topic: ${topic.trim()}`;
    }
    if (documentContext) {
      userPrompt += documentContext;
    }
    if (templateInstructions?.trim()) {
      userPrompt += `\n\nTemplate instructions: ${templateInstructions.trim()}`;
    }
    if (additionalInstructions?.trim()) {
      userPrompt += `\n\nAdditional instructions: ${additionalInstructions.trim()}`;
    }

    // ── Call OpenRouter ─────────────────────────────────────────
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: strictGrounding ? 0.1 : 0.7,
        max_tokens: config.maxTokens,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenRouter API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed. Please try again in a moment." }),
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

    // ── Parse structured JSON response ─────────────────────────
    let parsed: {
      content: string;
      headline?: string;
      cta?: string;
      hashtags?: string[];
    };

    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If AI didn't return valid JSON, use raw content as fallback
      parsed = { content: rawContent };
    }

    // Ensure content is a string
    if (typeof parsed.content !== "string" || !parsed.content.trim()) {
      parsed = { content: rawContent };
    }

    return new Response(
      JSON.stringify({
        content: parsed.content,
        headline: parsed.headline || null,
        cta: parsed.cta || null,
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        contentType,
        sourceUsage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Generate content error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
