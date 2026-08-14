import { supabase, type Post } from "../lib/supabase";
import { createNotification } from "./notifications";
import { combineSecondaryWarnings, getPostNotificationEvent } from "../utils/notifications";
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

export async function cancelCalendarPost(post: Post) {
  const result = await executePostStatusChange(post, "Cancelled", postWorkflowRepository);
  const eventAt = String(result.patch?.updated_at ?? new Date().toISOString());
  const event = getPostNotificationEvent({
    operation: "cancel",
    postId: post.id,
    draftId: post.draft_id,
    title: post.title,
    previousStatus: post.status,
    nextStatus: "Cancelled",
    scheduledAt: post.scheduled_at,
    eventAt,
  });
  const notification = event ? await createNotification(event) : { warning: null };
  return { ...result, activityWarning: combineSecondaryWarnings(result.activityWarning, notification.warning) };
}

export async function markCalendarPostPublished(post: Post) {
  const result = await executePostStatusChange(post, "Published", postWorkflowRepository);
  const eventAt = String(result.patch?.updated_at ?? new Date().toISOString());
  const event = getPostNotificationEvent({
    operation: "publish",
    postId: post.id,
    draftId: post.draft_id,
    title: post.title,
    previousStatus: post.status,
    nextStatus: "Published",
    scheduledAt: post.scheduled_at,
    eventAt,
  });
  const notification = event ? await createNotification(event) : { warning: null };
  return { ...result, activityWarning: combineSecondaryWarnings(result.activityWarning, notification.warning) };
}

export const deleteCalendarPost = (post: Post) =>
  executePostDelete(post, postWorkflowRepository);
