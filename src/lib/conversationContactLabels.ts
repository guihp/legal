/** Valores persistidos em `conversation_contact_labels.status` (slug do catálogo). */
export type ConversationContactLabelStatus = string;

export type AiLabelColor = 'emerald' | 'amber' | 'orange' | 'sky' | 'violet' | 'rose' | 'slate';

export type CompanyAiLabel = {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  color: AiLabelColor | string;
  is_system: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export const AI_LABEL_COLOR_OPTIONS: { value: AiLabelColor; label: string }[] = [
  { value: 'emerald', label: 'Verde' },
  { value: 'amber', label: 'Âmbar' },
  { value: 'orange', label: 'Laranja' },
  { value: 'sky', label: 'Azul' },
  { value: 'violet', label: 'Violeta' },
  { value: 'rose', label: 'Rosa' },
  { value: 'slate', label: 'Cinza' },
];

/** Fallback quando o catálogo ainda não carregou. */
export const SYSTEM_AI_LABELS_FALLBACK: Pick<CompanyAiLabel, 'slug' | 'name' | 'color' | 'is_system' | 'sort_order'>[] = [
  { slug: 'ai_ativa', name: 'AI ATIVA', color: 'emerald', is_system: true, sort_order: 10 },
  { slug: 'humano', name: 'Humano', color: 'amber', is_system: true, sort_order: 20 },
  { slug: 'humano_solicitado', name: 'Humano solicitado', color: 'orange', is_system: true, sort_order: 30 },
  { slug: 'follow_up', name: 'Follow-UP', color: 'sky', is_system: true, sort_order: 40 },
];

const LIST_BADGE_BY_COLOR: Record<AiLabelColor, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/60',
  amber: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/60',
  orange: 'bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/60',
  sky: 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/60',
  violet: 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/60',
  rose: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/60',
  slate: 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/60',
};

const OUTLINE_BADGE_BY_COLOR: Record<AiLabelColor, string> = {
  emerald: 'border-emerald-500/40 text-emerald-300',
  amber: 'border-amber-500/40 text-amber-300',
  orange: 'border-orange-500/40 text-orange-300',
  sky: 'border-sky-500/40 text-sky-300',
  violet: 'border-violet-500/40 text-violet-300',
  rose: 'border-rose-500/40 text-rose-300',
  slate: 'border-slate-500/40 text-slate-300',
};

const SWATCH_BY_COLOR: Record<AiLabelColor, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
};

export function isAiLabelColor(value: string | null | undefined): value is AiLabelColor {
  return !!value && value in LIST_BADGE_BY_COLOR;
}

export function normalizeAiLabelSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function resolveCompanyAiLabel(
  status: string | null | undefined,
  catalog: Array<Pick<CompanyAiLabel, 'slug' | 'name' | 'color'>> | null | undefined,
): { slug: string; name: string; color: AiLabelColor } {
  const slug = String(status || 'ai_ativa').toLowerCase().trim() || 'ai_ativa';
  const list = catalog?.length ? catalog : SYSTEM_AI_LABELS_FALLBACK;
  const found = list.find((l) => l.slug === slug);
  if (found) {
    return {
      slug,
      name: found.name,
      color: isAiLabelColor(found.color) ? found.color : 'slate',
    };
  }
  // Follow-up timed sem catálogo: nome amigável
  if (slug.startsWith('follow_up_')) {
    const rest = slug.replace(/^follow_up_/, '').replace(/_/g, ' ');
    return { slug, name: `Follow-up-${rest}`, color: 'sky' };
  }
  return { slug, name: slug, color: 'slate' };
}

/** Etiquetas de modo de atendimento — mutuamente exclusivas. */
export const ATTENDANCE_LABEL_SLUGS = ['ai_ativa', 'humano', 'humano_solicitado'] as const;

export function isAttendanceLabelSlug(slug: string | null | undefined): boolean {
  const s = String(slug || '').toLowerCase().trim();
  return (ATTENDANCE_LABEL_SLUGS as readonly string[]).includes(s);
}

export type ContactLabelBadge = {
  slug: string;
  name: string;
  color: AiLabelColor | string;
};

