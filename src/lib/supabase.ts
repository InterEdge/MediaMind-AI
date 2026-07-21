import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);


export interface Document {
  id?: string;
  name: string;
  category: string;
  type: string;
  file_size: string;
  status: string;
  summary?: string | null;
  tags?: string[];
  uploaded_at?: string;
  file_path?: string;
}


// Insert document into database
export async function insertDocument(document: Document) {

  const { data, error } = await supabase
    .from("documents")
    .insert([document])
    .select();

  if (error) {
    throw error;
  }

  return data;
}


// Fetch documents
export async function fetchDocuments() {

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("uploaded_at", {
      ascending: false,
    });


  if (error) {
    console.error(error);
    return [];
  }


  return data;
}