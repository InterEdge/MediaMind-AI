import { createClient } from "@supabase/supabase-js";
import type { ContentObjective, ContentType, OutputLength } from "../types/content";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  related_record_id?: string | null;
  related_record_type?: string | null;
  metadata?: Record<string, unknown> | null;
  event_key?: string | null;
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
  content_type: ContentType | null;
  default_audience: string | null;
  default_tone: string | null;
  default_objective: ContentObjective | null;
  default_output_length: OutputLength | null;
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
  source_document_ids: string[] | null;
  generation_prompt: string | null;
  tone: string | null;
  target_audience: string | null;
  content_type: ContentType | null;
  objective: ContentObjective | null;
  prompt_id: string | null;
  headline: string | null;
  cta: string | null;
  hashtags: string[] | null;
  generation_config: Record<string, unknown> | null;
  approved_at: string | null;
  review_note: string | null;
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
  draft_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}
