import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  documentId: string;
}

// ─── Text extraction ────────────────────────────────────────────

function isBinaryContent(text: string): boolean {
  const nonPrintable = text
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 9 || (code > 13 && code < 32);
    }).length;
  return nonPrintable > text.length * 0.1;
}

async function extractTxt(blob: Blob): Promise<string> {
  const text = await blob.text();
  return isBinaryContent(text) ? "" : text;
}

async function extractPdf(blob: Blob): Promise<string> {
  // Lightweight PDF text extraction: parse text between BT/ET markers
  // and extract string literals from Tj and TJ operators.
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let raw = "";
  for (let i = 0; i < buffer.length; i++) {
    raw += String.fromCharCode(buffer[i]);
  }

  const texts: string[] = [];
  const regex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    texts.push(match[1].replace(/\\[nrtbf()\\]/g, " ").replace(/\\(\d{1,3})/g, " "));
  }

  // Also handle array form: [(str) num (str) num] TJ
  const arrayRegex = /\[([^\]]*)\]\s*TJ/g;
  while ((match = arrayRegex.exec(raw)) !== null) {
    const inner = match[1];
    const strParts = inner.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
    if (strParts) {
      for (const part of strParts) {
        texts.push(part.slice(1, -1).replace(/\\[nrtbf()\\]/g, " "));
      }
    }
  }

  const extracted = texts.join(" ").replace(/\s+/g, " ").trim();
  return extracted;
}

async function extractDocx(blob: Blob): Promise<string> {
  // DOCX is a ZIP archive. The main document content lives in
  // word/document.xml. We use a minimal inflate + XML text extraction.
  const buffer = new Uint8Array(await blob.arrayBuffer());

  // Find all "PK" signatures (ZIP local file headers)
  const entries: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x03 && buffer[i + 3] === 0x04) {
      // Local file header
      const nameLen = (buffer[i + 26] | (buffer[i + 27] << 8));
      const extraLen = (buffer[i + 28] | (buffer[i + 29] << 8));
      const compressedSize = (buffer[i + 18] | (buffer[i + 19] << 8) | (buffer[i + 20] << 16) | (buffer[i + 21] << 24));
      const compressionMethod = (buffer[i + 8] | (buffer[i + 9] << 8));
      const nameStart = i + 30;
      const name = new TextDecoder().decode(buffer.slice(nameStart, nameStart + nameLen));
      const dataStart = nameStart + extraLen;

      if (compressionMethod === 0 && compressedSize > 0) {
        // Stored (no compression)
        entries.push({ name, data: buffer.slice(dataStart, dataStart + compressedSize) });
      } else if (compressionMethod === 8) {
        // Deflated — use DecompressionStream (available in Deno)
        try {
          const compressedBlob = new Blob([buffer.slice(dataStart, dataStart + compressedSize)]);
          const decompressed = await compressedBlob
            .stream()
            .pipeThrough(new DecompressionStream("deflate-raw"))
            .getReader();
          let inflated = new Uint8Array(0);
          // deno-lint-ignore no-explicit-any
          const reader = decompressed as any;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const merged = new Uint8Array(inflated.length + value.length);
            merged.set(inflated);
            merged.set(value, inflated.length);
            inflated = merged;
          }
          entries.push({ name, data: inflated });
        } catch {
          // skip unparseable entries
        }
      }
    }
  }

  // Find word/document.xml
  const docXmlEntry = entries.find((e) => e.name === "word/document.xml");
  if (!docXmlEntry) return "";

  const xmlText = new TextDecoder().decode(docXmlEntry.data);
  // Extract text from <w:t> tags (Word text runs)
  const textParts: string[] = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = tRegex.exec(xmlText)) !== null) {
    textParts.push(m[1]);
  }
  // Insert paragraph breaks
  const paraRegex = /<\/w:p>/g;
  let lastIndex = 0;
  const result: string[] = [];
  const fullText = textParts.join("");
  // Simpler: just join with spaces and clean up
  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

async function extractText(blob: Blob, fileType: string): Promise<string> {
  try {
    const ext = fileType.toLowerCase();
    if (ext === "pdf") return await extractPdf(blob);
    if (ext === "docx" || ext === "doc") return await extractDocx(blob);
    if (ext === "txt" || ext === "csv") return await extractTxt(blob);
    // Fallback: try as text
    return await extractTxt(blob);
  } catch (err) {
    console.error(`Text extraction failed for ${fileType}:`, err);
    return "";
  }
}

