import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  contentType: string;
  topic: string;
  tone: string;
  audience: string;
  documentIds?: string[];
  promptTemplate?: string;
  additionalInstructions?: string;
}

const contentTypeConfig: Record<string, { system: string; maxTokens: number }> = {
  "LinkedIn Post": {
    system:
      "You are an expert B2B content writer for the media and advertising industry. Write a compelling LinkedIn post. Use a strong hook in the first line, structure with short paragraphs, include actionable insights, and end with a question to drive engagement. Use 3-5 relevant hashtags at the end.",
    maxTokens: 800,
  },
  "Twitter Thread": {
    system:
      "You are an expert B2B content writer for the media and advertising industry. Write a Twitter/X thread of 5-8 tweets. Each tweet must be under 280 characters. Start with a strong hook tweet, deliver value in each subsequent tweet, and end with a CTA tweet. Format each tweet separated by '---'.",
    maxTokens: 1200,
  },
  "Newsletter": {
    system:
      "You are an expert newsletter writer for the media and advertising industry. Write a newsletter section with a compelling subject line (prefixed with 'SUBJECT: '), a brief intro, 3 key insights with subheadings, and a closing thought. Keep it informative and engaging.",
    maxTokens: 1500,
  },
  "Sales Email": {
    system:
      "You are an expert sales copywriter for a media and advertising technology company. Write a concise, persuasive cold sales email. Include a compelling subject line (prefixed with 'SUBJECT: '), a personalized opening, a clear value proposition, social proof, and a soft CTA. Keep it under 200 words.",
    maxTokens: 600,
  },
  "Blog Post": {
    system:
      "You are an expert B2B blog writer for the media and advertising industry. Write a well-structured blog post with a compelling title, an engaging introduction, 3-4 sections with H2 subheadings, and a conclusion with a CTA. Use markdown formatting with # for the title and ## for subheadings.",
    maxTokens: 2000,
  },
  "Ad Copy": {
    system:
      "You are an expert advertising copywriter. Write 3 variations of ad copy for the given topic. Each variation should have a headline (30 chars max), a primary text (125 chars max), and a CTA. Format as: Variation 1, Variation 2, Variation 3 with clear separation.",
    maxTokens: 800,
  },
};

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
      documentIds = [],
      promptTemplate,
      additionalInstructions,
    } = body;

    if (!topic?.trim()) {
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Gather context from selected documents
    let documentContext = "";
    if (documentIds.length > 0) {
      const { data: docs } = await supabase
        .from("documents")
        .select("title, summary, tags, category")
        .in("id", documentIds);

      if (docs && docs.length > 0) {
        documentContext = docs
          .map((d: any) =>
            `- ${d.title}${d.summary ? `: ${d.summary}` : ""}${d.tags?.length ? ` (Tags: ${d.tags.join(", ")})` : ""}`,
          )
          .join("\n");
        documentContext = `\n\nReference material from the knowledge base:\n${documentContext}`;
      }
    }

    const config = contentTypeConfig[contentType] ?? contentTypeConfig["LinkedIn Post"];

    // Build the system prompt
    let systemPrompt = config.system;
    systemPrompt += `\n\nTone: ${tone}.`;
    systemPrompt += `\nTarget audience: ${audience}.`;
    if (promptTemplate) {
      systemPrompt += `\n\nFollow this prompt template:\n${promptTemplate}`;
    }

    // Build the user prompt
    let userPrompt = `Topic: ${topic}`;
    if (documentContext) {
      userPrompt += documentContext;
    }
    if (additionalInstructions?.trim()) {
      userPrompt += `\n\nAdditional instructions: ${additionalInstructions}`;
    }

    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({
          error: "AI API key is not configured. Please add an OpenRouter API key.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
      },
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenRouter API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResponse.json();
    const content: string | null = aiData.choices?.[0]?.message?.content ?? null;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "AI returned no content. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ content, contentType }),
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
