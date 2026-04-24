import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import {
  BuildingIcon,
  MapPin,
  Search,
  Sparkles,
  X,
  Home,
  Building2,
  Trees,
  Store,
  Bed,
  Bath,
  Car,
  Ruler,
  SlidersHorizontal,
  ChevronDown,
  CheckCircle2,
  Phone,
  Mail,
  MessageCircle,
  Instagram,
} from 'lucide-react';
import { normalizeBrandDisplayName } from '@/lib/brandingDisplay';
import {
  parseVitrineExtras,
  mergeVitrineExtras,
  vitrineModalidadeKey,
  vitrineModalidadeLabel,
  instagramDisplayHandle,
  instagramProfilePath,
} from '@/lib/vitrineSiteExtras';
import { logPublicSiteVisit } from '@/lib/publicSiteVisit';
import { PublicImobiliariaFooter, type PublicFooterCompany } from '@/components/public/PublicImobiliariaFooter';

type Imovel = Database['public']['Tables']['imoveisvivareal']['Row'];

export type CompanyWebsite = {
  id: string;
  company_id: string;
  slug: string;
  title: string;
  description: string | null;
  pixel_facebook: string | null;
  analytics_google: string | null;
  theme_color: string;
  is_published: boolean;
  logo_url?: string | null;
  title_color?: string | null;
  hero_images?: string[] | null;
  vitrine_extras?: unknown;
};

type CompanyPublicRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  logo_url: string | null;
  id_instagram?: string | null;
  arroba_instagram_empresa?: string | null;
};

type SortOrder = 'recent' | 'price_asc' | 'price_desc' | 'area_desc';

type Filters = {
  query: string;
  modalidade: string; // '' | 'venda' | 'aluguel' | 'temporada'
  cidade: string;
  tipo: string;
  quartos: number | null;      // 0 = qualquer | 1..4 (4 = 4+)
  banheiros: number | null;
  garagem: number | null;
  priceMin: string;
  priceMax: string;
  sort: SortOrder;
};

const INITIAL_FILTERS: Filters = {
  query: '',
  modalidade: '',
  cidade: '',
  tipo: '',
  quartos: null,
  banheiros: null,
  garagem: null,
  priceMin: '',
  priceMax: '',
  sort: 'recent',
};

function parseMoney(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[^\d]/g, '');
  if (!cleaned) return null;
  return parseInt(cleaned, 10);
}

function formatMoneyInput(v: string): string {
  const n = parseMoney(v);
  if (n == null) return '';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function getTypeIcon(tipo: string | null | undefined) {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('apart')) return Building2;
  if (t.includes('terreno') || t.includes('lote')) return Trees;
  if (t.includes('comerc') || t.includes('loja') || t.includes('sala')) return Store;
  return Home;
}

