import { useEffect, useMemo, useRef, useState } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { slugifyForUrl } from '@/lib/slugify';
import { toast } from 'sonner';
import { mergeVitrineExtras, parseVitrineExtras } from '@/lib/vitrineSiteExtras';
import { startOfDay, subDays } from 'date-fns';
import { SiteVitrineTopBar } from '@/components/site-vitrine/SiteVitrineTopBar';
import { SiteVitrineToolbar } from '@/components/site-vitrine/SiteVitrineToolbar';
import { SiteVitrineHowItWorks } from '@/components/site-vitrine/SiteVitrineHowItWorks';
import { SiteVitrineSectionNav } from '@/components/site-vitrine/SiteVitrineSectionNav';
import { SiteVitrineIdentityCard } from '@/components/site-vitrine/SiteVitrineIdentityCard';
import { SiteVitrineAppearanceCard } from '@/components/site-vitrine/SiteVitrineAppearanceCard';
import { SiteVitrineTextsCard } from '@/components/site-vitrine/SiteVitrineTextsCard';
import { SiteVitrineAssetsCard } from '@/components/site-vitrine/SiteVitrineAssetsCard';
import { SiteVitrineTrackingCard } from '@/components/site-vitrine/SiteVitrineTrackingCard';
import { SiteVitrinePreview } from '@/components/site-vitrine/SiteVitrinePreview';
import { SiteVitrineChecklist } from '@/components/site-vitrine/SiteVitrineChecklist';
import { SiteVitrineStatusCard } from '@/components/site-vitrine/SiteVitrineStatusCard';
import {
  buildChecklist,
  fillPercent,
  formatBrl,
  publicSitePath,
  publicSiteUrl,
  restoreAppearanceDefaults,
  sectionCounts,
  type FillSnapshot,
  type PreviewProperty,
  type VitrineSectionId,
} from '@/components/site-vitrine/helpers';

type VitrineExtrasForm = ReturnType<typeof mergeVitrineExtras>;

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
  updated_at?: string | null;
};

type MarketingSection = 'website';

const COMPANY_ASSETS_BUCKET = 'company-assets';
const LOGO_MAX_MB = 2;
const HERO_MAX_MB = 5;

function bytesFromMb(mb: number): number {
  return mb * 1024 * 1024;
}

async function ensureUniqueWebsiteSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  for (let n = 0; n < 24; n++) {
    const { data } = await supabase
      .from('company_websites' as never)
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    const row = data as { id: string } | null;
    if (!row || row.id === excludeId) return candidate;
    candidate = `${base}-${n + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function MarketingView({ section: _section = 'website' }: { section?: MarketingSection }) {
  const { profile } = useUserProfile();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const defaultsAppliedRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const hero1InputRef = useRef<HTMLInputElement | null>(null);
  const hero2InputRef = useRef<HTMLInputElement | null>(null);
  const hero3InputRef = useRef<HTMLInputElement | null>(null);
  const [website, setWebsite] = useState<CompanyWebsite | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [themeColor, setThemeColor] = useState('#f7612a');
  const [titleColor, setTitleColor] = useState('#f7f7f7');
  const [isPublished, setIsPublished] = useState(false);
  const [pixel, setPixel] = useState('');
  const [analytics, setAnalytics] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImage1, setHeroImage1] = useState('');
  const [heroImage2, setHeroImage2] = useState('');
  const [heroImage3, setHeroImage3] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState<1 | 2 | 3 | null>(null);
  const [extrasForm, setExtrasForm] = useState<VitrineExtrasForm>(() => mergeVitrineExtras({}));
  const [settingsFontHint, setSettingsFontHint] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<VitrineSectionId>('identidade');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [verifyingSlug, setVerifyingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'ok' | 'taken' | 'invalid'>('idle');
  const [previewProperties, setPreviewProperties] = useState<PreviewProperty[]>([]);
  const [visits30d, setVisits30d] = useState<number | null>(null);
  const [leadsFromSite, setLeadsFromSite] = useState<number | null>(null);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    async function loadCompanyName() {
      if (!profile?.company_id) return;
      const { data, error } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .maybeSingle();
      if (!error && data?.name) setCompanyName(data.name.trim());
    }
    loadCompanyName();
  }, [profile?.company_id]);

  useEffect(() => {
    defaultsAppliedRef.current = false;
  }, [profile?.company_id]);

  useEffect(() => {
    async function loadFontHint() {
      if (!profile?.company_id) return;
      const { data } = await supabase
        .from('company_settings')
        .select('company_name_font_family')
        .eq('company_id', profile.company_id)
        .maybeSingle();
      const row = data as { company_name_font_family?: string | null } | null;
      setSettingsFontHint(row?.company_name_font_family?.trim() || 'Inter');
    }
    loadFontHint();
  }, [profile?.company_id]);

  useEffect(() => {
    async function loadWebsite() {
      if (!profile?.company_id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('company_websites')
          .select('*')
          .eq('company_id', profile.company_id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const row = data as unknown as CompanyWebsite;
          setWebsite(row);
          setSlug(row.slug || '');
          setTitle(row.title || '');
          setDescription(row.description || '');
          setThemeColor(row.theme_color || '#f7612a');
          setTitleColor(row.title_color || '#f7f7f7');
          setIsPublished(row.is_published || false);
          setPixel(row.pixel_facebook || '');
          setAnalytics(row.analytics_google || '');
          setLogoUrl(row.logo_url || '');
          const imgs = Array.isArray(row.hero_images) ? row.hero_images : [];
          setHeroImage1((imgs[0] as string) || '');
          setHeroImage2((imgs[1] as string) || '');
          setHeroImage3((imgs[2] as string) || '');
          setExtrasForm(mergeVitrineExtras(parseVitrineExtras(row.vitrine_extras)));
          defaultsAppliedRef.current = true;
        } else if (companyName && !defaultsAppliedRef.current) {
          const base = slugifyForUrl(companyName);
          const unique = await ensureUniqueWebsiteSlug(base);
          setTitle(companyName);
          setSlug(unique);
          setTitleColor('#f7f7f7');
          setThemeColor('#f7612a');
          setExtrasForm(mergeVitrineExtras({}));
          defaultsAppliedRef.current = true;
        }
      } catch {
        toast.error('Erro ao carregar configurações do site.');
      } finally {
        setLoading(false);
      }
    }
    loadWebsite();
  }, [profile?.company_id, companyName]);

  useEffect(() => {
    async function loadSidebarStats() {
      if (!profile?.company_id) return;
      const companyId = profile.company_id;
      const from30 = startOfDay(subDays(new Date(), 29)).toISOString();

      const [visitsRes, leadsRes, availRes, totalRes, previewRes] = await Promise.all([
        supabase
          .from('public_site_visits' as never)
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', from30),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .or('source.ilike.%site%,source.ilike.%website%,source.ilike.%vitrine%'),
        supabase
          .from('imoveisvivareal')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('disponibilidade', 'disponivel'),
        supabase
          .from('imoveisvivareal')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId),
        supabase
          .from('imoveisvivareal')
          .select('id, tipo_imovel, bairro, cidade, tamanho_m2, preco, imagens')
          .eq('company_id', companyId)
          .eq('disponibilidade', 'disponivel')
          .order('created_at', { ascending: false })
          .limit(2),
      ]);

      setVisits30d(visitsRes.count ?? 0);
      setLeadsFromSite(leadsRes.error ? null : (leadsRes.count ?? 0));
      setPublishedCount(availRes.count ?? 0);
      setTotalCount(totalRes.count ?? 0);

      if (!previewRes.error && Array.isArray(previewRes.data)) {
        setPreviewProperties(
          previewRes.data.map((p: any) => {
            const type = String(p.tipo_imovel || 'Imóvel').trim();
            const place = [p.bairro, p.cidade].filter(Boolean).join(', ');
            const area =
              typeof p.tamanho_m2 === 'number' && p.tamanho_m2 > 0
                ? `${p.tamanho_m2} m²`
                : '';
            const title = [type, place || area].filter(Boolean).join(' · ') || 'Imóvel';
            return {
              id: p.id,
              title,
              priceLabel: formatBrl(typeof p.preco === 'number' ? p.preco : null),
              imageUrl: Array.isArray(p.imagens) && p.imagens[0] ? String(p.imagens[0]) : null,
            };
          }),
        );
      }
    }
    loadSidebarStats();
  }, [profile?.company_id]);

  const markDirty = () => setDirty(true);

  const handleSaveWebsite = async () => {
    if (!profile?.company_id) return;
    if (!slug || !title) {
      toast.error('Slug e Título são obrigatórios.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error('O link deve conter apenas letras minúsculas, números e hifens.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: profile.company_id,
        slug,
        title,
        description,
        theme_color: themeColor,
        title_color: titleColor,
        is_published: isPublished,
        pixel_facebook: pixel,
        analytics_google: analytics,
        logo_url: logoUrl.trim() || null,
        hero_images: [heroImage1, heroImage2, heroImage3].map((s) => s.trim()).filter(Boolean),
        vitrine_extras: extrasForm as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };

      if (website?.id) {
        const { error } = await supabase
          .from('company_websites')
          .update(payload)
          .eq('id', website.id);
        if (error) throw error;
        toast.success('Site atualizado com sucesso!');
        setWebsite({ ...website, ...payload } as unknown as CompanyWebsite);
      } else {
        const { data, error } = await supabase
          .from('company_websites')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setWebsite(data as unknown as CompanyWebsite);
        toast.success('Site criado com sucesso!');
      }
      setDirty(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar o site. Verifique se o link já está em uso.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (
    file: File,
    kind: 'logo' | 'hero',
    slot?: 1 | 2 | 3,
  ): Promise<string | null> => {
    if (!profile?.company_id) return null;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WEBP.');
      return null;
    }

    const maxBytes = kind === 'logo' ? bytesFromMb(LOGO_MAX_MB) : bytesFromMb(HERO_MAX_MB);
    if (file.size > maxBytes) {
      toast.error(`Arquivo muito grande. Máximo ${kind === 'logo' ? LOGO_MAX_MB : HERO_MAX_MB}MB.`);
      return null;
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const prefix = kind === 'logo' ? 'website-logo' : `website-hero-${slot ?? 1}`;
    const path = `${profile.company_id}/${prefix}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from(COMPANY_ASSETS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast.error(error.message || 'Erro ao enviar imagem.');
      return null;
    }

    const { data } = supabase.storage.from(COMPANY_ASSETS_BUCKET).getPublicUrl(path);
    const url = data?.publicUrl || null;
    if (!url) return null;
    if (url.includes('/storage/v1/object/') && !url.includes('/storage/v1/object/public/')) {
      return url.replace('/storage/v1/object/', '/storage/v1/object/public/');
    }
    return url;
  };

  const onLogoFileChange = async (file?: File) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadAsset(file, 'logo');
      if (url) {
        setLogoUrl(url);
        markDirty();
        toast.success('Logo enviada. Clique em "Salvar e publicar" para aplicar.');
      }
    } finally {
      setUploadingLogo(false);
    }
  };

  const onHeroFileChange = async (slot: 1 | 2 | 3, file?: File) => {
    if (!file) return;
    setUploadingHero(slot);
    try {
      const url = await uploadAsset(file, 'hero', slot);
      if (!url) return;
      if (slot === 1) setHeroImage1(url);
      if (slot === 2) setHeroImage2(url);
      if (slot === 3) setHeroImage3(url);
      markDirty();
      toast.success(`Capa ${slot} enviada. Clique em "Salvar e publicar" para aplicar.`);
    } finally {
      setUploadingHero(null);
    }
  };

  const clearLogo = () => {
    setLogoUrl('');
    markDirty();
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const clearHero = (slot: 1 | 2 | 3) => {
    if (slot === 1) {
      setHeroImage1('');
      if (hero1InputRef.current) hero1InputRef.current.value = '';
    }
    if (slot === 2) {
      setHeroImage2('');
      if (hero2InputRef.current) hero2InputRef.current.value = '';
    }
    if (slot === 3) {
      setHeroImage3('');
      if (hero3InputRef.current) hero3InputRef.current.value = '';
    }
    markDirty();
  };

  const verifySlug = async () => {
    if (!slug) return;
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugStatus('invalid');
      return;
    }
    setVerifyingSlug(true);
    setSlugStatus('idle');
    try {
      const { data } = await supabase
        .from('company_websites' as never)
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      const row = data as { id: string } | null;
      if (!row || row.id === website?.id) {
        setSlugStatus('ok');
        toast.success('Link disponível.');
      } else {
        setSlugStatus('taken');
        toast.error('Este link já está em uso.');
      }
    } catch {
      toast.error('Não foi possível verificar o link.');
    } finally {
      setVerifyingSlug(false);
    }
  };

  const copyLink = async () => {
    if (!slug) return;
    const full = `https://${publicSiteUrl(slug)}`;
    try {
      await navigator.clipboard.writeText(full);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const openSite = () => {
    if (!slug) return;
    window.open(publicSitePath(slug), '_blank');
  };

  const scrollToSection = (id: VitrineSectionId) => {
    setActiveSection(id);
    const el = document.getElementById(`sv-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fillSnap: FillSnapshot = useMemo(
    () => ({
      title,
      slug,
      description,
      themeColor,
      titleColor,
      headerBg: extrasForm.header_bg,
      headerFg: extrasForm.header_fg,
      headerMuted: extrasForm.header_muted,
      headerTagline: extrasForm.header_tagline,
      aboutKicker: extrasForm.about_kicker,
      aboutTitle: extrasForm.about_title,
      aboutParagraph: extrasForm.about_paragraph,
      aboutBullet1: extrasForm.about_bullet1,
      aboutBullet2: extrasForm.about_bullet2,
      aboutBullet3: extrasForm.about_bullet3,
      contactKicker: extrasForm.contact_kicker,
      contactTitle: extrasForm.contact_title,
      contactIntro: extrasForm.contact_intro,
      logoUrl,
      hero1: heroImage1,
      hero2: heroImage2,
      hero3: heroImage3,
      pixel,
      analytics,
    }),
    [
      title,
      slug,
      description,
      themeColor,
      titleColor,
      extrasForm,
      logoUrl,
      heroImage1,
      heroImage2,
      heroImage3,
      pixel,
      analytics,
    ],
  );

  const counts = useMemo(() => sectionCounts(fillSnap), [fillSnap]);
  const percent = useMemo(() => fillPercent(fillSnap), [fillSnap]);
  const checklist = useMemo(() => buildChecklist(fillSnap), [fillSnap]);

  useEffect(() => {
    const ids: VitrineSectionId[] = [
      'identidade',
      'aparencia',
      'textos',
      'assets',
      'rastreamento',
    ];
    const observers: IntersectionObserver[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target?.id) return;
        const key = visible.target.id.replace('sv-', '') as VitrineSectionId;
        if (ids.includes(key)) setActiveSection(key);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    );
    for (const id of ids) {
      const el = document.getElementById(`sv-${id}`);
      if (el) io.observe(el);
    }
    observers.push(io);
    return () => observers.forEach((o) => o.disconnect());
  }, [loading]);

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70 bg-[#F7F5F0]/90 dark:bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-3">
          <SiteVitrineTopBar />
          <SiteVitrineToolbar
            isPublished={isPublished}
            slug={slug}
            updatedAt={website?.updated_at}
            dirty={dirty}
            saving={saving}
            uploading={uploadingLogo || uploadingHero !== null}
            onCopyLink={copyLink}
            onOpenSite={openSite}
            onSave={handleSaveWebsite}
          />
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <SiteVitrineHowItWorks />
        <SiteVitrineSectionNav
          active={activeSection}
          counts={counts}
          fillPercent={percent}
          onSelect={scrollToSection}
        />

        {loading ? (
          <div className="rounded-2xl border border-border/70 bg-card p-10 text-center text-muted-foreground shadow-sm">
            Carregando configurações…
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-4 lg:gap-5 items-start">
            <div className="space-y-4 min-w-0">
              <SiteVitrineIdentityCard
                title={title}
                slug={slug}
                description={description}
                verifying={verifyingSlug}
                slugStatus={slugStatus}
                onTitleChange={(v) => {
                  setTitle(v);
                  markDirty();
                }}
                onSlugChange={(v) => {
                  setSlug(v);
                  setSlugStatus('idle');
                  markDirty();
                }}
                onDescriptionChange={(v) => {
                  setDescription(v);
                  markDirty();
                }}
                onVerifySlug={verifySlug}
              />

              <SiteVitrineAppearanceCard
                themeColor={themeColor}
                titleColor={titleColor}
                headerBg={extrasForm.header_bg}
                headerFg={extrasForm.header_fg}
                headerMuted={extrasForm.header_muted}
                headerTagline={extrasForm.header_tagline}
                useCompanyFont={extrasForm.use_company_display_font}
                settingsFontHint={settingsFontHint}
                onThemeColor={(v) => {
                  setThemeColor(v);
                  markDirty();
                }}
                onTitleColor={(v) => {
                  setTitleColor(v);
                  markDirty();
                }}
                onHeaderBg={(v) => {
                  setExtrasForm({ ...extrasForm, header_bg: v });
                  markDirty();
                }}
                onHeaderFg={(v) => {
                  setExtrasForm({ ...extrasForm, header_fg: v });
                  markDirty();
                }}
                onHeaderMuted={(v) => {
                  setExtrasForm({ ...extrasForm, header_muted: v });
                  markDirty();
                }}
                onHeaderTagline={(v) => {
                  setExtrasForm({ ...extrasForm, header_tagline: v });
                  markDirty();
                }}
                onUseCompanyFont={(v) => {
                  setExtrasForm({ ...extrasForm, use_company_display_font: v });
                  markDirty();
                }}
                onRestoreDefaults={() => {
                  const d = restoreAppearanceDefaults();
                  setThemeColor(d.themeColor);
                  setTitleColor(d.titleColor);
                  setExtrasForm({
                    ...extrasForm,
                    header_bg: d.header_bg,
                    header_fg: d.header_fg,
                    header_muted: d.header_muted,
                    header_tagline: d.header_tagline,
                    use_company_display_font: d.use_company_display_font,
                  });
                  markDirty();
                }}
              />

              <SiteVitrineTextsCard
                aboutKicker={extrasForm.about_kicker}
                aboutTitle={extrasForm.about_title}
                aboutParagraph={extrasForm.about_paragraph}
                aboutBullet1={extrasForm.about_bullet1}
                aboutBullet2={extrasForm.about_bullet2}
                aboutBullet3={extrasForm.about_bullet3}
                contactKicker={extrasForm.contact_kicker}
                contactTitle={extrasForm.contact_title}
                contactIntro={extrasForm.contact_intro}
                onChange={(patch) => {
                  setExtrasForm({ ...extrasForm, ...patch });
                  markDirty();
                }}
              />

              <SiteVitrineAssetsCard
                logoUrl={logoUrl}
                logoInputRef={logoInputRef}
                uploadingLogo={uploadingLogo}
                uploadingHero={uploadingHero}
                heroes={[
                  { slot: 1, url: heroImage1, inputRef: hero1InputRef },
                  { slot: 2, url: heroImage2, inputRef: hero2InputRef },
                  { slot: 3, url: heroImage3, inputRef: hero3InputRef },
                ]}
                onLogoPick={() => logoInputRef.current?.click()}
                onLogoFile={onLogoFileChange}
                onClearLogo={clearLogo}
                onHeroFile={onHeroFileChange}
                onClearHero={clearHero}
              />

              <SiteVitrineTrackingCard
                pixel={pixel}
                analytics={analytics}
                onPixelChange={(v) => {
                  setPixel(v);
                  markDirty();
                }}
                onAnalyticsChange={(v) => {
                  setAnalytics(v);
                  markDirty();
                }}
              />
            </div>

            <aside className="space-y-4 xl:sticky xl:top-4">
              <SiteVitrinePreview
                mode={previewMode}
                onModeChange={setPreviewMode}
                title={title}
                description={description}
                tagline={extrasForm.header_tagline}
                themeColor={themeColor}
                titleColor={titleColor}
                headerBg={extrasForm.header_bg}
                headerFg={extrasForm.header_fg}
                headerMuted={extrasForm.header_muted}
                heroUrl={heroImage1 || heroImage2 || heroImage3 || null}
                properties={previewProperties}
              />
              <SiteVitrineChecklist items={checklist} />
              <SiteVitrineStatusCard
                isPublished={isPublished}
                onPublishedChange={(v) => {
                  setIsPublished(v);
                  markDirty();
                }}
                visits30d={visits30d}
                leadsFromSite={leadsFromSite}
                publishedProperties={publishedCount}
                totalProperties={totalCount}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
