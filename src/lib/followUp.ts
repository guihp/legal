import { supabase } from '@/integrations/supabase/client';

export const FOLLOW_UP_WEBHOOK_URL =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/follow-up-chats';

/**
 * Global quiet-hours window for auto follow-up dispatch.
 * Authoritative clamp lives in SQL `clamp_to_follow_up_window` / edge; this is for UI/docs.
 */
export const FOLLOW_UP_WINDOW = {
  tz: 'America/Sao_Paulo',
  start: '07:00',
  end: '21:00',
} as const;

/** Generic Follow-UP label (shown in Etiquetas). Timed sub-labels live in Follow-up section. */
export const FOLLOW_UP_GENERIC_SLUG = 'follow_up';

/**
 * CRM stages that allow automatic + manual follow-up.
 * Match by normalized slug (title or kebab; accents ignored) — keep in sync with
 * SQL `is_follow_up_allowed_stage`.
 */
export const FOLLOW_UP_ALLOWED_STAGE_SLUGS = ['novo-lead', 'qualificado'] as const;

export type FollowUpAllowedStageSlug = (typeof FOLLOW_UP_ALLOWED_STAGE_SLUGS)[number];

/** Normalize leads.stage title/slug → accent-free kebab (Novo Lead → novo-lead). */
export function normalizeLeadStageSlug(stage: string | null | undefined): string {
  return String(stage || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/ /g, '-');
}

/** True when stage is Novo Lead or Qualificado (or no-op false for empty/unknown). */
export function isFollowUpAllowedStage(stage: string | null | undefined): boolean {
  const slug = normalizeLeadStageSlug(stage);
  return (FOLLOW_UP_ALLOWED_STAGE_SLUGS as readonly string[]).includes(slug);
}

/**
 * Resolve CRM stage for a conversation and check allow-list.
 * Prefers `crmStage` on the conversation object; falls back to leads by id / phone / IG.
 */
export async function resolveFollowUpStageGate(params: {
  companyId: string;
  channel: 'whatsapp' | 'instagram';
  sessionId: string;
  crmStage?: string | null;
  leadId?: string | null;
}): Promise<{ allowed: boolean; stage: string | null }> {
  const fromConv = String(params.crmStage || '').trim();
  if (fromConv) {
    return { allowed: isFollowUpAllowedStage(fromConv), stage: fromConv };
  }

  const companyId = params.companyId;
  const sessionId = String(params.sessionId || '').trim();
  if (!companyId || !sessionId) {
    return { allowed: false, stage: null };
  }

  try {
    if (params.leadId) {
      const { data } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', params.leadId)
        .eq('company_id', companyId)
        .maybeSingle();
      const stage = data?.stage != null ? String(data.stage).trim() : null;
      return { allowed: isFollowUpAllowedStage(stage), stage };
    }

    const { data: rpcStage, error: rpcError } = await (supabase as any).rpc(
      'resolve_follow_up_lead_stage',
      {
        p_company_id: companyId,
        p_channel: params.channel,
        p_session_id: sessionId,
      },
    );
    if (!rpcError && rpcStage != null && String(rpcStage).trim() !== '') {
      const stage = String(rpcStage).trim();
      return { allowed: isFollowUpAllowedStage(stage), stage };
    }
  } catch (e) {
    console.warn('[resolveFollowUpStageGate]', e);
  }

  return { allowed: false, stage: null };
}

export const FOLLOW_UP_STAGE_BLOCKED_TOAST = {
  title: 'Follow-up indisponível',
  description:
    'Follow-up só é permitido quando o lead está em “Novo Lead” ou “Qualificado”.',
} as const;

/** Timed system + custom follow-up label slugs: follow_up_15m, follow_up_2h, … */
export function isTimedFollowUpLabelSlug(slug: string | null | undefined): boolean {
  const s = String(slug || '').trim().toLowerCase();
  if (!s.startsWith('follow_up_')) return false;
  return s !== FOLLOW_UP_GENERIC_SLUG;
}

export function formatFollowUpDelayLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m}m`;
}

export function followUpLabelSlugForDelay(minutes: number): string {
  return `follow_up_${formatFollowUpDelayLabel(minutes).toLowerCase()}`;
}

export function followUpLabelNameForDelay(minutes: number): string {
  return `Follow-up-${formatFollowUpDelayLabel(minutes)}`;
}

export async function cancelFollowUpJobs(params: {
  companyId: string;
  channel: 'whatsapp' | 'instagram';
  sessionId: string;
}): Promise<number> {
  const { data, error } = await (supabase as any).rpc('cancel_follow_up_jobs', {
    p_company_id: params.companyId,
    p_channel: params.channel,
    p_session_id: params.sessionId,
  });
  if (error) {
    console.warn('[cancelFollowUpJobs]', error.message);
    return 0;
  }
  return typeof data === 'number' ? data : Number(data) || 0;
}
