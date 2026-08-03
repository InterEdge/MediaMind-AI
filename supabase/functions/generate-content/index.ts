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
  "Twitter/X Post": {
    system:
      "You are an expert social media writer. Write a single Twitter/X post (max 280 characters) that is punchy, engaging, and shareable. Make every word count.",
    maxTokens: 400,
    supportsHeadline: false,
    supportsCTA: true,
    supportsHashtags: true,
  },
  "Twitter/X Thread": {
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

    // Must have either a topic or documents or additional instructions
    const hasTopic = topic?.trim();
    const hasDocs = documentIds.length > 0;
    const hasInstructions = additionalInstructions?.trim();

    if (!hasTopic && !hasDocs && !hasInstructions) {
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
    if (documentIds.length > 0) {
      const { data: docs } = await supabase
        .from("documents")
        .select("title, summary, extracted_text, keywords, category, type")
        .in("id", documentIds);

      if (docs && docs.length > 0) {
        const contextParts = docs.map((d: {
          title: string;
          summary: string | null;
          extracted_text: string | null;
          keywords: string[] | null;
          category: string;
          type: string;
        }) => {
          const parts: string[] = [`Document: ${d.title}`];
          if (d.summary) parts.push(`Summary: ${d.summary}`);
          if (d.keywords && d.keywords.length > 0) parts.push(`Keywords: ${d.keywords.join(", ")}`);
          if (d.extracted_text) {
            const maxTextLen = 3000;
            const text = d.extracted_text.length > maxTextLen
              ? d.extracted_text.substring(0, maxTextLen) + "..."
              : d.extracted_text;
            parts.push(`Content: ${text}`);
          }
          parts.push(`Category: ${d.category}`);
          return parts.join("\n");
        });
        documentContext = `\n\nReference material from the knowledge base:\n${contextParts.join("\n\n")}`;
      }
    }

    // ── Build prompts ──────────────────────────────────────────
    const config = contentTypeConfig[contentType];
    const lengthGuide = LENGTH_GUIDE[outputLength];

    let systemPrompt = config.system;
    systemPrompt += `\n\nTone: ${tone}.`;
    systemPrompt += `\nTarget audience: ${audience}.`;
    systemPrompt += `\nOutput length: ${outputLength} (${lengthGuide.words}). ${lengthGuide.note}`;

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
        temperature: 0.7,
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
