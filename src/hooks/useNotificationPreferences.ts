import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  mapUserNotificationPreferencesFromDB,
  mapUserNotificationPreferencesToDB,
  type UserNotificationPreferences,
  type UserNotificationPreferencesRow,
} from '@/lib/push';
import { useUserProfile } from './useUserProfile';

export type NotificationCategoryKey =
  | 'agenda'
  | 'pipeline'
  | 'chatHuman'
  | 'connections'
  | 'system';

type PrefPatch = Partial<
  Pick<
    UserNotificationPreferences,
    'pushEnabled' | NotificationCategoryKey
  >
>;

/**
 * Loads / updates personal push prefs via ensure_user_notification_preferences RPC.
 */
export function useNotificationPreferences() {
  const { profile } = useUserProfile();
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        'ensure_user_notification_preferences',
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error('Preferências não retornadas');
      setPreferences(
        mapUserNotificationPreferencesFromDB(data as UserNotificationPreferencesRow),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar preferências';
      setError(msg);
      setPreferences(null);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const updatePreferences = useCallback(
    async (patch: PrefPatch): Promise<boolean> => {
      if (!profile?.id || !profile.company_id) return false;

      setSaving(true);
      setError(null);
      try {
        const row = mapUserNotificationPreferencesToDB(patch);
        const { data, error: updateError } = await (supabase as any)
          .from('user_notification_preferences')
          .update(row)
          .eq('user_id', profile.id)
          .select('*')
          .maybeSingle();

        if (updateError) throw updateError;

        if (data) {
          setPreferences(
            mapUserNotificationPreferencesFromDB(data as UserNotificationPreferencesRow),
          );
        } else {
          setPreferences((prev) => (prev ? { ...prev, ...patch } : prev));
        }
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao salvar preferências';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [profile?.id, profile?.company_id],
  );

  return {
    preferences,
    loading,
    saving,
    error,
    reload: load,
    updatePreferences,
  };
}
