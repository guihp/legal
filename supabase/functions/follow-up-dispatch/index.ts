/**
 * follow-up-dispatch — processa conversation_follow_up_jobs pending (cron).
 * Espelha visit-reminder-dispatch: auth via x-cron-secret / Bearer.
 * Sequência: após sent, enqueue_next_follow_up_job. Quiet hours 07–21 BRT → defer.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FOLLOW_UP_WEBHOOK =
  "https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/follow-up-chats";

/** Quiet hours window — keep in sync with SQL clamp_to_follow_up_window / FOLLOW_UP_WINDOW. */
const FOLLOW_UP_TZ = "America/Sao_Paulo";
const FOLLOW_UP_WINDOW_START_MIN = 7 * 60; // 07:00
const FOLLOW_UP_WINDOW_END_MIN = 21 * 60; // 21:00

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
  const cronSecret = env("FOLLOW_UP_CRON_SECRET") || env("VISIT_REMINDER_CRON_SECRET");
  if (!cronSecret) return true;
  const header = req.headers.get("x-cron-secret") || "";
  const auth = req.headers.get("Authorization") || "";
  return header === cronSecret || auth === `Bearer ${cronSecret}`;
}

function isAiType(t: string | null | undefined): boolean {
  const x = String(t || "").trim().toLowerCase();
  return x === "ia" || x === "ai" || x === "assistant";
}

function isClientType(t: string | null | undefined): boolean {
  const x = String(t || "").trim().toLowerCase();
  return x === "lead" || x === "cliente" || x === "client" || x === "human";
}

/** Local HH:mm minutes from midnight in FOLLOW_UP_TZ. */
function brtMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FOLLOW_UP_TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function isInsideFollowUpWindow(date: Date = new Date()): boolean {
  const m = brtMinutesOfDay(date);
  return m >= FOLLOW_UP_WINDOW_START_MIN && m < FOLLOW_UP_WINDOW_END_MIN;
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
    .from("conversation_follow_up_jobs")
    .select(
      "id, company_id, channel, session_id, schedule_id, cycle_id, label_slug, instancia, delay_minutes, ai_description, attempts, trigger_at, cycle_anchor_at",
    )
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
  let cancelled = 0;
  let deferred = 0;

  for (const job of rows) {
    const attempts = Number(job.attempts || 0) + 1;
    try {
      // Quiet hours: defer to next window open (do not cancel, do not call n8n)
      if (!isInsideFollowUpWindow(new Date())) {
        const { data: clamped, error: clampErr } = await service.rpc(
          "clamp_to_follow_up_window",
          { p_ts: new Date().toISOString() },
        );
        if (clampErr) throw new Error(clampErr.message);
        await service
          .from("conversation_follow_up_jobs")
          .update({
            trigger_at: clamped,
            last_error: "deferred_quiet_hours",
            // keep pending; do not bump attempts for defer
            attempts: Number(job.attempts || 0),
          })
          .eq("id", job.id);
        deferred += 1;
        continue;
      }

      const { data: settings } = await service
        .from("company_follow_up_settings")
        .select("enabled, channel_whatsapp, channel_instagram")
        .eq("company_id", job.company_id)
        .maybeSingle();

      const channelOk =
        job.channel === "instagram"
          ? settings?.channel_instagram === true
          : settings?.channel_whatsapp === true;

      if (!settings?.enabled || !channelOk) {
        await service
          .from("conversation_follow_up_jobs")
          .update({
            status: "cancelled",
            attempts,
            last_error: "follow_up_disabled_or_channel_off",
          })
          .eq("id", job.id);
        cancelled += 1;
        continue;
      }

      // Revalida silêncio: última mensagem da sessão ainda deve ser da IA
      const { data: lastMsgs } = await service
        .from("mensagens")
        .select("type, created_at")
        .eq("company_id", job.company_id)
        .eq("phone", job.session_id)
        .order("created_at", { ascending: false })
        .limit(5);

      const last = Array.isArray(lastMsgs) ? lastMsgs[0] : null;
      if (last && isClientType(last.type)) {
        await service.rpc("handle_client_reply_follow_up", {
          p_company_id: job.company_id,
          p_channel: job.channel,
          p_session_id: job.session_id,
        });
        await service
          .from("conversation_follow_up_jobs")
          .update({
            attempts,
            last_error: "client_replied_before_trigger",
          })
          .eq("id", job.id);
        cancelled += 1;
        continue;
      }

      if (last && !isAiType(last.type) && !isClientType(last.type)) {
        // tipo desconhecido — segue com cautela se não for cliente
      }

      // Stage gate: só Novo Lead / Qualificado
      const { data: stageRaw } = await service.rpc("resolve_follow_up_lead_stage", {
        p_company_id: job.company_id,
        p_channel: job.channel,
        p_session_id: job.session_id,
      });
      const { data: stageOk } = await service.rpc("is_follow_up_allowed_stage", {
        p_stage: stageRaw ?? null,
      });
      if (stageOk !== true) {
        await service
          .from("conversation_follow_up_jobs")
          .update({
            status: "cancelled",
            attempts,
            last_error: "stage_not_allowed",
          })
          .eq("id", job.id);
        await service.rpc("cancel_follow_up_jobs", {
          p_company_id: job.company_id,
          p_channel: job.channel,
          p_session_id: job.session_id,
        });
        // Best-effort: mark siblings with same reason
        await service
          .from("conversation_follow_up_jobs")
          .update({ last_error: "stage_not_allowed" })
          .eq("company_id", job.company_id)
          .eq("channel", job.channel)
          .eq("session_id", job.session_id)
          .eq("status", "cancelled")
          .is("last_error", null);
        cancelled += 1;
        continue;
      }

      // Etiquetas timed (follow_up_7m, …) são aplicadas pelo n8n/API do cliente —
      // não sobrescrever conversation_contact_labels aqui (preserva ai_ativa).

      const plataforma = job.channel === "instagram" ? "Instagram" : "WhatsApp";
      const payload = {
        session_id: job.session_id,
        instancia: job.instancia || "",
        company_id: job.company_id,
        user_email: "system@follow-up-dispatch",
        role: "system",
        plataforma,
        rota: job.channel,
        source: "auto",
        delay_minutes: job.delay_minutes,
        label_slug: job.label_slug,
        ai_description: job.ai_description || "",
        cycle_id: job.cycle_id,
        schedule_id: job.schedule_id,
        job_id: job.id,
      };

      const res = await fetch(FOLLOW_UP_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const bodyText = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(bodyText || `HTTP ${res.status}`);
      }

      await service
        .from("conversation_follow_up_jobs")
        .update({
          status: "sent",
          attempts,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);

      // Sequência: próximo horário só após sent com sucesso
      await service.rpc("enqueue_next_follow_up_job", {
        p_job_id: job.id,
      });

      sent += 1;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const maxAttempts = 5;
      await service
        .from("conversation_follow_up_jobs")
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
    cancelled,
    deferred,
  });
});
