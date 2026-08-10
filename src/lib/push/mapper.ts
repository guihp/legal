import type {
  PushSubscription,
  PushSubscriptionRow,
  UserNotificationPreferences,
  UserNotificationPreferencesRow,
} from './types';

export function mapPushSubscriptionFromDB(row: PushSubscriptionRow): PushSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    platform: row.platform,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function mapPushSubscriptionToDB(
  model: Partial<PushSubscription>
): Partial<PushSubscriptionRow> {
  const result: Partial<PushSubscriptionRow> = {};

  if (model.id !== undefined) result.id = model.id;
  if (model.userId !== undefined) result.user_id = model.userId;
  if (model.companyId !== undefined) result.company_id = model.companyId;
  if (model.endpoint !== undefined) result.endpoint = model.endpoint;
  if (model.p256dh !== undefined) result.p256dh = model.p256dh;
  if (model.auth !== undefined) result.auth = model.auth;
  if (model.userAgent !== undefined) result.user_agent = model.userAgent;
  if (model.platform !== undefined) result.platform = model.platform;
  if (model.createdAt !== undefined) result.created_at = model.createdAt;
  if (model.lastSeenAt !== undefined) result.last_seen_at = model.lastSeenAt;

  return result;
}

export function mapUserNotificationPreferencesFromDB(
  row: UserNotificationPreferencesRow
): UserNotificationPreferences {
  return {
    userId: row.user_id,
    companyId: row.company_id,
    pushEnabled: row.push_enabled,
    agenda: row.agenda,
    pipeline: row.pipeline,
    chatHuman: row.chat_human,
    connections: row.connections,
    system: row.system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUserNotificationPreferencesToDB(
  model: Partial<UserNotificationPreferences>
): Partial<UserNotificationPreferencesRow> {
  const result: Partial<UserNotificationPreferencesRow> = {};

  if (model.userId !== undefined) result.user_id = model.userId;
  if (model.companyId !== undefined) result.company_id = model.companyId;
  if (model.pushEnabled !== undefined) result.push_enabled = model.pushEnabled;
  if (model.agenda !== undefined) result.agenda = model.agenda;
  if (model.pipeline !== undefined) result.pipeline = model.pipeline;
  if (model.chatHuman !== undefined) result.chat_human = model.chatHuman;
  if (model.connections !== undefined) result.connections = model.connections;
  if (model.system !== undefined) result.system = model.system;
  if (model.createdAt !== undefined) result.created_at = model.createdAt;
  if (model.updatedAt !== undefined) result.updated_at = model.updatedAt;

  return result;
}
