import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { BuildingIcon, MapPin, Search, Sparkles, X } from 'lucide-react';
import { normalizeBrandDisplayName } from '@/lib/brandingDisplay';
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
};

type CompanyPublicRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  logo_url: string | null;
};

export default function SiteVitrine({ companySlug: propCompanySlug }: { companySlug?: string }) {
  const { companySlug: paramCompanySlug } = useParams<{ companySlug: string }>();
  const companySlug = propCompanySlug || paramCompanySlug;
  const [website, setWebsite] = useState<CompanyWebsite | null>(null);
  const [properties, setProperties] = useState<Imovel[]>([]);
  const [lpSlugByPropertyId, setLpSlugByPropertyId] = useState<Record<number, string>>({});
  const [companyRow, setCompanyRow] = useState<CompanyPublicRow | null>(null);
  const [settingsLogo, setSettingsLogo] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [query, setQuery] = useState('');
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
            .select('name, phone, email, address, cnpj, logo_url')
            .eq('id', webData.company_id)
            .maybeSingle(),
          supabase
            .from('company_settings' as never)
            .select('logo_url')
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

        const st = settingsRes.data as { logo_url?: string | null } | null;
        setSettingsLogo(st?.logo_url?.trim() || null);

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
  const siteDisplayTitle = normalizeBrandDisplayName(website.title) || website.title;
  const companyLegalName = companyRow?.name?.trim() || siteDisplayTitle;
  const brandDisplay = companyLegalName;
  const logoUrl = website.logo_url || settingsLogo || companyRow?.logo_url || null;

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

  const q = query.trim().toLowerCase();
  const filteredProperties = !q
    ? properties
    : properties.filter((p) => {
        const hay = [
          p.bairro,
          p.cidade,
          p.tipo_imovel,
          p.descricao,
          p.modalidade,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });

  return (
    <div
      className="min-h-screen bg-[#fafaf8] text-stone-800 antialiased selection:bg-stone-300/40"
      style={
        {
          '--sv-accent': accent,
        } as React.CSSProperties
      }
    >
      <style>{`
        .sv-display { font-family: "Playfair Display", Georgia, "Times New Roman", serif; }
      `}</style>

      {/* Top bar — logo + nome da imobiliária */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090807]/92 backdrop-blur-xl">
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
              <p className="truncate font-medium tracking-tight text-white md:text-lg">{brandDisplay}</p>
              <p className="truncate text-[10px] uppercase tracking-[0.22em] text-stone-500">Imóveis selecionados</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Sparkles className="h-4 w-4 opacity-50" style={{ color: accent }} />
            <span className="text-[11px] font-medium uppercase tracking-widest text-stone-500">Vitrine</span>
          </div>
        </div>
      </header>

      {/* Hero premium */}
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
        <div className="relative mx-auto max-w-4xl text-center">
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

          <div className="mx-auto mt-10 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 pl-4 shadow-inner backdrop-blur-md">
            <Search className="h-5 w-5 shrink-0 text-stone-500" />
            <input
              type="text"
              placeholder="Bairro ou cidade..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
              }}
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-stone-600 focus:outline-none"
              aria-label="Buscar"
            />
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery('')}
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

      <main id="vitrine-results" className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-16">
        <div className="mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Portfólio</p>
            <h2 className="sv-display text-3xl text-stone-900 md:text-4xl">Imóveis em destaque</h2>
          </div>
          <span className="text-sm font-medium text-stone-500">
            {filteredProperties.length} imóvel{filteredProperties.length === 1 ? '' : 'e'}
            {q ? <span className="text-stone-400"> (filtrado)</span> : null}
          </span>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="rounded-3xl border border-stone-200/80 bg-white py-24 text-center shadow-sm ring-1 ring-black/[0.03]">
            <BuildingIcon className="mx-auto mb-4 h-12 w-12 text-stone-300" />
            <h3 className="text-lg font-semibold text-stone-900">
              {q ? 'Nenhum resultado para a sua busca' : 'Nenhum imóvel disponível no momento'}
            </h3>
            <p className="mt-2 text-stone-500">
              {q ? 'Tente buscar por outro bairro, cidade ou tipo de imóvel.' : 'Volte em breve para novidades.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((prop) => {
              const lpSlug = lpSlugByPropertyId[prop.id];
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
                    {prop.modalidade && (
                      <div
                        className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#090807] shadow-md"
                        style={{ backgroundColor: accent }}
                      >
                        {prop.modalidade}
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

      <PublicImobiliariaFooter company={footerCompany} accentColor={accent} variant="dark" />
    </div>
  );
}