export default function SiteVitrine({ companySlug: propCompanySlug }: { companySlug?: string }) {
  const { companySlug: paramCompanySlug } = useParams<{ companySlug: string }>();
  const companySlug = propCompanySlug || paramCompanySlug;
  const [website, setWebsite] = useState<CompanyWebsite | null>(null);
  const [properties, setProperties] = useState<Imovel[]>([]);
  const [lpSlugByPropertyId, setLpSlugByPropertyId] = useState<Record<number, string>>({});
  const [companyRow, setCompanyRow] = useState<CompanyPublicRow | null>(null);
  const [settingsLogo, setSettingsLogo] = useState<string | null>(null);
  const [settingsDisplayFont, setSettingsDisplayFont] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visitLoggedRef = useRef(false);
  const heroImages = (Array.isArray((website as any)?.hero_images) ? (website as any).hero_images : []).filter(Boolean);

  useEffect(() => {
    visitLoggedRef.current = false;
  }, [companySlug]);

  useEffect(() => {
    setHeroIndex(0);
  }, [companySlug]);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroImages.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [heroImages.length]);

  useEffect(() => {
    async function loadSite() {
      if (!companySlug) return;
      try {
        setLoading(true);
        const { data, error: webError } = await supabase
          .from('company_websites' as never)
          .select('*')
          .eq('slug', companySlug)
          .eq('is_published', true)
          .single();

        const webData = data as CompanyWebsite | null;

        if (webError || !webData) {
          throw new Error('Site não encontrado ou está fora do ar.');
        }

        setWebsite(webData);

        const [companyRes, settingsRes, propsRes, lpsRes] = await Promise.all([
          supabase
            .from('companies')
            .select('name, phone, email, address, cnpj, logo_url, id_instagram, arroba_instagram_empresa')
            .eq('id', webData.company_id)
            .maybeSingle(),
          supabase
            .from('company_settings' as never)
            .select('logo_url, company_name_font_family')
            .eq('company_id', webData.company_id)
            .maybeSingle(),
          supabase
            .from('imoveisvivareal')
            .select('*')
            .eq('company_id', webData.company_id)
            .eq('disponibilidade', 'disponivel')
            .order('created_at', { ascending: false }),
          supabase
            .from('property_landing_pages' as never)
            .select('property_id, slug')
            .eq('company_id', webData.company_id)
            .eq('is_published', true),
        ]);

        if (companyRes.data) {
          setCompanyRow(companyRes.data as CompanyPublicRow);
        } else {
          setCompanyRow(null);
        }

        const st = settingsRes.data as { logo_url?: string | null; company_name_font_family?: string | null } | null;
        setSettingsLogo(st?.logo_url?.trim() || null);
        setSettingsDisplayFont(st?.company_name_font_family?.trim() || null);

        if (!propsRes.error && propsRes.data) {
          setProperties(propsRes.data);
        }

        const map: Record<number, string> = {};
        if (lpsRes.data && Array.isArray(lpsRes.data)) {
          for (const row of lpsRes.data as { property_id: number; slug: string }[]) {
            if (row?.property_id != null && row.slug) {
              map[row.property_id] = row.slug;
            }
          }
        }
        setLpSlugByPropertyId(map);

        const displayTitle = normalizeBrandDisplayName(webData.title) || webData.title;
        document.title = displayTitle;

        if (!visitLoggedRef.current && companySlug) {
          visitLoggedRef.current = true;
          void logPublicSiteVisit({ kind: 'vitrine', siteSlug: companySlug });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      } finally {
        setLoading(false);
      }
    }

    loadSite();
    return () => {
      document.title = 'IAFÉ IMOBI';
    };
  }, [companySlug]);

  // Derivados — opções dinâmicas
  const options = useMemo(() => {
    const cidades = new Set<string>();
    const tipos = new Set<string>();
    const modalidades = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = 0;
    for (const p of properties) {
      if (p.cidade) cidades.add(p.cidade);
      if (p.tipo_imovel) tipos.add(p.tipo_imovel);
      const mk = vitrineModalidadeKey(p.modalidade);
      if (mk) modalidades.add(mk);
      if (typeof p.preco === 'number') {
        if (p.preco < minPrice) minPrice = p.preco;
        if (p.preco > maxPrice) maxPrice = p.preco;
      }
    }
    const ord = ['venda', 'aluguel', 'temporada'];
    const modKeys = Array.from(modalidades);
    const modalidadesSorted = [
      ...ord.filter((k) => modKeys.includes(k)),
      ...modKeys.filter((k) => !ord.includes(k)).sort((a, b) => a.localeCompare(b)),
    ];
    return {
      cidades: Array.from(cidades).sort((a, b) => a.localeCompare(b)),
      tipos: Array.from(tipos).sort((a, b) => a.localeCompare(b)),
      modalidades: modalidadesSorted,
      minPrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice,
    };
  }, [properties]);

  const stats = useMemo(
    () => ({
      total: properties.length,
      cidades: options.cidades.length,
      tipos: options.tipos.length,
    }),
    [properties.length, options.cidades.length, options.tipos.length]
  );

  // Aplicar filtros
  const filteredProperties = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const priceMin = parseMoney(filters.priceMin);
    const priceMax = parseMoney(filters.priceMax);
    let list = properties.filter((p) => {
      if (q) {
        const modKey = vitrineModalidadeKey(String(p.modalidade || ''));
        const hay = [
          p.bairro,
          p.cidade,
          p.tipo_imovel,
          p.descricao,
          p.modalidade,
          ...(modKey ? [vitrineModalidadeLabel(modKey)] : []),
          p.endereco,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.modalidade && vitrineModalidadeKey(p.modalidade) !== filters.modalidade) return false;
      if (filters.cidade && String(p.cidade || '') !== filters.cidade) return false;
      if (filters.tipo && String(p.tipo_imovel || '') !== filters.tipo) return false;
      if (filters.quartos != null) {
        const q4 = p.quartos ?? 0;
        if (filters.quartos === 4) {
          if (q4 < 4) return false;
        } else if (q4 !== filters.quartos) return false;
      }
      if (filters.banheiros != null) {
        const b = p.banheiros ?? 0;
        if (filters.banheiros === 3) {
          if (b < 3) return false;
        } else if (b !== filters.banheiros) return false;
      }
      if (filters.garagem != null) {
        const g = p.garagem ?? 0;
        if (filters.garagem === 3) {
          if (g < 3) return false;
        } else if (g !== filters.garagem) return false;
      }
      if (priceMin != null && (p.preco ?? 0) < priceMin) return false;
      if (priceMax != null && (p.preco ?? Infinity) > priceMax) return false;
      return true;
    });

    switch (filters.sort) {
      case 'price_asc':
        list = [...list].sort((a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity));
        break;
      case 'price_desc':
        list = [...list].sort((a, b) => (b.preco ?? 0) - (a.preco ?? 0));
        break;
      case 'area_desc':
        list = [...list].sort((a, b) => (b.tamanho_m2 ?? 0) - (a.tamanho_m2 ?? 0));
        break;
      case 'recent':
      default:
        break;
    }
    return list;
  }, [properties, filters]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof Filters | 'query'; label: string; reset: () => void }[] = [];
    if (filters.query.trim())
      chips.push({ key: 'query', label: `"${filters.query.trim()}"`, reset: () => setFilters((f) => ({ ...f, query: '' })) });
    if (filters.modalidade)
      chips.push({
        key: 'modalidade',
        label: vitrineModalidadeLabel(filters.modalidade),
        reset: () => setFilters((f) => ({ ...f, modalidade: '' })),
      });
    if (filters.cidade)
      chips.push({ key: 'cidade', label: filters.cidade, reset: () => setFilters((f) => ({ ...f, cidade: '' })) });
    if (filters.tipo)
      chips.push({ key: 'tipo', label: filters.tipo, reset: () => setFilters((f) => ({ ...f, tipo: '' })) });
    if (filters.quartos != null)
      chips.push({
        key: 'quartos',
        label: `${filters.quartos === 4 ? '4+' : filters.quartos} quarto${filters.quartos === 1 ? '' : 's'}`,
        reset: () => setFilters((f) => ({ ...f, quartos: null })),
      });
    if (filters.banheiros != null)
      chips.push({
        key: 'banheiros',
        label: `${filters.banheiros === 3 ? '3+' : filters.banheiros} banheiro${filters.banheiros === 1 ? '' : 's'}`,
        reset: () => setFilters((f) => ({ ...f, banheiros: null })),
      });
    if (filters.garagem != null)
      chips.push({
        key: 'garagem',
        label: `${filters.garagem === 3 ? '3+' : filters.garagem} vaga${filters.garagem === 1 ? '' : 's'}`,
        reset: () => setFilters((f) => ({ ...f, garagem: null })),
      });
    if (filters.priceMin)
      chips.push({
        key: 'priceMin',
        label: `Mín R$ ${filters.priceMin}`,
        reset: () => setFilters((f) => ({ ...f, priceMin: '' })),
      });
    if (filters.priceMax)
      chips.push({
        key: 'priceMax',
        label: `Máx R$ ${filters.priceMax}`,
        reset: () => setFilters((f) => ({ ...f, priceMax: '' })),
      });
    return chips;
  }, [filters]);

  const hasAnyFilter = activeFilterChips.length > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090807]">
        <div className="flex flex-col items-center gap-6">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-amber-200/70" />
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">Carregando</p>
        </div>
      </div>
    );
  }

  if (error || !website) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 p-6 text-center">
        <BuildingIcon className="mb-4 h-16 w-16 text-stone-400" />
        <h1 className="text-2xl font-semibold text-stone-900">Ops! Algo deu errado.</h1>
        <p className="mt-2 text-stone-600">{error || 'Site indisponível'}</p>
      </div>
    );
  }

  const accent = website.theme_color || '#b8955e';
  const titleColor = website.title_color || '#FFFFFF';
  const vx = mergeVitrineExtras(parseVitrineExtras(website.vitrine_extras));
  const displayStack =
    vx.use_company_display_font && settingsDisplayFont?.trim()
      ? `"${settingsDisplayFont.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", ui-sans-serif, system-ui, sans-serif`
      : '"Playfair Display", Georgia, "Times New Roman", serif';
  const siteDisplayTitle = normalizeBrandDisplayName(website.title) || website.title;
  const companyLegalName = companyRow?.name?.trim() || siteDisplayTitle;
  const brandDisplay = companyLegalName;
  const logoUrl = website.logo_url || settingsLogo || companyRow?.logo_url || null;
  const igPublic =
    !!String(companyRow?.id_instagram || '').trim() &&
    !!String(companyRow?.arroba_instagram_empresa || '').trim();
  const showSobreSection = !!(
    website.description ||
    companyRow?.address ||
    companyRow?.phone ||
    companyRow?.email ||
    igPublic
  );

  const footerCompany: PublicFooterCompany = {
    legalName: companyLegalName,
    displayName: brandDisplay,
    logoUrl,
    phone: companyRow?.phone ?? null,
    email: companyRow?.email ?? null,
    address: companyRow?.address ?? null,
    cnpj: companyRow?.cnpj ?? null,
    vitrineSlug: website.slug,
  };

  const phoneDigits = (companyRow?.phone || '').replace(/\D/g, '');
  const whatsappLink = phoneDigits
    ? `https://wa.me/${phoneDigits.startsWith('55') ? phoneDigits : '55' + phoneDigits}?text=${encodeURIComponent(
        `Olá! Vim pelo site da ${brandDisplay} e gostaria de mais informações sobre os imóveis.`
      )}`
    : null;

  const quickCategories: Array<{ label: string; match: string; icon: typeof Home }> = [
    { label: 'Casa', match: 'casa', icon: Home },
    { label: 'Apartamento', match: 'apart', icon: Building2 },
    { label: 'Terreno', match: 'terreno', icon: Trees },
    { label: 'Comercial', match: 'comerc', icon: Store },
  ].filter((c) => options.tipos.some((t) => t.toLowerCase().includes(c.match)));

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  return (
    <div
      className="min-h-screen bg-[#fafaf8] text-stone-800 antialiased selection:bg-stone-300/40"
      style={{ '--sv-accent': accent } as React.CSSProperties}
    >
      <style>{`
        .sv-display { font-family: ${displayStack}; }
        [data-sv-header] .sv-navlink:hover { color: ${vx.header_fg} !important; }
      `}</style>

      {/* Top bar — fundo opaco (sem blur) para contraste sobre o hero */}
      <header
        data-sv-header
        className="sticky top-0 z-50 border-b shadow-[0_1px_0_rgba(0,0,0,0.12)]"
        style={{ backgroundColor: vx.header_bg, borderColor: `${vx.header_muted}40` }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 w-auto max-w-[150px] object-contain md:h-11" />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#090807] shadow-sm"
                style={{ backgroundColor: accent }}
              >
                {brandDisplay.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium tracking-tight md:text-lg" style={{ color: vx.header_fg }}>
                {brandDisplay}
              </p>
              <p className="truncate text-[10px] uppercase tracking-[0.22em]" style={{ color: vx.header_muted }}>
                {vx.header_tagline}
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#vitrine-results"
              className="sv-navlink text-xs font-medium uppercase tracking-[0.22em] transition"
              style={{ color: vx.header_muted }}
            >
              Imóveis
            </a>
            <a
              href="#sobre"
              className="sv-navlink text-xs font-medium uppercase tracking-[0.22em] transition"
              style={{ color: vx.header_muted }}
            >
              Sobre
            </a>
            <a
              href="#contato"
              className="sv-navlink text-xs font-medium uppercase tracking-[0.22em] transition"
              style={{ color: vx.header_muted }}
            >
              Contato
            </a>
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <Sparkles className="h-4 w-4 opacity-60" style={{ color: accent }} />
            <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: vx.header_muted }}>
              Vitrine
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-stone-200/80 bg-[#090807] px-4 pb-16 pt-12 md:px-8 md:pb-20 md:pt-16"
        style={{
          backgroundImage: heroImages[heroIndex]
            ? `linear-gradient(135deg, rgba(9,8,7,0.9) 0%, rgba(26,24,20,0.78) 42%, rgba(15,14,12,0.9) 100%), radial-gradient(ellipse 80% 50% at 50% -20%, ${accent}33, transparent), url(${heroImages[heroIndex]})`
            : `linear-gradient(135deg, #090807 0%, #1a1814 42%, #0f0e0c 100%), radial-gradient(ellipse 80% 50% at 50% -20%, ${accent}33, transparent)`,
          backgroundSize: heroImages[heroIndex] ? 'cover, auto, cover' : undefined,
          backgroundPosition: heroImages[heroIndex] ? 'center, center, center' : undefined,
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-stone-500">Catálogo exclusivo</p>
          <h1
            className="sv-display text-4xl font-semibold leading-[1.12] md:text-5xl lg:text-6xl"
            style={{ color: titleColor }}
          >
            {siteDisplayTitle}
          </h1>
          {website.description && (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-400 md:text-xl">{website.description}</p>
          )}

          {/* Modalidade pills */}
          {options.modalidades.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {['', ...options.modalidades].map((m) => {
                const active = filters.modalidade === m;
                const label = vitrineModalidadeLabel(m);
                return (
                  <button
                    key={m || 'all'}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, modalidade: m }))}
                    className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                      active
                        ? 'text-[#090807] shadow'
                        : 'border border-white/15 text-stone-300 hover:bg-white/10 hover:text-white'
                    }`}
                    style={active ? { backgroundColor: accent } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Barra de busca */}
          <div className="mx-auto mt-6 flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 pl-4 shadow-inner backdrop-blur-md">
            <Search className="h-5 w-5 shrink-0 text-stone-500" />
            <input
              type="text"
              placeholder="Buscar por bairro, cidade, tipo..."
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setFilters((f) => ({ ...f, query: '' }));
              }}
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none"
              aria-label="Buscar"
            />
            {filters.query.trim() ? (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, query: '' }))}
                className="shrink-0 rounded-xl px-3 py-3 text-stone-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('vitrine-results');
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-[#090807] transition hover:brightness-110"
              style={{ backgroundColor: accent }}
            >
              Buscar
            </button>
          </div>
        </div>

        {heroImages.length > 1 && (
          <div className="relative z-10 mt-8 flex items-center justify-center gap-2">
            {heroImages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setHeroIndex(i)}
                className={i === heroIndex ? 'h-2 w-8 rounded-full bg-white' : 'h-2 w-2 rounded-full bg-white/45'}
                aria-label={`Capa ${i + 1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Stats bar */}
      <section className="border-b border-stone-200/80 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-stone-200/80 px-4 py-6 md:px-8">
          <div className="flex flex-col items-center text-center">
            <span className="sv-display text-3xl font-semibold text-stone-900 md:text-4xl">{stats.total}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500 md:text-xs">
              {stats.total === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="sv-display text-3xl font-semibold text-stone-900 md:text-4xl">{stats.cidades}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500 md:text-xs">
              {stats.cidades === 1 ? 'cidade atendida' : 'cidades atendidas'}
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="sv-display text-3xl font-semibold text-stone-900 md:text-4xl">{stats.tipos}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500 md:text-xs">
              {stats.tipos === 1 ? 'tipo de imóvel' : 'tipos de imóveis'}
            </span>
          </div>
        </div>
      </section>

      {/* Categorias rápidas */}
      {quickCategories.length > 0 && (
        <section className="border-b border-stone-200/80 bg-[#fafaf8]">
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-12">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Atalhos</p>
                <h3 className="sv-display text-2xl text-stone-900 md:text-3xl">Encontre pelo tipo</h3>
              </div>
              {filters.tipo && (
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, tipo: '' }))}
                  className="text-xs font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-900"
                >
                  Limpar tipo
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickCategories.map(({ label, match, icon: Icon }) => {
                const matched = options.tipos.find((t) => t.toLowerCase().includes(match)) || '';
                const active = filters.tipo === matched;
                const count = properties.filter((p) => String(p.tipo_imovel || '').toLowerCase().includes(match)).length;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setFilters((f) => ({ ...f, tipo: active ? '' : matched }));
                      const el = document.getElementById('vitrine-results');
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`group flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-transparent text-[#090807] shadow-lg'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
                    }`}
                    style={active ? { backgroundColor: accent } : undefined}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        active ? 'bg-[#090807]/10' : 'bg-stone-100 group-hover:bg-stone-200'
                      }`}
                      style={active ? undefined : { color: accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className={`text-[11px] ${active ? 'text-[#090807]/70' : 'text-stone-500'}`}>
                        {count} {count === 1 ? 'opção' : 'opções'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Filtros avançados */}
      <section className="sticky top-[68px] z-40 border-y border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            {/* Cidade */}
            {options.cidades.length > 0 && (
              <div className="relative">
                <select
                  value={filters.cidade}
                  onChange={(e) => setFilters((f) => ({ ...f, cidade: e.target.value }))}
                  className="appearance-none rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-8 text-sm font-medium text-stone-800 shadow-sm focus:border-stone-400 focus:outline-none"
                >
                  <option value="">Todas as cidades</option>
                  {options.cidades.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              </div>
            )}

            {/* Tipo */}
            {options.tipos.length > 0 && (
              <div className="relative">
                <select
                  value={filters.tipo}
                  onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}
                  className="appearance-none rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-8 text-sm font-medium text-stone-800 shadow-sm focus:border-stone-400 focus:outline-none"
                >
                  <option value="">Todos os tipos</option>
                  {options.tipos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <BuildingIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              </div>
            )}

            {/* Quartos */}
            <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-2 py-1 shadow-sm">
              <Bed className="h-4 w-4 text-stone-500" />
              <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Quartos</span>
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, quartos: f.quartos === n ? null : n }))}
                  className={`ml-0.5 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                    filters.quartos === n ? 'text-[#090807]' : 'text-stone-500 hover:bg-stone-100'
                  }`}
                  style={filters.quartos === n ? { backgroundColor: accent } : undefined}
                >
                  {n === 4 ? '4+' : n}
                </button>
              ))}
            </div>

            {/* Mostrar/Ocultar filtros avançados */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showAdvanced ? 'Menos filtros' : 'Mais filtros'}
            </button>

            {/* Ordenar */}
            <div className="relative ml-auto">
              <select
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SortOrder }))}
                className="appearance-none rounded-xl border border-stone-200 bg-white py-2 pl-4 pr-8 text-sm font-medium text-stone-800 shadow-sm focus:border-stone-400 focus:outline-none"
              >
                <option value="recent">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="area_desc">Maior área</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            </div>
          </div>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Banheiros */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <Bath className="h-3.5 w-3.5" />
                  Banheiros
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, banheiros: f.banheiros === n ? null : n }))}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        filters.banheiros === n
                          ? 'border-transparent text-[#090807]'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                      }`}
                      style={filters.banheiros === n ? { backgroundColor: accent } : undefined}
                    >
                      {n === 3 ? '3+' : n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vagas */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <Car className="h-3.5 w-3.5" />
                  Vagas de garagem
                </label>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, garagem: f.garagem === n ? null : n }))}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        filters.garagem === n
                          ? 'border-transparent text-[#090807]'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                      }`}
                      style={filters.garagem === n ? { backgroundColor: accent } : undefined}
                    >
                      {n === 3 ? '3+' : n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preço mínimo */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Preço mínimo
                </label>
                <div className="flex items-center rounded-lg border border-stone-200 bg-white px-3 shadow-sm focus-within:border-stone-400">
                  <span className="text-sm text-stone-500">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={filters.priceMin}
                    onChange={(e) => setFilters((f) => ({ ...f, priceMin: formatMoneyInput(e.target.value) }))}
                    className="w-full bg-transparent py-2 pl-2 text-sm text-stone-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Preço máximo */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Preço máximo
                </label>
                <div className="flex items-center rounded-lg border border-stone-200 bg-white px-3 shadow-sm focus-within:border-stone-400">
                  <span className="text-sm text-stone-500">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Sem limite"
                    value={filters.priceMax}
                    onChange={(e) => setFilters((f) => ({ ...f, priceMax: formatMoneyInput(e.target.value) }))}
                    className="w-full bg-transparent py-2 pl-2 text-sm text-stone-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Chips de filtros ativos */}
          {hasAnyFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Filtros:</span>
              {activeFilterChips.map((chip, i) => (
                <button
                  key={`${String(chip.key)}-${i}`}
                  type="button"
                  onClick={chip.reset}
                  className="group flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-sm hover:border-stone-300 hover:text-stone-900"
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5 text-stone-400 group-hover:text-stone-700" />
                </button>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full px-3 py-1 text-xs font-semibold text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Resultados */}
      <main id="vitrine-results" className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-16">
        <div className="mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Portfólio</p>
            <h2 className="sv-display text-3xl text-stone-900 md:text-4xl">Imóveis em destaque</h2>
          </div>
          <span className="text-sm font-medium text-stone-500">
            {filteredProperties.length} imóvel{filteredProperties.length === 1 ? '' : 'e'}
            {hasAnyFilter ? <span className="text-stone-400"> (filtrado)</span> : null}
          </span>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="rounded-3xl border border-stone-200/80 bg-white py-24 text-center shadow-sm ring-1 ring-black/[0.03]">
            <BuildingIcon className="mx-auto mb-4 h-12 w-12 text-stone-300" />
            <h3 className="text-lg font-semibold text-stone-900">
              {hasAnyFilter ? 'Nenhum resultado para esses filtros' : 'Nenhum imóvel disponível no momento'}
            </h3>
            <p className="mt-2 text-stone-500">
              {hasAnyFilter
                ? 'Tente ajustar seus filtros ou clique em "Limpar tudo".'
                : 'Volte em breve para novidades.'}
            </p>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-[#090807] transition hover:brightness-110"
                style={{ backgroundColor: accent }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((prop) => {
              const lpSlug = lpSlugByPropertyId[prop.id];
              const TypeIcon = getTypeIcon(prop.tipo_imovel);

              const CardInner = (
                <>
                  <div className="relative aspect-[4/3] overflow-hidden bg-stone-200">
                    {prop.imagens && prop.imagens.length > 0 ? (
                      <img
                        src={prop.imagens[0] as string}
                        alt={prop.descricao || 'Imóvel'}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-400">Sem imagem</div>
                    )}
                    {vitrineModalidadeKey(prop.modalidade) && (
                      <div
                        className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#090807] shadow-md"
                        style={{ backgroundColor: accent }}
                      >
                        {vitrineModalidadeLabel(vitrineModalidadeKey(prop.modalidade))}
                      </div>
                    )}
                    {prop.tipo_imovel && (
                      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-[#090807]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                        <TypeIcon className="h-3 w-3" />
                        {prop.tipo_imovel}
                      </div>
                    )}
                    {lpSlug && (
                      <div className="absolute bottom-4 right-4 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                        Ver página
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-7">
                    <h3 className="sv-display text-xl font-semibold text-stone-900 line-clamp-2">
                      {prop.tipo_imovel || 'Imóvel'}
                    </h3>
                    <div className="mt-3 flex items-center gap-1.5 text-sm text-stone-500">
                      <MapPin className="h-4 w-4 shrink-0" style={{ color: accent }} />
                      <span className="truncate">
                        {prop.bairro || 'Bairro'}, {prop.cidade || 'Cidade'}
                      </span>
                    </div>

                    {/* Features rápidas */}
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-stone-600">
                      {typeof prop.quartos === 'number' && prop.quartos > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Bed className="h-4 w-4 text-stone-400" />
                          <strong className="font-semibold text-stone-800">{prop.quartos}</strong> quarto{prop.quartos === 1 ? '' : 's'}
                        </span>
                      )}
                      {typeof prop.banheiros === 'number' && prop.banheiros > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Bath className="h-4 w-4 text-stone-400" />
                          <strong className="font-semibold text-stone-800">{prop.banheiros}</strong> banheiro{prop.banheiros === 1 ? '' : 's'}
                        </span>
                      )}
                      {typeof prop.garagem === 'number' && prop.garagem > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Car className="h-4 w-4 text-stone-400" />
                          <strong className="font-semibold text-stone-800">{prop.garagem}</strong> vaga{prop.garagem === 1 ? '' : 's'}
                        </span>
                      )}
                      {typeof prop.tamanho_m2 === 'number' && prop.tamanho_m2 > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Ruler className="h-4 w-4 text-stone-400" />
                          <strong className="font-semibold text-stone-800">{prop.tamanho_m2}</strong> m²
                        </span>
                      )}
                    </div>

                    <div className="mt-6 border-t border-stone-100 pt-6">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Valor</p>
                      <p className="sv-display mt-1 text-2xl text-stone-900">
                        {prop.preco
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.preco)
                          : 'Sob consulta'}
                      </p>
                    </div>
                  </div>
                </>
              );

              const cardClass =
                'group flex flex-col overflow-hidden rounded-3xl border border-stone-200/90 bg-white text-left shadow-[0_24px_60px_-28px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.04] transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_64px_-24px_rgba(0,0,0,0.25)]';

              return lpSlug ? (
                <Link key={prop.id} to={`/imovel/${lpSlug}`} className={cardClass}>
                  {CardInner}
                </Link>
              ) : (
                <div key={prop.id} className={`${cardClass} opacity-[0.97]`}>
                  {CardInner}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Sobre */}
      {showSobreSection && (
        <section id="sobre" className="border-t border-stone-200/80 bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">{vx.about_kicker}</p>
              <h2 className="sv-display mt-2 text-3xl text-stone-900 md:text-4xl">
                {(vx.about_title || '').trim() ? vx.about_title : brandDisplay}
              </h2>
              {(vx.about_paragraph || '').trim() ? (
                <p className="mt-5 text-[15px] leading-7 text-stone-600">{vx.about_paragraph}</p>
              ) : website.description ? (
                <p className="mt-5 text-[15px] leading-7 text-stone-600">{website.description}</p>
              ) : null}
              <div className="mt-8 space-y-3 text-sm text-stone-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                  {vx.about_bullet1}
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                  {vx.about_bullet2}
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                  {vx.about_bullet3}
                </div>
              </div>
            </div>

            <div id="contato" className="rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">{vx.contact_kicker}</p>
              <h3 className="sv-display mt-2 text-2xl text-stone-900 md:text-3xl">{vx.contact_title}</h3>
              <p className="mt-3 text-sm text-stone-600">{vx.contact_intro}</p>
              <div className="mt-6 space-y-3">
                {companyRow?.phone && (
                  <a
                    href={whatsappLink || `tel:${phoneDigits}`}
                    target={whatsappLink ? '_blank' : undefined}
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm transition hover:border-stone-300 hover:shadow"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#25D366]">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">WhatsApp</p>
                      <p className="truncate font-medium">{companyRow.phone}</p>
                    </div>
                  </a>
                )}
                {companyRow?.email && (
                  <a
                    href={`mailto:${companyRow.email}`}
                    className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm transition hover:border-stone-300 hover:shadow"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100"
                      style={{ color: accent }}
                    >
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">E-mail</p>
                      <p className="truncate font-medium">{companyRow.email}</p>
                    </div>
                  </a>
                )}
                {igPublic && companyRow?.arroba_instagram_empresa && (
                  <a
                    href={`https://instagram.com/${instagramProfilePath(companyRow.arroba_instagram_empresa)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm transition hover:border-stone-300 hover:shadow"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
                      <Instagram className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Instagram</p>
                      <p className="truncate font-medium">
                        {instagramDisplayHandle(companyRow.arroba_instagram_empresa)}
                      </p>
                    </div>
                  </a>
                )}
                {companyRow?.phone && (
                  <a
                    href={`tel:${phoneDigits}`}
                    className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm transition hover:border-stone-300 hover:shadow"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100"
                      style={{ color: accent }}
                    >
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Telefone</p>
                      <p className="truncate font-medium">{companyRow.phone}</p>
                    </div>
                  </a>
                )}
                {companyRow?.address && (
                  <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-sm">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100"
                      style={{ color: accent }}
                    >
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Endereço</p>
                      <p className="truncate font-medium">{companyRow.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA WhatsApp flutuante */}
      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar no WhatsApp"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/40 transition hover:scale-105 hover:bg-[#1ebe5b] md:px-5 md:py-3.5"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Falar no WhatsApp</span>
        </a>
      )}

      <PublicImobiliariaFooter company={footerCompany} accentColor={accent} variant="dark" />
    </div>
  );
}
