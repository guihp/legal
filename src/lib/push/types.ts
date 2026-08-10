/** Platform for Web Push subscription rows (DB CHECK). */
export type PushPlatform = 'ios' | 'android' | 'desktop';

/** Snake_case row from `push_subscriptions`. */
export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  company_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  platform: PushPlatform;
  created_at: string;
  last_seen_at: string;
};

/** CamelCase app model for `push_subscriptions`. */
export type PushSubscription = {
  id: string;
  userId: string;
  companyId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  platform: PushPlatform;
  createdAt: string;
  lastSeenAt: string;
};

/** Snake_case row from `user_notification_preferences`. */
export type UserNotificationPreferencesRow = {
  user_id: string;
  company_id: string;
  push_enabled: boolean;
  agenda: boolean;
  pipeline: boolean;
  chat_human: boolean;
  connections: boolean;
  system: boolean;
  created_at: string;
  updated_at: string;
};

/** CamelCase app model for `user_notification_preferences`. */
export type UserNotificationPreferences = {
  userId: string;
  companyId: string;
  pushEnabled: boolean;
  agenda: boolean;
  pipeline: boolean;
  chatHuman: boolean;
  connections: boolean;
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Extended `user_notifications.type` values (incl. Fase 2). */
export type UserNotificationType =
  | 'lead_stage_changed'
  | 'appointment'
  | 'connection_request'
  | 'connection_approved'
  | 'connection_rejected'
  | 'general'
  | 'chat_human_reply'
  | 'chat_human_requested'
  | 'agenda_reminder';
