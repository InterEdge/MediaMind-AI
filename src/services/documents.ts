import { supabase } from "../lib/supabase";

const BUCKET = "documents";

export interface DocumentRow {
  id: string;
  title: string;
  type: string;
  category: string;
  file_size: string;
  status: string;
  summary: string | null;
  tags: string[];
  uploaded_at: string;
  file_path: string | null;
  extracted_text: string | null;
  keywords: string[];
  ai_status: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function inferType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";
  if (ext === "PDF") return "PDF";
  if (ext === "DOC" || ext === "DOCX") return "Word";
  if (ext === "PPT" || ext === "PPTX") return "Presentation";
  return ext;
}

export async function uploadDocument(file: File): Promise<DocumentRow> {
  const fileExt = file.name.split(".").pop();
  const storagePath = `${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file);

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("documents")
    .insert([
      {
        title: file.name,
        type: inferType(file.name),
        category: "Uncategorized",
        file_size: formatFileSize(file.size),
        status: "Processing",
        summary: null,
        tags: [],
        file_path: storagePath,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data as DocumentRow;
}

export async function getDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  return (data || []) as DocumentRow[];
}

// Lightweight list query — omits extracted_text intentionally to keep the
// payload small (extracted_text can be up to 50 KB per row).
// searchDocuments() issues its own SELECT when a text query is active,
// explicitly including extracted_text for full-text body scoring.
export async function getDocumentsLite(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id,title,type,category,file_size,status,summary,tags,uploaded_at,file_path,keywords,ai_status")
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  return (data || []) as DocumentRow[];
}

export async function deleteDocument(id: string): Promise<void> {
  const { data: doc } = await supabase.from("documents").select("file_path").eq("id", id).single();

  if (doc?.file_path) {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
  }

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDocumentStatus(
  id: string,
  status: string,
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function processDocument(documentId: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/process-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ documentId }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Processing failed (${response.status}): ${errBody}`);
  }
}

export async function markDocumentFailed(id: string): Promise<void> {
  // Best-effort: update ai_status to failed so the upload poller surfaces the
  // error rather than waiting for the safety timeout.
  // The Supabase JS client v2 never throws on query errors — it returns
  // { error } instead.  We check that value explicitly so a failed DB write
  // is visible in the console rather than silently discarded.
  try {
    const { error } = await supabase
      .from("documents")
      .update({ ai_status: "failed", status: "Ready" })
      .eq("id", id);
    if (error) {
      // Non-fatal: log for debugging. The upload poller's hard timeout will
      // still surface an error in the UI if this write fails.
      console.error("markDocumentFailed: failed to update document row:", error.message);
    }
  } catch (err) {
    // Catches genuine JS/network exceptions (e.g. fetch failure).
    console.error("markDocumentFailed: unexpected error:", err);
  }
}

export async function getDocumentById(id: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as DocumentRow | null;
}

export type AiStage = "pending" | "extracting" | "ai_processing" | "ready" | "failed";

export function getAiStage(doc: { ai_status: string | null; status: string }): AiStage {
  if (doc.ai_status === "ready") return "ready";
  if (doc.ai_status === "failed") return "failed";
  if (doc.ai_status === "extracting") return "extracting";
  if (doc.ai_status === "ai_processing") return "ai_processing";
  if (doc.status === "Ready") return "ready";
  return "pending";
}
