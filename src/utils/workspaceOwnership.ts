export interface WorkspaceOwnedRecord {
  workspace_id?: string | null;
}

let activeWorkspaceId: string | null = null;

export function setActiveWorkspaceId(workspaceId: string | null | undefined): void {
  activeWorkspaceId = workspaceId?.trim() || null;
}

export function requireActiveWorkspaceId(): string {
  if (!activeWorkspaceId) {
    throw new Error("An active workspace is required for this operation.");
  }
  return activeWorkspaceId;
}

export function withActiveWorkspace<T extends object>(payload: T): T & { workspace_id: string } {
  return { ...payload, workspace_id: requireActiveWorkspaceId() };
}

export function assertWorkspaceLink(record: WorkspaceOwnedRecord, label: string): string {
  const workspaceId = requireActiveWorkspaceId();
  if (record.workspace_id !== workspaceId) {
    throw new Error(`${label} belongs to a different workspace.`);
  }
  return workspaceId;
}

export function buildWorkspaceStoragePath(fileName: string, objectId = crypto.randomUUID()): string {
  const workspaceId = requireActiveWorkspaceId();
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${workspaceId}/${objectId}.${extension}`;
}
