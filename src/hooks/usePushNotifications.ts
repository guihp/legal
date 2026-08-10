import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  mapPushSubscriptionFromDB,
  mapPushSubscriptionToDB,
  type PushPlatform,
  type PushSubscription,
  type PushSubscriptionRow,
} from '@/lib/push';
import { useUserProfile } from './useUserProfile';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function detectPushPlatform(): PushPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  ) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function getVapidPublicKey(): string | null {
  const key = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();
  return key || null;
}

/**
 * Resolve the active SW registration without hanging.
 * `navigator.serviceWorker.ready` never settles when no SW is registered
 * (common in DEV — versionChecker skips registerSW), which left
 * subscriptionsLoading stuck true forever.
 */
async function getServiceWorkerRegistration(
  timeoutMs = 2500,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;

    // Bound `ready` so missing SW cannot block UI forever.
    return await Promise.race([
      navigator.serviceWorker.ready.then((reg) => reg),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } catch {
    return null;
  }
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

/**
 * Lists / creates / removes Web Push subscriptions for the current user.
 */
export function usePushNotifications() {
  const { profile } = useUserProfile();
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [error, setError] = useState<string | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);

  const pushSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator;

  const load = useCallback(async () => {
    if (!profile?.id) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // DB list must not wait on SW — fetch subscriptions in parallel with
      // a short-timeout endpoint probe so empty/error always settle loading.
      const endpointProbe = (async () => {
        try {
          if (!pushSupported) {
            setPermission('unsupported');
            setCurrentEndpoint(null);
            return;
          }
          setPermission(Notification.permission);
          // Short timeout: list UI should not wait for SW registration.
          const reg = await getServiceWorkerRegistration(800);
          const browserSub = await reg?.pushManager.getSubscription();
          setCurrentEndpoint(browserSub?.endpoint ?? null);
        } catch {
          setCurrentEndpoint(null);
        }
      })();

      const { data, error: fetchError } = await (supabase as any)
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', profile.id)
        .order('last_seen_at', { ascending: false });

      if (fetchError) throw fetchError;
      const rows = (Array.isArray(data) ? data : []) as PushSubscriptionRow[];
      setSubscriptions(rows.map(mapPushSubscriptionFromDB));
      // Endpoint label can resolve after the list (never blocks loading settle).
      void endpointProbe;
    } catch (e: unknown) {
      setError(errorMessage(e, 'Erro ao carregar dispositivos'));
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, pushSupported]);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribeThisDevice = useCallback(async (): Promise<boolean> => {
    if (!profile?.id || !profile.company_id) {
      setError('Perfil incompleto');
      return false;
    }
    if (!pushSupported) {
      setError('Este navegador não suporta notificações push');
      return false;
    }

    const vapid = getVapidPublicKey();
    if (!vapid) {
      setError('Chave VAPID pública não configurada (VITE_VAPID_PUBLIC_KEY)');
      return false;
    }

    setSubscribing(true);
    setError(null);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        setError('Permissão de notificação negada');
        return false;
      }

      const reg = await getServiceWorkerRegistration();
      if (!reg) {
        setError('Service worker ainda não está ativo. Recarregue o app.');
        return false;
      }

      let browserSub = await reg.pushManager.getSubscription();
      if (!browserSub) {
        browserSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        });
      }

      const p256dhKey = browserSub.getKey('p256dh');
      const authKey = browserSub.getKey('auth');
      if (!p256dhKey || !authKey) {
        throw new Error('Chaves da inscrição push indisponíveis');
      }

      const model = {
        userId: profile.id,
        companyId: profile.company_id,
        endpoint: browserSub.endpoint,
        p256dh: arrayBufferToBase64Url(p256dhKey),
        auth: arrayBufferToBase64Url(authKey),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        platform: detectPushPlatform(),
        lastSeenAt: new Date().toISOString(),
      };

      const row = mapPushSubscriptionToDB(model);
      const { data, error: upsertError } = await (supabase as any)
        .from('push_subscriptions')
        .upsert(row, { onConflict: 'endpoint' })
        .select('*')
        .maybeSingle();

      if (upsertError) throw upsertError;

      setCurrentEndpoint(browserSub.endpoint);
      if (data) {
        const mapped = mapPushSubscriptionFromDB(data as PushSubscriptionRow);
        setSubscriptions((prev) => {
          const without = prev.filter((s) => s.endpoint !== mapped.endpoint);
          return [mapped, ...without];
        });
      } else {
        await load();
      }
      return true;
    } catch (e: unknown) {
      setError(errorMessage(e, 'Erro ao ativar notificações'));
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [profile?.id, profile?.company_id, pushSupported, load]);

  const removeSubscription = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      try {
        const target = subscriptions.find((s) => s.id === id);
        const { error: deleteError } = await (supabase as any)
          .from('push_subscriptions')
          .delete()
          .eq('id', id);
        if (deleteError) throw deleteError;

        if (target && currentEndpoint && target.endpoint === currentEndpoint) {
          const reg = await getServiceWorkerRegistration();
          const browserSub = await reg?.pushManager.getSubscription();
          if (browserSub) await browserSub.unsubscribe();
          setCurrentEndpoint(null);
        }

        setSubscriptions((prev) => prev.filter((s) => s.id !== id));
        return true;
      } catch (e: unknown) {
        setError(errorMessage(e, 'Erro ao remover dispositivo'));
        return false;
      }
    },
    [subscriptions, currentEndpoint],
  );

  const thisDeviceSubscribed = Boolean(
    currentEndpoint && subscriptions.some((s) => s.endpoint === currentEndpoint),
  );

  return {
    subscriptions,
    loading,
    subscribing,
    permission,
    pushSupported,
    thisDeviceSubscribed,
    currentEndpoint,
    error,
    reload: load,
    subscribeThisDevice,
    removeSubscription,
  };
}

/** Short label from User-Agent for device list. */
export function shortUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Dispositivo desconhecido';
  if (/iPhone/i.test(ua)) return 'iPhone (Safari/PWA)';
  if (/iPad/i.test(ua)) return 'iPad (Safari/PWA)';
  if (/Android/i.test(ua)) {
    const chrome = /Chrome\/[\d.]+/.test(ua);
    return chrome ? 'Android (Chrome)' : 'Android';
  }
  if (/Edg\//i.test(ua)) return 'Desktop (Edge)';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Desktop (Chrome)';
  if (/Firefox\//i.test(ua)) return 'Desktop (Firefox)';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Desktop (Safari)';
  return ua.length > 48 ? `${ua.slice(0, 45)}…` : ua;
}
