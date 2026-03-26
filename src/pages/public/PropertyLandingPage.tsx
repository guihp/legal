import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Bed, Bath, Car, Maximize, MapPin, CheckCircle, ChevronLeft, ChevronRight, ArrowUpRight, Sparkles, X } from 'lucide-react';
import { convertGoogleDriveUrl, handleImageErrorWithFallback } from '@/utils/imageUtils';
import { cn } from '@/lib/utils';
import { normalizeBrandDisplayName } from '@/lib/brandingDisplay';
import { logPublicSiteVisit } from '@/lib/publicSiteVisit';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicImobiliariaFooter, type PublicFooterCompany } from '@/components/public/PublicImobiliariaFooter';

type Imovel = Database['public']['Tables']['imoveisvivareal']['Row'];

export type PropertyLandingPageConfig = {
  id: string;
  property_id: number;
  company_id: string;
  slug: string;
  is_published: boolean;
  views: number;
  custom_color: string | null;
  page_title?: string | null;
};

type CompanySiteInfo = {
  title: string;
  slug: string;
  theme_color: string | null;
  logo_url: string | null;
  title_color: string | null;
  hero_images: unknown | null;
};

type CompanyBranding = {
  displayName: string | null;
  logoUrl: string | null;
  displaySubtitle: string | null;
  primaryColor: string | null;
};

type CompanyPublicRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  logo_url: string | null;
};

function LpImg({
  src,
  alt,
  size,
  className,
  priority,
}: {
  src: string;
  alt: string;
  size: 'thumbnail' | 'medium' | 'full';
  className?: string;
  priority?: boolean;
}) {
  const url = convertGoogleDriveUrl(src, size);
  return (
    <img
      src={url || src}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      onError={(e) => handleImageErrorWithFallback(e, src, '')}
    />
  );
}

/** Logo oficial WhatsApp (monocromático; usa `currentColor`) */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.984-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      />
    </svg>
  );
}

function isGenericTipoLabel(t: string | null | undefined): boolean {
  if (!t || !t.trim()) return true;
  const s = t.trim();
  if (/^home$/i.test(s)) return true;
  if (/^casa$/i.test(s) && s.length <= 6) return true;
  if (/^apto\.?$/i.test(s)) return true;
  return false;
}

function resolvePublicHeadline(
  pageTitle: string | null | undefined,
  tipoImovel: string | null | undefined
): string | null {
  const pt = pageTitle?.trim();
  if (pt && !isGenericTipoLabel(pt)) return pt;
  const tipo = tipoImovel?.trim();
  if (tipo && !isGenericTipoLabel(tipo)) return tipo;
  return null;
}

function resolvePublicModalidadeLabel(modalidade: string | null | undefined): string {
  const m = (modalidade || '').trim();
  if (!m) return 'Destaque';
  const s = m.toLowerCase();
  if (s === 'for sale' || s === 'sale' || s === 'venda') return 'Venda';
  if (s === 'for rent' || s === 'rent' || s === 'aluguel' || s === 'locação' || s === 'locacao') return 'Aluguel';
  return m;
}

