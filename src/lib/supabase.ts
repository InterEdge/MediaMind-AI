import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface Prompt {
  id: string;
  name: string;
  category: string;
  template: string;
  description: string | null;
  uses: number | null;
  is_favorite: boolean | null;
  created_at: string;
}

export interface Draft {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  word_count: number | null;
  ai_generated: boolean | null;
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

export interface Activity {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}
