export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  relatedRecordId?: string | null;
  relatedRecordType?: string | null;
  metadata?: Record<string, unknown> | null;
  eventKey?: string | null;
}

export interface NotificationInsert {
  type: string;
  title: string;
  message: string;
  related_record_id: string | null;
  related_record_type: string | null;
  metadata: Record<string, unknown>;
  event_key: string | null;
}

export interface NotificationRepository {
  insert(payload: NotificationInsert): Promise<void>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export interface NotificationOperationResult {
  duplicate?: boolean;
  warning: string | null;
}

export interface NotificationEvent extends NotificationInput {
  eventKey: string;
}

export function normalizeNotificationPayload(input: NotificationInput): NotificationInsert {
  const type = input.type.trim() || "info";
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title) throw new Error("Notification title is required.");
  if (!message) throw new Error("Notification message is required.");

  return {
    type,
    title,
    message,
    related_record_id: input.relatedRecordId ?? null,
    related_record_type: input.relatedRecordType?.trim() || null,
    metadata: input.metadata ?? {},
    event_key: input.eventKey?.trim() || null,
  };
}

export async function executeCreateNotification(
  input: NotificationInput,
  repository: NotificationRepository,
): Promise<NotificationOperationResult> {
  const payload = normalizeNotificationPayload(input);
  try {
    await repository.insert(payload);
    return { duplicate: false, warning: null };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : null;
    if (code === "23505" && payload.event_key) return { duplicate: true, warning: null };
    const message = error instanceof Error ? error.message : "Unknown notification error";
    return { duplicate: false, warning: `Notification could not be created: ${message}` };
  }
}

export async function executeMarkNotificationRead(
  id: string,
  repository: NotificationRepository,
): Promise<NotificationOperationResult> {
  try {
    await repository.markRead(id);
    return { warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown notification error";
    return { warning: `Notification could not be marked read: ${message}` };
  }
}

export async function executeMarkAllNotificationsRead(
  repository: NotificationRepository,
): Promise<NotificationOperationResult> {
  try {
    await repository.markAllRead();
    return { warning: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown notification error";
    return { warning: `Notifications could not be marked read: ${message}` };
  }
}

export function getDraftNotificationEvent(params: {
  draftId: string;
  title: string;
  previousStatus: string;
  nextStatus: string;
  transitionAt: string;
}): NotificationEvent | null {
  const metadata = {
    draft_id: params.draftId,
    previous_status: params.previousStatus,
    next_status: params.nextStatus,
  };
  if (params.previousStatus === "Draft" && params.nextStatus === "In Review") {
    return {
      type: "info",
      title: "Draft submitted for review",
      message: `“${params.title}” is ready for review.`,
      relatedRecordId: params.draftId,
      relatedRecordType: "draft",
      metadata,
      eventKey: `draft:${params.draftId}:in-review:${params.transitionAt}`,
    };
  }
  if (params.previousStatus === "In Review" && params.nextStatus === "Approved") {
    return {
      type: "success",
      title: "Draft approved",
      message: `“${params.title}” has been approved.`,
      relatedRecordId: params.draftId,
      relatedRecordType: "draft",
      metadata,
      eventKey: `draft:${params.draftId}:approved:${params.transitionAt}`,
    };
  }
  return null;
}

export function getPostNotificationEvent(params: {
  operation: "schedule" | "reschedule" | "restore" | "cancel" | "publish" | "edit" | "delete";
  postId: string;
  draftId: string | null;
  title: string;
  previousStatus: string;
  nextStatus?: string;
  scheduledAt?: string | null;
  eventAt: string;
}): NotificationEvent | null {
  const metadata = {
    post_id: params.postId,
    draft_id: params.draftId,
    previous_status: params.previousStatus,
    next_status: params.nextStatus,
    scheduled_at: params.scheduledAt,
  };
  if (params.operation === "schedule" || params.operation === "restore") {
    return {
      type: "info",
      title: "Post scheduled",
      message: `“${params.title}” has been scheduled.`,
      relatedRecordId: params.postId,
      relatedRecordType: "post",
      metadata,
      eventKey: `post:${params.postId}:scheduled:${params.eventAt}`,
    };
  }
  if (params.operation === "cancel") {
    return {
      type: "warning",
      title: "Post cancelled",
      message: `“${params.title}” has been cancelled.`,
      relatedRecordId: params.postId,
      relatedRecordType: "post",
      metadata,
      eventKey: `post:${params.postId}:cancelled:${params.eventAt}`,
    };
  }
  if (params.operation === "publish") {
    return {
      type: "success",
      title: "Post published",
      message: `“${params.title}” has been marked Published.`,
      relatedRecordId: params.postId,
      relatedRecordType: "post",
      metadata,
      eventKey: `post:${params.postId}:published:${params.eventAt}`,
    };
  }
  return null;
}

export function combineSecondaryWarnings(...warnings: Array<string | null | undefined>): string | null {
  const present = warnings.filter((warning): warning is string => Boolean(warning));
  return present.length > 0 ? present.join(" ") : null;
}

export function resolveUnreadCount(databaseCount: number | null): number {
  return Math.max(0, databaseCount ?? 0);
}

export function getNotificationMetadata(notification: { metadata?: Record<string, unknown> | null }): Record<string, unknown> {
  return notification.metadata ?? {};
}
