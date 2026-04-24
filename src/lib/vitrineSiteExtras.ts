/** Conteúdo opcional do site vitrine (coluna company_websites.vitrine_extras). */
export type VitrineExtras = {
  header_bg?: string;
  header_fg?: string;
  header_muted?: string;
  header_tagline?: string;
  /** Se true, usa company_settings.company_name_font_family nos títulos (.sv-display). */
  use_company_display_font?: boolean;
  about_kicker?: string;
  about_title?: string;
  about_paragraph?: string;
  about_bullet1?: string;
  about_bullet2?: string;
  about_bullet3?: string;
  contact_kicker?: string;
  contact_title?: string;
  contact_intro?: string;
};

export const VITRINE_EXTRAS_DEFAULTS: Required<
  Pick<
    VitrineExtras,
    | 'header_bg'
    | 'header_fg'
    | 'header_muted'
    | 'header_tagline'
    | 'use_company_display_font'
    | 'about_kicker'
    | 'about_title'
    | 'about_paragraph'
    | 'about_bullet1'
    | 'about_bullet2'
    | 'about_bullet3'
    | 'contact_kicker'
    | 'contact_title'
    | 'contact_intro'
  >
> = {
  header_bg: '#090807',
  header_fg: '#fafaf8',
  header_muted: '#d6d3d1',
  header_tagline: 'Imóveis selecionados',
  use_company_display_font: true,
  about_kicker: 'Sobre nós',
  about_title: '',
  about_paragraph: '',
  about_bullet1: 'Atendimento humano e personalizado via WhatsApp',
  about_bullet2: 'Imóveis verificados com fotos atualizadas',
  about_bullet3: 'Assessoria completa da visita ao contrato',
  contact_kicker: 'Fale com um especialista',
  contact_title: 'Vamos conversar?',
  contact_intro:
    'Conte para a gente o que você procura. Nosso time responde rápido e te ajuda a encontrar o imóvel certo.',
};

export function parseVitrineExtras(raw: unknown): VitrineExtras {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as VitrineExtras;
}

export function mergeVitrineExtras(partial: VitrineExtras): Required<
  Pick<
    VitrineExtras,
    | 'header_bg'
    | 'header_fg'
    | 'header_muted'
    | 'header_tagline'
    | 'use_company_display_font'
    | 'about_kicker'
    | 'about_title'
    | 'about_paragraph'
    | 'about_bullet1'
    | 'about_bullet2'
    | 'about_bullet3'
    | 'contact_kicker'
    | 'contact_title'
    | 'contact_intro'
  >
> {
  const p = partial || {};
  const d = VITRINE_EXTRAS_DEFAULTS;
  return {
    header_bg: (p.header_bg || '').trim() || d.header_bg,
    header_fg: (p.header_fg || '').trim() || d.header_fg,
    header_muted: (p.header_muted || '').trim() || d.header_muted,
    header_tagline: (p.header_tagline || '').trim() || d.header_tagline,
    use_company_display_font: p.use_company_display_font !== false,
    about_kicker: (p.about_kicker || '').trim() || d.about_kicker,
    about_title: (p.about_title || '').trim(),
    about_paragraph: (p.about_paragraph || '').trim(),
    about_bullet1: (p.about_bullet1 || '').trim() || d.about_bullet1,
    about_bullet2: (p.about_bullet2 || '').trim() || d.about_bullet2,
    about_bullet3: (p.about_bullet3 || '').trim() || d.about_bullet3,
    contact_kicker: (p.contact_kicker || '').trim() || d.contact_kicker,
    contact_title: (p.contact_title || '').trim() || d.contact_title,
    contact_intro: (p.contact_intro || '').trim() || d.contact_intro,
  };
}

/** Normaliza modalidade do imóvel para chave de filtro (venda | aluguel | temporada | outro). */
export function vitrineModalidadeKey(m: string | null | undefined): string {
  const raw = String(m || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
  if (!raw) return '';
  if (/\b(for[\s-]*sale|sale|venda|comprar)\b/.test(raw) || raw === 'sale' || raw === 'venda') return 'venda';
  if (/\b(for[\s-]*rent|rent|rental|aluguel|locacao|locação)\b/.test(raw) || raw === 'rent' || raw === 'aluguel')
    return 'aluguel';
  if (/\b(temporada|season|seasonal)\b/.test(raw)) return 'temporada';
  return raw.replace(/\s+/g, '_');
}

const MOD_LABELS: Record<string, string> = {
  venda: 'Venda',
  aluguel: 'Aluguel',
  temporada: 'Temporada',
};

export function vitrineModalidadeLabel(key: string): string {
  if (!key) return 'Todos';
  return MOD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

export function instagramDisplayHandle(arroba: string): string {
  const t = arroba.trim();
  if (!t) return '';
  return t.startsWith('@') ? t : `@${t.replace(/^@+/, '')}`;
}

export function instagramProfilePath(arroba: string): string {
  return arroba.trim().replace(/^@+/, '');
}
