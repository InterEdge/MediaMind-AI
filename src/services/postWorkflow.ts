import { supabase, type Post } from "../lib/supabase";
import {
  executePostDelete,
  executePostEdit,
  executePostReschedule,
  executePostStatusChange,
  type PostEditInput,
  type PostWorkflowRepository,
} from "../utils/postWorkflow";

const postWorkflowRepository: PostWorkflowRepository = {
  async updatePost(postId, patch) {
    const { error } = await supabase.from("posts").update(patch).eq("id", postId);
    if (error) throw new Error(`Failed to update post: ${error.message}`);
  },
  async deletePost(postId) {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw new Error(`Failed to delete post: ${error.message}`);
  },
  async logActivity({ operation, postId, draftId, previousStatus, nextStatus, scheduledAt }) {
    const { error } = await supabase.from("activities").insert({
      type: "schedule",
      description: `Post ${operation}: ${postId}`,
      metadata: {
        operation,
        post_id: postId,
        draft_id: draftId,
        previous_status: previousStatus,
        next_status: nextStatus,
        scheduled_at: scheduledAt,
      },
    });
    if (error) throw new Error(error.message);
  },
};

export const updateCalendarPost = (post: Post, input: PostEditInput) =>
  executePostEdit(post, input, postWorkflowRepository);

export const rescheduleCalendarPost = (post: Post, date: string, time: string) =>
  executePostReschedule(post, date, time, postWorkflowRepository);

export const cancelCalendarPost = (post: Post) =>
  executePostStatusChange(post, "Cancelled", postWorkflowRepository);

export const markCalendarPostPublished = (post: Post) =>
  executePostStatusChange(post, "Published", postWorkflowRepository);

export const deleteCalendarPost = (post: Post) =>
  executePostDelete(post, postWorkflowRepository);
