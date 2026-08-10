/**
 * push-dispatch — Web Push fan-out for user_notifications (service_role).
 *
 * Payload: { notification_id } | { notification_ids: uuid[] } | { notifications: [...] }
 *
 * Auth: Bearer service_role, or x-push-secret / Bearer matching PUSH_DISPATCH_SECRET.
 * If PUSH_DISPATCH_SECRET is unset, any gateway JWT is accepted (same pattern as follow-up-dispatch).
 *
 * Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…),
 *          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional PUSH_DISPATCH_SECRET.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-push-secret, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PrefCategory = "pipeline" | "agenda" | "chat_human" | "connections" | "system";

type NotificationRow = {
  id: string;
  user_id: string;
  company_id: string;
  type: string;
  title: string;
  body: string;
  meta: Record<string, unknown> | null;
};

type PrefsRow = {
  push_enabled: boolean;
  agenda: boolean;
  pipeline: boolean;
  chat_human: boolean;
  connections: boolean;
  system: boolean;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function env(name: string, fallback = ""): string {
  return Deno.env.get(name) ?? fallback;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const pushSecret = env("PUSH_DISPATCH_SECRET") || env("VISIT_REMINDER_CRON_SECRET");
  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");

  if (serviceRole && bearer === serviceRole) return true;

  if (pushSecret) {
    const header =
      req.headers.get("x-push-secret") ||
      req.headers.get("x-cron-secret") ||
      "";
    return header === pushSecret || bearer === pushSecret;
  }

  // No dedicated secret: gateway JWT is enough (pg_net uses vault anon key).
  return true;
}

/** Map user_notifications.type → preference category column. */
function categoryForType(type: string): PrefCategory {
  switch (type) {
    case "lead_stage_changed":
      return "pipeline";
    case "appointment":
    case "agenda_reminder":
      return "agenda";
    case "chat_human_reply":
    case "chat_human_requested":
      return "chat_human";
    case "connection_request":
    case "connection_approved":
    case "connection_rejected":
      return "connections";
    case "general":
    default:
      return "system";
  }
}

function prefsAllow(prefs: PrefsRow | null, category: PrefCategory): boolean {
  // Missing row → defaults (all on), same as ensure_user_notification_preferences.
  if (!prefs) return true;
  if (!prefs.push_enabled) return false;
  return prefs[category] === true;
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Import classic web-push VAPID keys (base64url public uncompressed + private d)
 * into a CryptoKeyPair for @negrel/webpush.
 */
async function importClassicVapidKeys(
  publicKeyB64: string,
  privateKeyB64: string,
): Promise<CryptoKeyPair> {
  const pub = base64UrlToBytes(publicKeyB64);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY must be uncompressed P-256 (65 bytes, 0x04…)");
  }
  const x = bytesToBase64Url(pub.subarray(1, 33));
  const y = bytesToBase64Url(pub.subarray(33, 65));
  const d = privateKeyB64.replace(/=+$/, "");

  return webpush.importVapidKeys(
    {
      publicKey: { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] },
      privateKey: {
        kty: "EC",
        crv: "P-256",
        x,
        y,
        d,
        ext: true,
        key_ops: ["sign"],
      },
    },
    { extractable: false },
  );
}

async function createAppServer(): Promise<webpush.ApplicationServer> {
  const publicKey = env("VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  let subject = env("VAPID_SUBJECT", "mailto:ops@iafeimobi.com.br");
  if (subject && !subject.startsWith("mailto:") && !subject.startsWith("https:")) {
    subject = `mailto:${subject}`;
  }

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
  }

  // Prefer classic base64url pair; fall back to JSON JWK blob in VAPID_PRIVATE_KEY.
  let vapidKeys: CryptoKeyPair;
  if (privateKey.trim().startsWith("{")) {
    const parsed = JSON.parse(privateKey) as webpush.ExportedVapidKeys | {
      publicKey?: unknown;
      privateKey?: unknown;
      d?: string;
    };
    if ("publicKey" in parsed && "privateKey" in parsed && parsed.publicKey) {
      vapidKeys = await webpush.importVapidKeys(
        parsed as webpush.ExportedVapidKeys,
        { extractable: false },
      );
    } else {
      // Single JWK private key — pair with public from VAPID_PUBLIC_KEY
      const pub = base64UrlToBytes(publicKey);
      const x = bytesToBase64Url(pub.subarray(1, 33));
      const y = bytesToBase64Url(pub.subarray(33, 65));
      const jwk = parsed as JsonWebKey;
      vapidKeys = await webpush.importVapidKeys(
        {
          publicKey: { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] },
          privateKey: { ...jwk, x: jwk.x ?? x, y: jwk.y ?? y },
        },
        { extractable: false },
      );
    }
  } else {
    vapidKeys = await importClassicVapidKeys(publicKey, privateKey);
  }

  return webpush.ApplicationServer.new({
    contactInformation: subject,
    vapidKeys,
  });
}