/** Ordena: atendimento primeiro, depois tags (follow-up / custom). */
export function sortContactLabelBadges(labels: ContactLabelBadge[]): ContactLabelBadge[] {
  return [...labels].sort((a, b) => {
    const aAtt = isAttendanceLabelSlug(a.slug) ? 0 : 1;
    const bAtt = isAttendanceLabelSlug(b.slug) ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function resolveContactLabelsForSession(
  statuses: string[],
  catalog: Array<Pick<CompanyAiLabel, 'slug' | 'name' | 'color'>> | null | undefined,
): ContactLabelBadge[] {
  const unique = [...new Set(statuses.map((s) => String(s || '').toLowerCase().trim()).filter(Boolean))];
  if (unique.length === 0) unique.push('ai_ativa');
  return sortContactLabelBadges(unique.map((slug) => resolveCompanyAiLabel(slug, catalog)));
}

/** Texto exibido na lista / header (UI). */
export function conversationLabelStatusToDisplay(
  status: string | null | undefined,
  catalog?: Array<Pick<CompanyAiLabel, 'slug' | 'name' | 'color'>> | null,
): string {
  return resolveCompanyAiLabel(status, catalog).name;
}

export function labelColorListBadgeClasses(color: string | null | undefined): string {
  const c = isAiLabelColor(color) ? color : 'slate';
  return LIST_BADGE_BY_COLOR[c];
}

export function labelColorOutlineBadgeClasses(color: string | null | undefined): string {
  const c = isAiLabelColor(color) ? color : 'slate';
  return OUTLINE_BADGE_BY_COLOR[c];
}

export function labelColorSwatchClasses(color: string | null | undefined): string {
  const c = isAiLabelColor(color) ? color : 'slate';
  return SWATCH_BY_COLOR[c];
}

/**
 * Badge compacto (lista Premium / Instagram).
 * Aceita nome de exibição legado OU color token; preferir `labelColorListBadgeClasses`.
 */
export function conversationLabelListBadgeClasses(
  displayLabelOrColor: string | null | undefined,
  catalog?: Array<Pick<CompanyAiLabel, 'slug' | 'name' | 'color'>> | null,
): string {
  const raw = String(displayLabelOrColor || '').trim();
  if (isAiLabelColor(raw)) return LIST_BADGE_BY_COLOR[raw];

  if (catalog?.length) {
    const byName = catalog.find((l) => l.name === raw);
    if (byName) return labelColorListBadgeClasses(byName.color);
  }

  const legacy = SYSTEM_AI_LABELS_FALLBACK.find((l) => l.name === raw || l.slug === raw.toLowerCase());
  if (legacy) return labelColorListBadgeClasses(legacy.color);

  // Compat: display strings antigos
  if (raw === 'Humano') return LIST_BADGE_BY_COLOR.amber;
  if (raw === 'Humano solicitado') return LIST_BADGE_BY_COLOR.orange;
  if (raw === 'AI ATIVA') return LIST_BADGE_BY_COLOR.emerald;

  return LIST_BADGE_BY_COLOR.slate;
}

/** Badge outline (ConversasView legado). */
export function conversationLabelOutlineBadgeClasses(
  displayLabelOrColor: string | null | undefined,
  catalog?: Array<Pick<CompanyAiLabel, 'slug' | 'name' | 'color'>> | null,
): string {
  const raw = String(displayLabelOrColor || '').trim();
  if (isAiLabelColor(raw)) return OUTLINE_BADGE_BY_COLOR[raw];

  if (catalog?.length) {
    const byName = catalog.find((l) => l.name === raw);
    if (byName) return labelColorOutlineBadgeClasses(byName.color);
  }

  const legacy = SYSTEM_AI_LABELS_FALLBACK.find((l) => l.name === raw || l.slug === raw.toLowerCase());
  if (legacy) return labelColorOutlineBadgeClasses(legacy.color);

  if (raw === 'Humano') return OUTLINE_BADGE_BY_COLOR.amber;
  if (raw === 'Humano solicitado') return OUTLINE_BADGE_BY_COLOR.orange;
  if (raw === 'AI ATIVA') return OUTLINE_BADGE_BY_COLOR.emerald;

  return OUTLINE_BADGE_BY_COLOR.slate;
}
