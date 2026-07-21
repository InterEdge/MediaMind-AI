import { supabase } from "../lib/supabase";

const BUCKET = "documents";

export async function uploadDocument(file: File) {
  const fileName = `${Date.now()}-${file.name}`;

  // Upload file to Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file);

  if (uploadError) {
    throw uploadError;
  }

  // Save document details
  const { data, error } = await supabase
    .from("documents")
    .insert([
      {
        name: file.name,
        category: "General",
        type: file.name.split(".").pop()?.toUpperCase() || "FILE",
        file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        status: "Processing",
        summary: null,
        tags: [],
        uploaded_at: new Date().toISOString(),
        file_path: fileName,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}


export async function getDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}