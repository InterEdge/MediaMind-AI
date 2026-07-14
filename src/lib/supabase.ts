import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Document {
  id: string;
  title: string;
  type: string;
  category: string;
  file_size: string;
  status: string;
  summary: string | null;
  tags: string[];
  uploaded_at: string;
}

export interface Draft {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  word_count: number;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  scheduled_at: string | null;
  engagement_score: number;
  hashtags: string[];
  created_at: string;
}

export interface Prompt {
  id: string;
  name: string;
  category: string;
  template: string;
  description: string | null;
  uses: number;
  is_favorite: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