function collectIds(body: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  if (typeof body.notification_id === "string" && body.notification_id) {
    ids.add(body.notification_id);
  }
  if (Array.isArray(body.notification_ids)) {
    for (const id of body.notification_ids) {
      if (typeof id === "string" && id) ids.add(id);
    }
  }
  if (Array.isArray(body.notifications)) {
    for (const row of body.notifications) {
      if (row && typeof row === "object" && typeof (row as { id?: string }).id === "string") {
        ids.add((row as { id: string }).id);
      }
    }
  }
  // Database Webhook record shape
  const record = body.record as { id?: string } | undefined;
  if (record && typeof record.id === "string") ids.add(record.id);
  return [...ids];
}

async function dispatchOne(
  service: SupabaseClient,
  appServer: webpush.ApplicationServer,
  notification: NotificationRow,
): Promise<{ skipped?: string; sent: number; failed: number; deleted: number }> {
  const category = categoryForType(notification.type);

  const { data: prefs } = await service
    .from("user_notification_preferences")
    .select("push_enabled, agenda, pipeline, chat_human, connections, system")
    .eq("user_id", notification.user_id)
    .maybeSingle();

  if (!prefsAllow(prefs as PrefsRow | null, category)) {
    return { skipped: "prefs_off", sent: 0, failed: 0, deleted: 0 };
  }

  const { data: subs, error: subErr } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);

  if (subErr) throw new Error(subErr.message);

  const rows = (Array.isArray(subs) ? subs : []) as SubRow[];
  if (rows.length === 0) {
    return { skipped: "no_subscriptions", sent: 0, failed: 0, deleted: 0 };
  }

  const route =
    notification.meta && typeof notification.meta.route === "string"
      ? notification.meta.route
      : "/";

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body || "",
    data: {
      notificationId: notification.id,
      type: notification.type,
      route,
      meta: notification.meta ?? {},
    },
  });

  let sent = 0;
  let failed = 0;
  let deleted = 0;

  for (const sub of rows) {
    try {
      const subscriber = appServer.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      });
      await subscriber.pushTextMessage(payload, {
        ttl: 86_400,
        urgency: webpush.Urgency.Normal,
        // Push service Topic header max 32 bytes
        topic: notification.id.replace(/-/g, "").slice(0, 32),
      });
      sent += 1;

      await service
        .from("push_subscriptions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", sub.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const status =
        e instanceof webpush.PushMessageError
          ? e.response.status
          : e && typeof e === "object" && "status" in e
          ? Number((e as { status: number }).status)
          : undefined;
      const gone =
        (e instanceof webpush.PushMessageError && e.isGone()) ||
        status === 404 ||
        status === 410 ||
        /\b404\b/.test(message) ||
        /\b410\b/.test(message) ||
        /gone/i.test(message);

      if (gone) {
        await service.from("push_subscriptions").delete().eq("id", sub.id);
        deleted += 1;
      } else {
        console.error("push-dispatch send failed", sub.id, message);
        failed += 1;
      }
    }
  }

  return { sent, failed, deleted };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    return json({ success: false, error: "Não autorizado" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const ids = collectIds(body);
  if (ids.length === 0) {
    return json({ success: false, error: "notification_id required" }, 400);
  }

  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  let appServer: webpush.ApplicationServer;
  try {
    appServer = await createAppServer();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: message }, 500);
  }

  const { data: notifications, error: fetchError } = await service
    .from("user_notifications")
    .select("id, user_id, company_id, type, title, body, meta")
    .in("id", ids);

  if (fetchError) {
    return json({ success: false, error: fetchError.message }, 500);
  }

  const rows = (Array.isArray(notifications) ? notifications : []) as NotificationRow[];
  const results: Array<Record<string, unknown>> = [];
  let sent = 0;
  let failed = 0;
  let deleted = 0;
  let skipped = 0;

  for (const n of rows) {
    try {
      const r = await dispatchOne(service, appServer, n);
      if (r.skipped) skipped += 1;
      sent += r.sent;
      failed += r.failed;
      deleted += r.deleted;
      results.push({ notification_id: n.id, ...r });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      failed += 1;
      results.push({ notification_id: n.id, error: message });
    }
  }

  const missing = ids.filter((id) => !rows.some((r) => r.id === id));
  for (const id of missing) {
    results.push({ notification_id: id, skipped: "not_found" });
    skipped += 1;
  }

  return json({
    success: true,
    processed: rows.length,
    sent,
    failed,
    deleted,
    skipped,
    results,
  });
});
