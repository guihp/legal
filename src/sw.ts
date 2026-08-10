/// <reference lib="webworker" />
/**
 * Service worker — Workbox precache + SPA navigateFallback + push stubs.
 * Push payload / subscription wiring lands in later phases; handlers are ready.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA fallback: navigations → index.html (skip API / files with extensions)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
  }),
);

type PushPayload = {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    route?: string;
    url?: string;
    meta?: { route?: string };
  };
};

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      let payload: PushPayload = {};
      try {
        if (event.data) {
          payload = event.data.json() as PushPayload;
        }
      } catch {
        try {
          payload = { body: event.data?.text() };
        } catch {
          // ignore malformed payloads
        }
      }

      const title = payload.title?.trim() || 'IAFÉ Imobi';
      const body = payload.body?.trim() || 'Nova notificação';
      const route =
        payload.data?.meta?.route ||
        payload.data?.route ||
        payload.data?.url ||
        '/';

      await self.registration.showNotification(title, {
        body,
        icon: payload.icon || '/pwa-192x192.png',
        badge: payload.badge || '/pwa-192x192.png',
        tag: payload.tag || 'iafe-imobi',
        data: { ...(payload.data ?? {}), route },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const data = (event.notification.data ?? {}) as {
    route?: string;
    url?: string;
    meta?: { route?: string };
  };
  const raw = data.meta?.route || data.route || data.url || '/';
  const targetUrl = (() => {
    try {
      return new URL(raw, self.location.origin).href;
    } catch {
      return self.location.origin + '/';
    }
  })();

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            await (client as WindowClient).navigate(targetUrl);
          }
          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});

// Activate updated SW promptly after skipWaiting from the client prompt flow
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
