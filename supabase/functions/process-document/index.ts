import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  documentId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { documentId }: ProcessRequest = await req.json();
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch the document record
    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Mark as Processing
    await supabase
      .from("documents")
      .update({ status: "Processing" })
      .eq("id", documentId);

    // 3. Download the file from storage
    let fileContent: string;
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !fileData) {
      // Fallback: use title-based summary if file can't be downloaded
      fileContent = doc.title;
    } else {
      // Extract text — try as text first, fallback to filename
      try {
        fileContent = await fileData.text();
        // If it looks like binary (non-printable chars), use the title instead
        const nonPrintable = fileContent.split("").filter((c) => {
          const code = c.charCodeAt(0);
          return code < 9 || (code > 13 && code < 32);
        }).length;
        if (nonPrintable > fileContent.length * 0.1) {
          fileContent = doc.title;
        }
      } catch {
        fileContent = doc.title;
      }
    }

    // Truncate to avoid token limits
    const maxContentLength = 8000;
    if (fileContent.length > maxContentLength) {
      fileContent = fileContent.substring(0, maxContentLength);
    }

    // 4. Generate summary and keywords
    let summary: string;
    let keywords: string[];

    if (openrouterApiKey) {
      // Use OpenRouter AI API
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
              {
                role: "system",
                content:
                  "You are a media and advertising document analyst. Analyze the provided document content and return a JSON object with two fields: \"summary\" (a concise 2-3 sentence summary of what the document contains) and \"keywords\" (an array of 5-8 relevant tags/keywords). Return ONLY valid JSON, no markdown or explanation.",
              },
              {
                role: "user",
                content: `Document title: ${doc.title}\n\nDocument content:\n${fileContent}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        },
      );

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("OpenRouter API error:", errText);
        // Fallback to basic summary
        summary = `This document titled "${doc.title}" contains ${doc.type} content in the ${doc.category} category. Full AI summarization is temporarily unavailable.`;
        keywords = generateBasicKeywords(doc.title, doc.category, doc.type);
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        try {
          // Parse the JSON from AI response
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          summary = parsed.summary || `Document: ${doc.title}`;
          keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
        } catch {
          // If JSON parsing fails, use the raw content as summary
          summary = content || `Document: ${doc.title}`;
          keywords = generateBasicKeywords(doc.title, doc.category, doc.type);
        }
      }
    } else {
      // No API key — generate a basic summary from metadata
      console.log("No OPENROUTER_API_KEY set — using fallback summary");
      summary = `This document titled "${doc.title}" is a ${doc.type} file in the ${doc.category} category. It was uploaded on ${new Date(doc.uploaded_at).toLocaleDateString()}. Add an OpenRouter API key to enable AI-powered summaries and keyword extraction.`;
      keywords = generateBasicKeywords(doc.title, doc.category, doc.type);
    }

    // 5. Update the document with summary, keywords, and Indexed status
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        summary,
        tags: keywords,
        status: "Indexed",
      })
      .eq("id", documentId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        summary,
        keywords,
        status: "Indexed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Process document error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function generateBasicKeywords(title: string, category: string, type: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["the", "and", "for", "with", "from"].includes(w))
    .slice(0, 5);
  const keywords = [...new Set([...words, category.toLowerCase(), type.toLowerCase()])];
  return keywords.slice(0, 8);
}
