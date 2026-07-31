import { VITRINE_EXTRAS_DEFAULTS, type VitrineExtras } from '@/lib/vitrineSiteExtras';

export const SITE_HOST = 'imobi.iafeoficial.com';
export const DESC_MAX = 220;

export type VitrineSectionId =
  | 'identidade'
  | 'aparencia'
  | 'textos'
  | 'assets'
  | 'rastreamento';

export type PreviewProperty = {
  id: string | number;
  title: string;
  priceLabel: string;
  imageUrl?: string | null;
};

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
};

export type ContrastLevel = 'AAA' | 'AA' | 'A' | 'fail';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

/** Contrast of `fg` on `bg`. Falls back to white/black pairing for single-swatch fields. */
export function contrastRatio(fg: string, bg: string): number | null {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  if (L1 == null || L2 == null) return null;
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastLevel(fg: string, bg: string): ContrastLevel {
  const ratio = contrastRatio(fg, bg);
  if (ratio == null) return 'fail';
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'A';
  return 'fail';
}

/** Best WCAG level for a single color vs white and black (for palette swatches). */
export function swatchContrastLevel(color: string): ContrastLevel {
  const vsWhite = contrastLevel(color, '#ffffff');
  const vsBlack = contrastLevel(color, '#000000');
  const rank = (l: ContrastLevel) => ({ AAA: 4, AA: 3, A: 2, fail: 1 }[l]);
  return rank(vsWhite) >= rank(vsBlack) ? vsWhite : vsBlack;
}

export function publicSiteUrl(slug: string): string {
  const s = (slug || '').trim();
  if (!s) return `${SITE_HOST}/s/…`;
  return `${SITE_HOST}/s/${s}`;
}

export function publicSitePath(slug: string): string {
  return `/s/${(slug || '').trim()}`;
}

export function formatLastPublish(updatedAt?: string | null): string {
  if (!updatedAt) return 'ainda não publicado';
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return 'ainda não publicado';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `hoje, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `ontem, ${time}`;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function filled(v: string | null | undefined): boolean {
  return Boolean((v || '').trim());
}

export type FillSnapshot = {
  title: string;
  slug: string;
  description: string;
  themeColor: string;
  titleColor: string;
  headerBg: string;
  headerFg: string;
  headerMuted: string;
  headerTagline: string;
  aboutKicker: string;
  aboutTitle: string;
  aboutParagraph: string;
  aboutBullet1: string;
  aboutBullet2: string;
  aboutBullet3: string;
  contactKicker: string;
  contactTitle: string;
  contactIntro: string;
  logoUrl: string;
  hero1: string;
  hero2: string;
  hero3: string;
  pixel: string;
  analytics: string;
};

export function sectionCounts(s: FillSnapshot): Record<VitrineSectionId, number> {
  return {
    identidade: [s.title, s.slug, s.description].filter(filled).length,
    aparencia: [s.themeColor, s.titleColor, s.headerBg, s.headerFg, s.headerMuted].filter(filled)
      .length,
    textos: [
      s.aboutKicker,
      s.aboutTitle || s.title,
      s.aboutParagraph || s.description,
      s.aboutBullet1,
      s.aboutBullet2,
      s.aboutBullet3,
      s.contactKicker,
      s.contactTitle,
      s.contactIntro,
    ].filter(filled).length,
    assets: [s.logoUrl, s.hero1, s.hero2, s.hero3].filter(filled).length,
    rastreamento: [s.pixel, s.analytics].filter(filled).length,
  };
}

export function fillPercent(s: FillSnapshot): number {
  const checks = [
    filled(s.title),
    filled(s.slug),
    filled(s.description),
    filled(s.themeColor),
    filled(s.titleColor),
    filled(s.headerBg),
    filled(s.headerFg),
    filled(s.headerMuted),
    filled(s.headerTagline),
    filled(s.aboutKicker),
    filled(s.aboutTitle) || filled(s.title),
    filled(s.aboutParagraph) || filled(s.description),
    filled(s.aboutBullet1),
    filled(s.aboutBullet2),
    filled(s.aboutBullet3),
    filled(s.contactKicker),
    filled(s.contactTitle),
    filled(s.logoUrl),
    filled(s.hero1),
    filled(s.hero2),
    filled(s.hero3),
    // tracking optional — counted lightly: only if at least one present contributes
  ];
  const trackingBonus = filled(s.pixel) || filled(s.analytics) ? 1 : 0;
  const done = checks.filter(Boolean).length + trackingBonus;
  const total = checks.length + 1;
  return Math.round((done / total) * 100);
}

export function buildChecklist(s: FillSnapshot): ChecklistItem[] {
  const heroes = [s.hero1, s.hero2, s.hero3].filter(filled).length;
  const textsOk =
    filled(s.aboutKicker) &&
    (filled(s.aboutTitle) || filled(s.title)) &&
    (filled(s.aboutParagraph) || filled(s.description)) &&
    filled(s.contactKicker) &&
    filled(s.contactTitle);
  return [
    {
      id: 'logo',
      label: 'Logo enviada',
      detail: filled(s.logoUrl) ? 'ok' : 'pendente',
      ok: filled(s.logoUrl),
    },
    {
      id: 'heroes',
      label: '3 capas do hero',
      detail: heroes === 3 ? '16:9' : `${heroes}/3`,
      ok: heroes === 3,
    },
    {
      id: 'texts',
      label: 'Textos Sobre e contato',
      detail: textsOk ? 'completo' : 'incompleto',
      ok: textsOk,
    },
    {
      id: 'pixel',
      label: 'Pixel de rastreamento',
      detail: filled(s.pixel) || filled(s.analytics) ? 'ok' : 'pendente',
      ok: filled(s.pixel) || filled(s.analytics),
    },
  ];
}

export function restoreAppearanceDefaults(): Pick<
  Required<VitrineExtras>,
  'header_bg' | 'header_fg' | 'header_muted' | 'header_tagline' | 'use_company_display_font'
> & { themeColor: string; titleColor: string } {
  return {
    themeColor: '#f7612a',
    titleColor: '#f7f7f7',
    header_bg: VITRINE_EXTRAS_DEFAULTS.header_bg,
    header_fg: VITRINE_EXTRAS_DEFAULTS.header_fg,
    header_muted: VITRINE_EXTRAS_DEFAULTS.header_muted,
    header_tagline: VITRINE_EXTRAS_DEFAULTS.header_tagline,
    use_company_display_font: true,
  };
}

export function formatBrl(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(n);
}
