import { supabase } from "../lib/supabase";
import {
  executeCreateNotification,
  executeMarkAllNotificationsRead,
  executeMarkNotificationRead,
  type NotificationInput,
  type NotificationRepository,
} from "../utils/notifications";
import { requireActiveWorkspaceId, withActiveWorkspace } from "../utils/workspaceOwnership";

const notificationRepository: NotificationRepository = {
  async insert(payload) {
    const { error } = await supabase.from("notifications").insert(withActiveWorkspace(payload));
    if (error) throw error;
  },
  async markRead(id) {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("workspace_id", requireActiveWorkspaceId());
    if (error) throw error;
  },
  async markAllRead() {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false).eq("workspace_id", requireActiveWorkspaceId());
    if (error) throw error;
  },
};

export const createNotification = (input: NotificationInput) =>
  executeCreateNotification(input, notificationRepository);

export const markNotificationRead = (id: string) =>
  executeMarkNotificationRead(id, notificationRepository);

export const markAllNotificationsRead = () =>
  executeMarkAllNotificationsRead(notificationRepository);