// ─── AI processing ───────────────────────────────────────────────

interface AIResult {
  summary: string;
  keywords: string[];
}

function generateFallbackKeywords(title: string, category: string, extractedText: string): string[] {
  const words = extractedText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !["about", "which", "their", "would", "there", "could", "other", "these", "those", "where", "should", "between", "through"].includes(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const titleWords = title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
  const keywords = [...new Set([...titleWords, ...sorted, category.toLowerCase()])];
  return keywords.slice(0, 15);
}

async function generateAISummary(
  title: string,
  category: string,
  fileType: string,
  extractedText: string,
  openrouterApiKey: string,
): Promise<AIResult> {
  const maxContentLength = 12000;
  const truncatedText = extractedText.length > maxContentLength
    ? extractedText.substring(0, maxContentLength)
    : extractedText;

  const systemPrompt =
    "You are a media and advertising document analyst. Analyze the provided document content and return a JSON object with two fields: \"summary\" (a concise 3-4 sentence summary capturing the key points, insights, and main topics of the document) and \"keywords\" (an array of 10-20 relevant keywords and tags that capture the document's topics, themes, and industry terms). Return ONLY valid JSON with no markdown formatting, no code blocks, and no explanation.";

  const userPrompt = `Document title: ${title}\nCategory: ${category}\nFile type: ${fileType}\n\nDocument content:\n${truncatedText || "(No text could be extracted from this file. Generate a summary based on the title and category.)"}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenRouter API error:", errText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const content: string | null = data.choices?.[0]?.message?.content ?? null;
  if (!content) throw new Error("AI returned no content");

  // Parse JSON from the response (handle markdown code blocks)
  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(cleaned);

  return {
    summary: parsed.summary || `Document: ${title}`,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
  };
}

// ─── Main handler ───────────────────────────────────────────────

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

    // 2. Set ai_status to extracting
    await supabase
      .from("documents")
      .update({ ai_status: "extracting", status: "Processing" })
      .eq("id", documentId);

    // 3. Download file and extract text
    let extractedText = "";

    if (doc.file_path) {
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from("documents")
        .download(doc.file_path);

      if (!downloadError && fileData) {
        const fileExt = (doc.title?.split(".").pop() || "").toLowerCase();
        extractedText = await extractText(fileData, fileExt);
      }
    }

    if (!extractedText.trim()) {
      extractedText = doc.title || "Untitled document";
    }

    // Truncate for storage
    const maxStorageLength = 50000;
    if (extractedText.length > maxStorageLength) {
      extractedText = extractedText.substring(0, maxStorageLength);
    }

    // Save extracted text and move to AI processing stage
    await supabase
      .from("documents")
      .update({ extracted_text: extractedText, ai_status: "ai_processing" })
      .eq("id", documentId);

    // 4. Generate AI summary and keywords
    let summary: string;
    let keywords: string[];

    if (openrouterApiKey) {
      try {
        const result = await generateAISummary(
          doc.title,
          doc.category,
          doc.type,
          extractedText,
          openrouterApiKey,
        );
        summary = result.summary;
        keywords = result.keywords.length >= 10
          ? result.keywords.slice(0, 20)
          : [...result.keywords, ...generateFallbackKeywords(doc.title, doc.category, extractedText)].slice(0, 20);
      } catch (aiErr) {
        console.error("AI processing failed, using fallback:", aiErr);
        summary = `This document titled "${doc.title}" contains ${doc.type} content in the ${doc.category} category. AI summarization was temporarily unavailable.`;
        keywords = generateFallbackKeywords(doc.title, doc.category, extractedText);
      }
    } else {
      console.log("No OPENROUTER_API_KEY set — using fallback summary");
      summary = `This document titled "${doc.title}" is a ${doc.type} file in the ${doc.category} category. Add an OpenRouter API key to enable AI-powered summaries and keyword extraction.`;
      keywords = generateFallbackKeywords(doc.title, doc.category, extractedText);
    }

    // Ensure 10-20 keywords
    if (keywords.length < 10) {
      const fallback = generateFallbackKeywords(doc.title, doc.category, extractedText);
      keywords = [...new Set([...keywords, ...fallback])].slice(0, 20);
    }
    keywords = keywords.slice(0, 20);

    // 5. Update document with all results and mark as ready
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        summary,
        keywords,
        tags: keywords,
        ai_status: "ready",
        status: "Ready",
      })
      .eq("id", documentId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        summary,
        keywords,
        ai_status: "ready",
        status: "Ready",
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
