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

export async function deleteDocument(id: string): Promise<void> {
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
