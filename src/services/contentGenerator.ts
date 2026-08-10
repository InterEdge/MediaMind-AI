import { supabase } from "../lib/supabase";
import type { ContentObjective, ContentType } from "../types/content";

export interface GenerationConfig {
  contentType: ContentType | null;
  objective: ContentObjective | null;
  topic: string | null;
  tone: string;
  audience: string;
  outputLength: string | null;
  additionalInstructions: string | null;
  documentIds: string[];
  requestedDocumentIds?: string[];
  promptId: string | null;
  origin: "content-generator" | "knowledge-assistant";
}

export interface GenerateContentParams {
  contentType: ContentType;
  topic?: string;
  tone: string;
  audience: string;
  outputLength: string;
  documentIds: string[];
  additionalInstructions?: string;
  objective: ContentObjective;
}

export interface GeneratedResult {
  content: string;
  headline: string | null;
  cta: string | null;
  hashtags: string[];
  contentType: ContentType;
  sourceUsage: {
    requestedIds: string[];
    foundIds: string[];
    usableIds: string[];
    usedIds: string[];
    unavailableIds: string[];
    unusableIds: string[];
  };
}

export interface SaveDraftParams {
  title: string;
  content: string;
  platform: string;
  wordCount: number;
  sourceDocumentIds: string[];
  generationPrompt: string;
  tone: string;
  targetAudience: string;
  headline?: string | null;
  cta?: string | null;
  hashtags?: string[];
  contentType?: ContentType | null;
  objective?: ContentObjective | null;
  promptId?: string | null;
  generationConfig: GenerationConfig;
}

export async function generateContent(params: GenerateContentParams): Promise<GeneratedResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Generation failed. Please try again.");
  }

  return {
    content: data.content || "",
    headline: data.headline || null,
    cta: data.cta || null,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    contentType: params.contentType,
    sourceUsage: {
      requestedIds: Array.isArray(data.sourceUsage?.requestedIds) ? data.sourceUsage.requestedIds : [],
      foundIds: Array.isArray(data.sourceUsage?.foundIds) ? data.sourceUsage.foundIds : [],
      usableIds: Array.isArray(data.sourceUsage?.usableIds) ? data.sourceUsage.usableIds : [],
      usedIds: Array.isArray(data.sourceUsage?.usedIds) ? data.sourceUsage.usedIds : [],
      unavailableIds: Array.isArray(data.sourceUsage?.unavailableIds) ? data.sourceUsage.unavailableIds : [],
      unusableIds: Array.isArray(data.sourceUsage?.unusableIds) ? data.sourceUsage.unusableIds : [],
    },
  };
}

export async function saveGeneratedDraft(params: SaveDraftParams): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("drafts")
    .insert({
      title: params.title,
      content: params.content,
      platform: params.platform,
      status: "Draft",
      word_count: params.wordCount,
      ai_generated: true,
      source_document_ids: params.sourceDocumentIds,
      generation_prompt: params.generationPrompt,
      tone: params.tone,
      target_audience: params.targetAudience,
      content_type: params.contentType ?? null,
      objective: params.objective ?? null,
      prompt_id: params.promptId ?? null,
      headline: params.headline ?? null,
      cta: params.cta ?? null,
      hashtags: params.hashtags ?? [],
      generation_config: params.generationConfig,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save draft: ${error.message}`);

  // Create activity record
  await supabase.from("activities").insert({
    type: "draft",
    description: `Saved AI-generated draft: "${params.title}"`,
    metadata: {
      platform: params.platform,
      word_count: params.wordCount,
      ai_generated: true,
      source_document_ids: params.sourceDocumentIds,
      tone: params.tone,
      target_audience: params.targetAudience,
      content_type: params.contentType ?? null,
      objective: params.objective ?? null,
      prompt_id: params.promptId ?? null,
    },
  });

  return { id: data.id };
}

export async function logGenerationActivity(
  contentType: string,
  topic: string,
  documentCount: number,
  wordCount: number,
): Promise<void> {
  await supabase.from("activities").insert({
    type: "generate",
    description: `AI generated ${contentType}${topic ? `: "${topic.substring(0, 60)}"` : ""}`,
    metadata: {
      content_type: contentType,
      word_count: wordCount,
      source_document_count: documentCount,
    },
  });
}

export function buildGenerationPrompt(params: GenerateContentParams): string {
  const parts = [
    `Content Type: ${params.contentType}`,
    `Tone: ${params.tone}`,
    `Target Audience: ${params.audience}`,
    `Output Length: ${params.outputLength}`,
    `Objective: ${params.objective}`,
  ];
  if (params.topic?.trim()) parts.push(`Topic: ${params.topic.trim()}`);
  if (params.documentIds.length > 0) parts.push(`Source Documents: ${params.documentIds.length} document(s)`);
  if (params.additionalInstructions?.trim()) parts.push(`Instructions: ${params.additionalInstructions.trim()}`);
  return parts.join("\n");
}

export function downloadAsMarkdown(title: string, content: string, headline?: string | null, cta?: string | null, hashtags?: string[]): void {
  const sections: string[] = [];
  sections.push(`# ${title}\n`);
  if (headline) sections.push(`## Headline\n${headline}\n`);
  sections.push(`## Content\n${content}\n`);
  if (cta) sections.push(`## Call to Action\n${cta}\n`);
  if (hashtags && hashtags.length > 0) sections.push(`## Hashtags\n${hashtags.map((h) => `#${h}`).join(" ")}\n`);

  const markdown = sections.join("\n");
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
