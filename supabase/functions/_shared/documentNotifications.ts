export type DocumentProcessingNotificationStatus = "ready" | "failed";

export interface DocumentNotificationRecord {
  id: string;
  title: string;
}

export interface DocumentProcessingNotificationInsert {
  type: "success" | "warning";
  title: string;
  message: string;
  related_record_id: string;
  related_record_type: "document";
  metadata: {
    document_id: string;
    file_name: string;
    processing_status: DocumentProcessingNotificationStatus;
  };
  event_key: string;
}

export interface DocumentProcessingRepository {
  insertNotification(payload: DocumentProcessingNotificationInsert): Promise<void>;
  markDocumentFailed(documentId: string): Promise<void>;
}

export function buildDocumentProcessingNotification(
  document: DocumentNotificationRecord,
  status: string,
): DocumentProcessingNotificationInsert | null {
  if (status !== "ready" && status !== "failed") return null;
  const ready = status === "ready";
  return {
    type: ready ? "success" : "warning",
    title: ready ? "Document ready" : "Document processing failed",
    message: ready
      ? `“${document.title}” is ready in your Knowledge Base.`
      : `“${document.title}” could not be processed.`,
    related_record_id: document.id,
    related_record_type: "document",
    metadata: {
      document_id: document.id,
      file_name: document.title,
      processing_status: status,
    },
    event_key: `document:${document.id}:processing:${status}`,
  };
}

export async function emitDocumentProcessingNotification(
  document: DocumentNotificationRecord,
  status: string,
  repository: DocumentProcessingRepository,
): Promise<string | null> {
  const payload = buildDocumentProcessingNotification(document, status);
  if (!payload) return null;
  try {
    await repository.insertNotification(payload);
    return null;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : null;
    if (code === "23505") return null;
    const message = error instanceof Error ? error.message : "Unknown notification error";
    return `Document notification could not be created: ${message}`;
  }
}

export async function persistTerminalDocumentFailure(
  document: DocumentNotificationRecord,
  repository: DocumentProcessingRepository,
): Promise<string | null> {
  await repository.markDocumentFailed(document.id);
  return emitDocumentProcessingNotification(document, "failed", repository);
}
