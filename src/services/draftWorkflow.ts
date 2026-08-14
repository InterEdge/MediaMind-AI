import { supabase, type Draft } from "../lib/supabase";
import {
  buildDraftTransitionPatch,
  executeDraftScheduling,
  type SchedulingRepository,
  type DraftWorkflowStatus,
} from "../utils/draftWorkflow";

export interface TransitionDraftResult {
  patch: ReturnType<typeof buildDraftTransitionPatch>;
  activityWarning: string | null;
}

export async function transitionDraftStatus(
  draft: Draft,
  nextStatus: DraftWorkflowStatus,
  reviewNote?: string | null,
): Promise<TransitionDraftResult> {
  const patch = buildDraftTransitionPatch(draft.status, nextStatus, reviewNote);
  const { error } = await supabase.from("drafts").update(patch).eq("id", draft.id);

  if (error) throw new Error(`Failed to update draft status: ${error.message}`);

  const { error: activityError } = await supabase.from("activities").insert({
    type: "draft",
    description: `Draft moved from ${draft.status} to ${nextStatus}: "${draft.title}"`,
    metadata: {
      draft_id: draft.id,
      previous_status: draft.status,
      next_status: nextStatus,
      review_note_supplied: Boolean(patch.review_note),
    },
  });

  return {
    patch,
    activityWarning: activityError
      ? `Status updated, but workflow activity could not be recorded: ${activityError.message}`
      : null,
  };
}

const schedulingRepository: SchedulingRepository = {
  async findLinkedPostId(draftId) {
    const { data, error } = await supabase
      .from("posts")
      .select("id")
      .eq("draft_id", draftId)
      .maybeSingle();
    if (error) throw new Error(`Failed to check existing scheduled post: ${error.message}`);
    return data?.id ?? null;
  },

  async createPost(snapshot) {
    const { data, error } = await supabase.from("posts").insert(snapshot).select("id").single();
    if (error) throw new Error(`Failed to schedule post: ${error.message}`);
    return data.id;
  },

  async updatePost(postId, snapshot) {
    const { error } = await supabase.from("posts").update(snapshot).eq("id", postId);
    if (error) throw new Error(`Failed to reschedule post: ${error.message}`);
  },

  async logSchedulingActivity({ draftId, postId, scheduledAt, rescheduled }) {
    const { error } = await supabase.from("activities").insert({
      type: "schedule",
      description: `${rescheduled ? "Rescheduled" : "Scheduled"} post for ${new Date(scheduledAt).toLocaleString()}`,
      metadata: {
        action: rescheduled ? "reschedule" : "schedule",
        draft_id: draftId,
        post_id: postId,
        scheduled_at: scheduledAt,
      },
    });
    if (error) throw new Error(error.message);
  },
};

export async function scheduleApprovedDraft(
  draft: Draft,
  date: string,
  time: string,
  onPostsChanged?: () => void,
) {
  return executeDraftScheduling(draft, date, time, schedulingRepository, new Date(), onPostsChanged);
}
