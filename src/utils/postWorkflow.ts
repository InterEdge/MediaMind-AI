import { parseFutureLocalDateTime } from "./draftWorkflow.ts";

export const ACTIVE_POST_STATUSES = ["Scheduled", "Published", "Cancelled"] as const;
export type ActivePostStatus = (typeof ACTIVE_POST_STATUSES)[number];

export interface PostWorkflowRecord {
  id: string;
  draft_id: string | null;
  title: string;
  content: string;
  platform: string;
  hashtags: string[];
  status: string;
  scheduled_at: string | null;
}

export interface PostEditInput {
  title: string;
  content: string;
  platform: string;
  hashtags: string[];
}

export interface PostWorkflowRepository {
  updatePost(postId: string, patch: Record<string, unknown>): Promise<void>;
  deletePost(postId: string): Promise<void>;
  logActivity(params: {
    operation: string;
    postId: string;
    draftId: string | null;
    previousStatus: string;
    nextStatus?: string;
    scheduledAt?: string | null;
  }): Promise<void>;
}

export interface PostMutationResult {
  patch?: Record<string, unknown>;
  deleted?: boolean;
  activityWarning: string | null;
}

export function isCalendarVisiblePost(post: Pick<PostWorkflowRecord, "status" | "scheduled_at">): boolean {
  return post.status === "Scheduled" && Boolean(post.scheduled_at) && !Number.isNaN(new Date(post.scheduled_at!).getTime());
}

export function isUpcomingPost(
  post: Pick<PostWorkflowRecord, "status" | "scheduled_at">,
  now = new Date(),
): boolean {
  return isCalendarVisiblePost(post) && new Date(post.scheduled_at!).getTime() >= now.getTime();
}

export function buildPostEditPatch(input: PostEditInput, now = new Date().toISOString()) {
  const title = input.title.trim();
  const content = input.content.trim();
  const platform = input.platform.trim();
  if (!title) throw new Error("Post title is required.");
  if (!content) throw new Error("Post content is required.");
  if (!platform) throw new Error("Post platform is required.");

  return {
    title,
    content,
    platform,
    hashtags: input.hashtags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
    updated_at: now,
  };
}

export function buildPostReschedulePatch(
  currentStatus: string,
  date: string,
  time: string,
  now = new Date(),
) {
  if (currentStatus !== "Scheduled" && currentStatus !== "Cancelled") {
    throw new Error("Only Scheduled or Cancelled posts can be scheduled again.");
  }
  return {
    status: "Scheduled" as const,
    scheduled_at: parseFutureLocalDateTime(date, time, now),
    updated_at: now.toISOString(),
  };
}

export function buildPostStatusPatch(
  currentStatus: string,
  nextStatus: "Cancelled" | "Published",
  now = new Date().toISOString(),
) {
  if (currentStatus !== "Scheduled") {
    throw new Error(`Only Scheduled posts can be marked ${nextStatus}.`);
  }
  return { status: nextStatus, updated_at: now };
}

async function logWithoutRollback(
  post: PostWorkflowRecord,
  operation: string,
  repository: PostWorkflowRepository,
  nextStatus?: string,
  scheduledAt: string | null = post.scheduled_at,
): Promise<string | null> {
  try {
    await repository.logActivity({
      operation,
      postId: post.id,
      draftId: post.draft_id,
      previousStatus: post.status,
      nextStatus,
      scheduledAt,
    });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown activity logging error";
    return `Post updated, but activity could not be recorded: ${message}`;
  }
}

export async function executePostEdit(
  post: PostWorkflowRecord,
  input: PostEditInput,
  repository: PostWorkflowRepository,
  now = new Date(),
): Promise<PostMutationResult> {
  const patch = buildPostEditPatch(input, now.toISOString());
  await repository.updatePost(post.id, patch);
  return { patch, activityWarning: await logWithoutRollback(post, "edit", repository) };
}

export async function executePostReschedule(
  post: PostWorkflowRecord,
  date: string,
  time: string,
  repository: PostWorkflowRepository,
  now = new Date(),
): Promise<PostMutationResult> {
  const patch = buildPostReschedulePatch(post.status, date, time, now);
  await repository.updatePost(post.id, patch);
  const operation = post.status === "Cancelled" ? "restore" : "reschedule";
  return {
    patch,
    activityWarning: await logWithoutRollback(post, operation, repository, patch.status, patch.scheduled_at),
  };
}

export async function executePostStatusChange(
  post: PostWorkflowRecord,
  nextStatus: "Cancelled" | "Published",
  repository: PostWorkflowRepository,
  now = new Date(),
): Promise<PostMutationResult> {
  const patch = buildPostStatusPatch(post.status, nextStatus, now.toISOString());
  await repository.updatePost(post.id, patch);
  return {
    patch,
    activityWarning: await logWithoutRollback(post, nextStatus === "Cancelled" ? "cancel" : "publish", repository, nextStatus),
  };
}

export async function executePostDelete(
  post: PostWorkflowRecord,
  repository: PostWorkflowRepository,
): Promise<PostMutationResult> {
  await repository.deletePost(post.id);
  const activityWarning = await logWithoutRollback(post, "delete", repository);
  return { deleted: true, activityWarning };
}