export default function PropertyLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lpConfig, setLpConfig] = useState<PropertyLandingPageConfig | null>(null);
  const [property, setProperty] = useState<Imovel | null>(null);
  const [related, setRelated] = useState<Imovel[]>([]);
  const [lpSlugByPropertyId, setLpSlugByPropertyId] = useState<Record<number, string>>({});
  const [companySite, setCompanySite] = useState<CompanySiteInfo | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>({
    displayName: null,
    logoUrl: null,
    displaySubtitle: null,
    primaryColor: null,
  });
  const [companyRow, setCompanyRow] = useState<CompanyPublicRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [heroIndex, setHeroIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const heroSectionRef = useRef<HTMLElement>(null);
  const visitLoggedRef = useRef(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    visitLoggedRef.current = false;
  }, [slug]);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        setLoading(true);
        const { data: lpData, error: lpError } = await supabase
          .from('property_landing_pages')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .single();

        if (lpError || !lpData) throw new Error('Página não encontrada ou desativada.');

        setLpConfig(lpData as unknown as PropertyLandingPageConfig);

        const { data: propData, error: propError } = await supabase
          .from('imoveisvivareal')
          .select('*')
          .eq('id', lpData.property_id)
          .single();

        if (propError || !propData) throw new Error('Detalhes do imóvel não encontrados.');

        setProperty(propData);
        setHeroIndex(0);

        supabase.rpc('increment_page_view', { page_id: lpData.id }).then().catch(() => {});
        if (!visitLoggedRef.current) {
          visitLoggedRef.current = true;
          void logPublicSiteVisit({ kind: 'landing', lpSlug: slug });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [slug]);

  useEffect(() => {
    if (!lpConfig || !property) return;
    let cancelled = false;

    (async () => {
      const companyId = lpConfig.company_id;

      const [othersRes, lpsRes, siteRes, settingsRes, companyRes] = await Promise.all([
        supabase
          .from('imoveisvivareal')
          .select('id, tipo_imovel, bairro, cidade, preco, imagens, disponibilidade, modalidade, created_at')
          .eq('company_id', companyId)
          .eq('disponibilidade', 'disponivel')
          .neq('id', property.id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('property_landing_pages' as 'property_landing_pages')
          .select('property_id, slug')
          .eq('company_id', companyId)
          .eq('is_published', true),
        supabase
          .from('company_websites' as 'company_websites')
          .select('title, slug, theme_color, logo_url, title_color, hero_images')
          .eq('company_id', companyId)
          .eq('is_published', true)
          .maybeSingle(),
        supabase
          .from('company_settings' as 'company_settings')
          .select('display_name, display_subtitle, logo_url, primary_color')
          .eq('company_id', companyId)
          .maybeSingle(),
        supabase
          .from('companies')
          .select('name, phone, email, address, cnpj, logo_url')
          .eq('id', companyId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      setRelated((othersRes.data as Imovel[]) || []);

      const map: Record<number, string> = {};
      const lpRows = lpsRes.data as { property_id: number; slug: string }[] | null;
      if (lpRows) {
        for (const row of lpRows) {
          if (row?.property_id != null && row.slug) map[row.property_id] = row.slug;
        }
      }
      setLpSlugByPropertyId(map);

      const site = siteRes.data as CompanySiteInfo | null;
      setCompanySite(site && site.title ? site : null);

      const st = settingsRes.data as {
        display_name?: string;
        display_subtitle?: string;
        logo_url?: string;
        primary_color?: string;
      } | null;

      setCompanyRow((companyRes.data as CompanyPublicRow) || null);

      setBranding({
        displayName: st?.display_name?.trim() || null,
        logoUrl: st?.logo_url?.trim() || null,
        displaySubtitle: st?.display_subtitle?.trim() || null,
        primaryColor: st?.primary_color?.trim() || null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [lpConfig?.id, property?.id, lpConfig?.company_id]);

  const images = useMemo(() => {
    const raw = property?.imagens;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.filter(Boolean) as string[];
  }, [property?.imagens]);

  const openLightbox = (index: number) => {
    if (!images.length) return;
    setLightboxIndex(Math.max(0, Math.min(index, images.length - 1)));
    setLightboxOpen(true);
  };

  const lightboxNext = useCallback(() => {
    if (images.length <= 1) return;
    setLightboxIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const lightboxPrev = useCallback(() => {
    if (images.length <= 1) return;
    setLightboxIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') lightboxNext();
      if (e.key === 'ArrowLeft') lightboxPrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, lightboxNext, lightboxPrev]);

  const heroNext = useCallback(() => {
    if (images.length <= 1) return;
    setHeroIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const heroPrev = useCallback(() => {
    if (images.length <= 1) return;
    setHeroIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1 || carouselPaused) return;
    const id = window.setInterval(heroNext, 6000);
    return () => window.clearInterval(id);
  }, [images.length, carouselPaused, heroNext]);

  useEffect(() => {
    if (!lpConfig || !property) return;
    const headline = resolvePublicHeadline(lpConfig.page_title, property.tipo_imovel);
    const loc = [property.bairro, property.cidade].filter(Boolean).join(', ');
    const base = headline || loc || 'Imóvel';
    document.title = loc && headline ? `${headline} — ${loc}` : base;
    return () => {
      document.title = 'IAFÉ IMOBI';
    };
  }, [lpConfig, property]);

  const openWhatsApp = () => {
    const loc = [property?.bairro, property?.cidade].filter(Boolean).join(', ');
    const ref = property?.listing_id ? ` Ref. ${property.listing_id}` : '';
    const msg = `Olá! Vi o imóvel na página de vocês${ref ? ` (${ref})` : ''}${loc ? ` — ${loc}` : ''}. Podem me ajudar?`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090807] text-stone-300">
        <div className="mb-8 h-px w-24 bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-stone-700 border-t-amber-200/70" />
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.28em]">Carregando</p>
      </div>
    );
  }

  if (error || !property || !lpConfig) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090807] p-6 text-center">
        <h1 className="lp-serif mb-3 text-3xl text-stone-100">Indisponível</h1>
        <p className="max-w-md text-stone-500">{error || 'Página indisponível'}</p>
      </div>
    );
  }

  const primary =
    companySite?.theme_color ||
    branding.primaryColor ||
    '#b8955e';

  const titleColor = companySite?.title_color?.trim() || '#FFFFFF';
  const priceFormatted = property.preco
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.preco)
    : 'Sob consulta';

  const locationLine = [property.bairro, property.cidade].filter(Boolean).join(' · ') || 'Localização sob consulta';
  const headline = resolvePublicHeadline(lpConfig.page_title, property.tipo_imovel);

  const brandName =
    companyRow?.name?.trim() ||
    normalizeBrandDisplayName(branding.displayName?.trim() || companySite?.title?.trim() || '') ||
    'Imobiliária';

  const headerSubtitle =
    branding.displaySubtitle ||
    (companySite?.title && companySite.title.trim() !== brandName
      ? `Vitrine ${normalizeBrandDisplayName(companySite.title) || companySite.title}`
      : null) ||
    'Imóvel exclusivo';

  const headerLogoUrl = companySite?.logo_url || branding.logoUrl || companyRow?.logo_url || null;

  const footerCompany: PublicFooterCompany = {
    legalName: brandName,
    displayName: brandName,
    logoUrl: headerLogoUrl,
    phone: companyRow?.phone ?? null,
    email: companyRow?.email ?? null,
    address: companyRow?.address ?? null,
    cnpj: companyRow?.cnpj ?? null,
    vitrineSlug: companySite?.slug ?? null,
  };

  return (
    <div
      className="min-h-screen bg-[#fafaf8] text-stone-800 antialiased selection:bg-stone-300/40"
      style={
        {
          '--lp-accent': primary,
          fontFamily: '"Inter", system-ui, sans-serif',
        } as React.CSSProperties
      }
    >
      <style>{`
        .lp-serif { font-family: "Playfair Display", "Times New Roman", serif; }
      `}</style>

      {/* Header — mesmo padrão da vitrine */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090807]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {headerLogoUrl ? (
              <img
                src={headerLogoUrl}
                alt=""
                className="h-9 w-auto max-w-[150px] object-contain md:h-11"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#090807] shadow-sm"
                style={{ backgroundColor: primary }}
              >
                {brandName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium tracking-tight text-white md:text-lg">{brandName}</p>
              <p className="truncate text-[10px] uppercase tracking-[0.2em] text-stone-500 md:text-[11px]">
                {headerSubtitle}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Sparkles className="h-4 w-4 opacity-50" style={{ color: primary }} />
            {companySite?.slug ? (
              <Link
                to={`/s/${companySite.slug}`}
                className="text-[11px] font-medium uppercase tracking-widest text-stone-500 transition hover:text-stone-300"
              >
                Vitrine
              </Link>
            ) : (
              <span className="text-[11px] font-medium uppercase tracking-widest text-stone-500">Landing</span>
            )}
          </div>
        </div>
      </header>

      {/* Hero — carrossel full-bleed, sem galeria longa abaixo */}
      <section
        ref={heroSectionRef}
        className="relative h-[min(88vh,880px)] w-full overflow-hidden bg-[#090807]"
        onMouseEnter={() => setCarouselPaused(true)}
        onMouseLeave={() => setCarouselPaused(false)}
      >
        <AnimatePresence mode="wait">
          {images.length > 0 && images[heroIndex] ? (
            <motion.div
              key={heroIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute inset-0"
              onClick={() => openLightbox(heroIndex)}
              role="button"
              aria-label="Abrir fotos em tela cheia"
            >
              <LpImg
                src={images[heroIndex]}
                alt=""
                size="full"
                priority
                className="h-full w-full cursor-zoom-in object-cover"
              />
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900 text-stone-600">
              Sem fotos
            </div>
          )}
        </AnimatePresence>

        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: `linear-gradient(to top, #090807 0%, rgba(9,8,7,0.72) 45%, rgba(9,8,7,0.35) 100%), radial-gradient(ellipse 90% 55% at 50% -15%, ${primary}2a, transparent 55%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#090807]/95 via-transparent to-[#090807]/55" />

        {/* Setas carrossel */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={heroPrev}
              className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white shadow-lg shadow-black/30 backdrop-blur-md transition hover:bg-white/20 md:left-6 md:h-14 md:w-14"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-7 w-7 md:h-8 md:w-8" />
            </button>
            <button
              type="button"
              onClick={heroNext}
              className="absolute right-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white shadow-lg shadow-black/30 backdrop-blur-md transition hover:bg-white/20 md:right-6 md:h-14 md:w-14"
              aria-label="Próxima foto"
            >
              <ChevronRight className="h-7 w-7 md:h-8 md:w-8" />
            </button>
          </>
        )}

        {/* Indicadores */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2 px-4 md:bottom-6">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setHeroIndex(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === heroIndex ? 'w-8 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/60'
                )}
                aria-label={`Foto ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Conteúdo — preço sempre visível (card) + título sem "Home" */}
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col px-4 pb-8 pt-8 md:px-8 md:pb-10 md:pt-10">
          <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <span
              className="inline-flex w-fit items-center rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] shadow-sm backdrop-blur-md"
              style={{
                borderColor: `${primary}55`,
                background: `linear-gradient(90deg, ${primary}22, rgba(0,0,0,0.35))`,
                color: '#ffffff',
              }}
            >
              {resolvePublicModalidadeLabel(property.modalidade)}
            </span>

            <div className="rounded-2xl border border-white/15 bg-black/50 px-5 py-4 text-left shadow-2xl backdrop-blur-xl sm:min-w-[200px] sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-stone-400">Investimento</p>
              <p className="lp-serif mt-1 text-2xl font-medium text-white md:text-3xl">{priceFormatted}</p>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-5 pb-10 md:pb-12">
            {headline ? (
              <h1
                className="lp-serif max-w-4xl text-2xl font-semibold leading-[1.12] md:text-3xl lg:text-4xl"
                style={{ color: titleColor, textShadow: '0 10px 30px rgba(0,0,0,0.55)' }}
              >
                <span className="inline-block rounded-xl bg-black/25 px-3 py-2 backdrop-blur-md">
                  {headline}
                </span>
              </h1>
            ) : (
              <h1
                className="lp-serif max-w-4xl text-2xl font-semibold leading-[1.12] md:text-3xl lg:text-4xl"
                style={{ color: titleColor, textShadow: '0 10px 30px rgba(0,0,0,0.55)' }}
              >
                <span className="inline-block rounded-xl bg-black/25 px-3 py-2 backdrop-blur-md">
                  {locationLine}
                </span>
              </h1>
            )}

            {headline && (
              <p className="flex max-w-2xl items-center gap-2 text-base text-stone-300 md:text-lg">
                <MapPin className="h-5 w-5 shrink-0" style={{ color: primary }} />
                {locationLine}
              </p>
            )}

            <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex-1" />
              <button
                type="button"
                onClick={openWhatsApp}
                className="ml-auto inline-flex w-full max-w-[260px] items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/25 transition hover:bg-[#20bd5a] sm:text-base"
              >
                <WhatsAppGlyph className="h-7 w-7 text-white" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>

      {lightboxOpen && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] bg-black/90"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute right-2 top-2 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition hover:bg-white/20"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={lightboxPrev}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={lightboxNext}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition hover:bg-white/20"
                    aria-label="Próxima"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl">
                <LpImg
                  src={images[lightboxIndex]}
                  alt=""
                  size="full"
                  priority
                  className="max-h-[82vh] w-full object-contain"
                />
              </div>

              {images.length > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className={i === lightboxIndex ? 'h-2 w-8 rounded-full bg-white' : 'h-2 w-2 rounded-full bg-white/40'}
                      aria-label={`Foto ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Corpo — stats + texto; lateral só WhatsApp */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-12 lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-stone-200/90 shadow-sm ring-1 ring-stone-200/80 md:grid-cols-4"
            >
              {[
                { icon: Maximize, label: 'Área m²', val: property.tamanho_m2 ?? '—' },
                { icon: Bed, label: 'Quartos', val: property.quartos ?? '—' },
                { icon: Bath, label: 'Banheiros', val: property.banheiros ?? '—' },
                { icon: Car, label: 'Vagas', val: property.garagem ?? '—' },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="flex flex-col items-center bg-white px-4 py-8 text-center">
                  <Icon className="mb-3 h-6 w-6" style={{ color: `${primary}aa` }} />
                  <span className="lp-serif text-2xl font-medium text-stone-900">{val}</span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    {label}
                  </span>
                </div>
              ))}
            </motion.div>

            <section
              className="rounded-2xl border border-stone-200/90 border-l-[4px] bg-white p-8 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.08)] ring-1 ring-stone-100 md:p-10"
              style={{ borderLeftColor: primary }}
            >
              <h2 className="lp-serif text-2xl text-stone-900 md:text-3xl">Sobre o imóvel</h2>
              <div className="prose prose-stone mt-6 max-w-none whitespace-pre-wrap text-base leading-relaxed text-stone-600">
                {property.descricao ||
                  'Entre em contato pelo WhatsApp para receber a ficha completa e agendar visita.'}
              </div>
            </section>

            {property.features && property.features.length > 0 && (
              <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200/80 md:p-10">
                <h2 className="lp-serif text-2xl text-stone-900 md:text-3xl">Diferenciais</h2>
                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {property.features.map((feat, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/80 px-4 py-3 text-stone-700"
                    >
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} />
                      <span className="text-sm font-medium leading-snug">{feat}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-stone-200/90 bg-white p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] ring-1 ring-stone-100">
                <div
                  className="mb-5 h-1 w-14 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }}
                />
                <h3 className="lp-serif text-xl text-stone-900 md:text-2xl">Próximo passo</h3>
                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                  Fale direto com a equipe pelo WhatsApp. Resposta rápida e atendimento personalizado.
                </p>
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#25D366] py-4 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#20bd5a]"
                >
                  <WhatsAppGlyph className="h-7 w-7 text-white" />
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-t border-stone-200/90 bg-gradient-to-b from-white to-[#f5f4f1] py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Portfólio</p>
                <h2 className="lp-serif text-3xl text-stone-900 md:text-4xl">Outras oportunidades</h2>
              </div>
              {companySite?.slug && (
                <Link
                  to={`/s/${companySite.slug}`}
                  className="inline-flex items-center gap-1 text-sm font-medium transition hover:opacity-80"
                  style={{ color: primary }}
                >
                  Ver site completo
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => {
                const lp = lpSlugByPropertyId[item.id];
                const thumb = item.imagens?.[0];
                const card = (
                  <>
                    <div className="relative aspect-[4/3] overflow-hidden bg-stone-200">
                      {thumb ? (
                        <LpImg
                          src={thumb}
                          alt=""
                          size="medium"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-stone-400">Sem foto</div>
                      )}
                      {item.modalidade && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-800 shadow-sm">
                          {resolvePublicModalidadeLabel(item.modalidade)}
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="line-clamp-2 font-semibold text-stone-900">
                        {isGenericTipoLabel(item.tipo_imovel) ? item.cidade || 'Imóvel' : item.tipo_imovel}
                      </h3>
                      <p className="mt-2 flex items-center gap-1 text-xs text-stone-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {[item.bairro, item.cidade].filter(Boolean).join(', ') || '—'}
                        </span>
                      </p>
                      <p className="lp-serif mt-3 text-lg font-medium text-stone-900">
                        {item.preco
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              item.preco
                            )
                          : 'Consulte'}
                      </p>
                      {lp ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-stone-600 group-hover:underline">
                          Ver página
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="mt-3 block text-[11px] text-stone-400">Consulte disponibilidade</span>
                      )}
                    </div>
                  </>
                );

                return lp ? (
                  <Link
                    key={item.id}
                    to={`/imovel/${lp}`}
                    className="group overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-50/50 text-left shadow-sm transition hover:border-stone-300 hover:shadow-md"
                  >
                    {card}
                  </Link>
                ) : (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-50/30 text-left opacity-95"
                  >
                    {card}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <PublicImobiliariaFooter company={footerCompany} accentColor={primary} variant="dark" />
    </div>
  );
}
