export const DRAFT_WORKFLOW_STATUSES = ["Draft", "In Review", "Approved"] as const;

export type DraftWorkflowStatus = (typeof DRAFT_WORKFLOW_STATUSES)[number];

export const LEGACY_DRAFT_STATUSES = ["Published"] as const;

const allowedTransitions: Record<DraftWorkflowStatus, readonly DraftWorkflowStatus[]> = {
  Draft: ["In Review"],
  "In Review": ["Draft", "Approved"],
  Approved: ["In Review"],
};

export interface DraftTransitionPatch {
  status: DraftWorkflowStatus;
  approved_at?: string | null;
  review_note?: string | null;
  updated_at: string;
}

export interface SchedulableDraftSnapshot {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  hashtags: string[] | null;
}

export interface ScheduledPostSnapshot {
  draft_id: string;
  title: string;
  content: string;
  platform: string;
  hashtags: string[];
  status: "Scheduled";
  scheduled_at: string;
  updated_at: string;
}

export interface SchedulingRepository {
  findLinkedPostId(draftId: string): Promise<string | null>;
  createPost(snapshot: ScheduledPostSnapshot): Promise<string>;
  updatePost(postId: string, snapshot: ScheduledPostSnapshot): Promise<void>;
  logSchedulingActivity(params: {
    draftId: string;
    postId: string;
    scheduledAt: string;
    rescheduled: boolean;
  }): Promise<void>;
}

export interface ScheduleDraftResult {
  postId: string;
  scheduledAt: string;
  rescheduled: boolean;
  activityWarning: string | null;
}

export function isDraftWorkflowStatus(status: string): status is DraftWorkflowStatus {
  return DRAFT_WORKFLOW_STATUSES.some((candidate) => candidate === status);
}

export function isDisplayableDraftStatus(status: string): boolean {
  return isDraftWorkflowStatus(status) || LEGACY_DRAFT_STATUSES.some((candidate) => candidate === status);
}

export function getAllowedDraftTransitions(status: string): readonly DraftWorkflowStatus[] {
  return isDraftWorkflowStatus(status) ? allowedTransitions[status] : [];
}

export function canTransitionDraftStatus(from: string, to: string): to is DraftWorkflowStatus {
  return isDraftWorkflowStatus(to) && getAllowedDraftTransitions(from).includes(to);
}

export function normalizeReviewNote(note: string | null | undefined): string | null | undefined {
  if (note === undefined) return undefined;
  const trimmed = note?.trim() ?? "";
  return trimmed || null;
}

export function buildDraftTransitionPatch(
  from: string,
  to: string,
  reviewNote?: string | null,
  now = new Date().toISOString(),
): DraftTransitionPatch {
  if (!canTransitionDraftStatus(from, to)) {
    throw new Error(`Invalid draft status transition: ${from} → ${to}`);
  }

  const patch: DraftTransitionPatch = {
    status: to,
    updated_at: now,
  };

  if (to === "Approved") patch.approved_at = now;
  if (from === "Approved" && to !== "Approved") patch.approved_at = null;

  const normalizedNote = normalizeReviewNote(reviewNote);
  if (normalizedNote !== undefined) patch.review_note = normalizedNote;

  return patch;
}

export function canScheduleDraft(status: string): boolean {
  return status === "Approved";
}

export function parseFutureLocalDateTime(
  date: string,
  time: string,
  now = new Date(),
): string {
  if (!date.trim() || !time.trim()) throw new Error("Schedule date and time are required.");

  const scheduled = new Date(`${date}T${time}`);
  if (Number.isNaN(scheduled.getTime())) throw new Error("Enter a valid schedule date and time.");
  if (scheduled.getTime() <= now.getTime()) throw new Error("Scheduled time must be in the future.");

  return scheduled.toISOString();
}

export function buildScheduledPostSnapshot(
  draft: SchedulableDraftSnapshot,
  scheduledAt: string,
): ScheduledPostSnapshot {
  if (!canScheduleDraft(draft.status)) throw new Error("Only Approved drafts can be scheduled.");

  return {
    draft_id: draft.id,
    title: draft.title,
    content: draft.content,
    platform: draft.platform,
    hashtags: [...(draft.hashtags ?? [])],
    status: "Scheduled",
    scheduled_at: scheduledAt,
    updated_at: new Date().toISOString(),
  };
}

export async function executeDraftScheduling(
  draft: SchedulableDraftSnapshot,
  date: string,
  time: string,
  repository: SchedulingRepository,
  now = new Date(),
  onPostsChanged?: () => void,
): Promise<ScheduleDraftResult> {
  if (!canScheduleDraft(draft.status)) throw new Error("Only Approved drafts can be scheduled.");

  const scheduledAt = parseFutureLocalDateTime(date, time, now);
  const snapshot = buildScheduledPostSnapshot(draft, scheduledAt);
  const existingPostId = await repository.findLinkedPostId(draft.id);
  const rescheduled = Boolean(existingPostId);
  const postId = existingPostId ?? await repository.createPost(snapshot);

  if (existingPostId) await repository.updatePost(existingPostId, snapshot);

  let activityWarning: string | null = null;
  try {
    await repository.logSchedulingActivity({ draftId: draft.id, postId, scheduledAt, rescheduled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown activity logging error";
    activityWarning = `Post ${rescheduled ? "rescheduled" : "scheduled"}, but activity could not be recorded: ${message}`;
  }

  onPostsChanged?.();
  return { postId, scheduledAt, rescheduled, activityWarning };
}
