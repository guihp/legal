import { supabase } from '@/integrations/supabase/client';

export type ReferrerKind = 'google' | 'social' | 'direct' | 'referral' | 'other';

export function parseReferrerKind(referrer: string | null | undefined): ReferrerKind {
  if (!referrer || typeof referrer !== 'string' || !referrer.trim()) return 'direct';
  const r = referrer.toLowerCase();
  if (r.includes('google.') || r.includes('google.com')) return 'google';
  if (
    r.includes('facebook.') ||
    r.includes('fb.') ||
    r.includes('instagram.') ||
    r.includes('t.co') ||
    r.includes('linkedin.') ||
    r.includes('l.instagram')
  ) {
    return 'social';
  }
  if (r.startsWith('http://') || r.startsWith('https://')) return 'referral';
  return 'other';
}

export function getUtmFromSearch(): { utm_source: string | null; utm_medium: string | null } {
  if (typeof window === 'undefined') return { utm_source: null, utm_medium: null };
  const sp = new URLSearchParams(window.location.search);
  return {
    utm_source: sp.get('utm_source'),
    utm_medium: sp.get('utm_medium'),
  };
}

/** Registra uma visita à vitrine ou LP (falha silenciosa). */
export async function logPublicSiteVisit(params: {
  kind: 'vitrine' | 'landing';
  siteSlug?: string;
  lpSlug?: string;
  path?: string;
}): Promise<void> {
  try {
    const ref = typeof document !== 'undefined' ? document.referrer : '';
    const referrerKind = parseReferrerKind(ref || null);
    const utm = getUtmFromSearch();
    const path =
      params.path ??
      (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null);

    const { error } = await supabase.rpc('log_public_site_visit', {
      p_visit_kind: params.kind,
      p_site_slug: params.kind === 'vitrine' ? params.siteSlug ?? null : null,
      p_lp_slug: params.kind === 'landing' ? params.lpSlug ?? null : null,
      p_path: path,
      p_referrer: ref || null,
      p_referrer_kind: referrerKind,
      p_utm_source: utm.utm_source,
      p_utm_medium: utm.utm_medium,
    });
    if (error) {
      // O cliente Supabase não lança em erro de RPC — sem isto as visitas somem em silêncio.
      if (import.meta.env.DEV) {
        console.warn('[logPublicSiteVisit]', error.message, error);
      }
    }
  } catch {
    // analytics não deve quebrar a página pública
  }
}

export const REFERRER_KIND_LABELS: Record<ReferrerKind, string> = {
  google: 'Google / busca',
  social: 'Redes sociais',
  direct: 'Direto (sem origem)',
  referral: 'Outro site',
  other: 'Outros',
};
