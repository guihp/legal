import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyAgendaReminder } from "../_shared/userNotifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  const cronSecret = env("VISIT_REMINDER_CRON_SECRET");
  if (!cronSecret) return true;
  const header = req.headers.get("x-cron-secret") || "";
  const auth = req.headers.get("Authorization") || "";
  return header === cronSecret || auth === `Bearer ${cronSecret}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isAuthorized(req)) {
    return json({ success: false, error: "Não autorizado" }, 401);
  }

  const service = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
  );

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || 50), 100);
  const nowIso = new Date().toISOString();

  const { data: jobs, error: fetchError } = await service
    .from("visit_reminder_jobs")
    .select("id, webhook_url, payload, attempts")
    .eq("status", "pending")
    .lte("trigger_at", nowIso)
    .order("trigger_at", { ascending: true })
    .limit(limit);

  if (fetchError) {
    return json({ success: false, error: fetchError.message }, 500);
  }

  const rows = Array.isArray(jobs) ? jobs : [];
  let sent = 0;
  let failed = 0;

  for (const job of rows) {
    const attempts = Number(job.attempts || 0) + 1;
    try {
      const res = await fetch(String(job.webhook_url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.payload ?? {}),
      });
      const bodyText = await res.text().catch(() => "");

      if (!res.ok) {
        throw new Error(bodyText || `HTTP ${res.status}`);
      }

      await service
        .from("visit_reminder_jobs")
        .update({
          status: "sent",
          attempts,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);

      // Inbox row for push/outbox (best-effort; n8n webhook already sent)
      try {
        const payload = (job.payload || {}) as Record<string, unknown>;
        const corretor = (payload.corretor || {}) as Record<string, unknown>;
        const visitaData = String(payload.visita_data || "").trim();
        const visitaHora = String(payload.visita_hora || "").trim();
        const visitAtLabel = [visitaData, visitaHora].filter(Boolean).join(" ").trim();
        await notifyAgendaReminder(service, {
          companyId: String(payload.company_id || ""),
          leadId: payload.lead_id != null ? String(payload.lead_id) : null,
          eventId: payload.event_id != null ? String(payload.event_id) : null,
          jobId: String(job.id),
          brokerId: corretor.id != null ? String(corretor.id) : null,
          clientName: payload.nome_cliente != null ? String(payload.nome_cliente) : null,
          reminderType: payload.lembrete_tipo != null
            ? String(payload.lembrete_tipo)
            : null,
          visitAtLabel: visitAtLabel || null,
        });
      } catch (notifyErr) {
        console.warn("agenda_reminder_notify_failed", notifyErr);
      }

      sent += 1;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const maxAttempts = 5;
      await service
        .from("visit_reminder_jobs")
        .update({
          status: attempts >= maxAttempts ? "failed" : "pending",
          attempts,
          last_error: message.slice(0, 500),
        })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return json({
    success: true,
    processed: rows.length,
    sent,
    failed,
  });
});
