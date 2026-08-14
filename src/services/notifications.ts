import { supabase } from "../lib/supabase";
import {
  executeCreateNotification,
  executeMarkAllNotificationsRead,
  executeMarkNotificationRead,
  type NotificationInput,
  type NotificationRepository,
} from "../utils/notifications";

const notificationRepository: NotificationRepository = {
  async insert(payload) {
    const { error } = await supabase.from("notifications").insert(payload);
    if (error) throw error;
  },
  async markRead(id) {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) throw error;
  },
  async markAllRead() {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
    if (error) throw error;
  },
};

export const createNotification = (input: NotificationInput) =>
  executeCreateNotification(input, notificationRepository);

export const markNotificationRead = (id: string) =>
  executeMarkNotificationRead(id, notificationRepository);

export const markAllNotificationsRead = () =>
  executeMarkAllNotificationsRead(notificationRepository);
