import { useState, useEffect, useRef } from 'react';
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Globe, Layers, Save, ExternalLink, Upload, Image as ImageIcon, Trash2, Loader2, AlertCircle } from "lucide-react";
import { slugifyForUrl } from '@/lib/slugify';
import { MarketingTrafficSection } from '@/components/MarketingTrafficSection';
// import { CustomDomainsSection } from '@/components/CustomDomainsSection'; // Desabilitado temporariamente — domínio próprio será reativado com Caddy on-demand TLS
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBasicNavigation } from "@/hooks/useBasicNavigation";
import { Checkbox } from "@/components/ui/checkbox";
import { mergeVitrineExtras, parseVitrineExtras } from "@/lib/vitrineSiteExtras";

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
};

type MarketingSection = 'overview' | 'website';
const COMPANY_ASSETS_BUCKET = 'company-assets';
const LOGO_MAX_MB = 2;
const HERO_MAX_MB = 5;

function bytesFromMb(mb: number): number {
  return mb * 1024 * 1024;
}

async function ensureUniqueWebsiteSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  for (let n = 0; n < 24; n++) {
    const { data } = await supabase.from('company_websites' as never).select('id').eq('slug', candidate).maybeSingle();
    const row = data as { id: string } | null;
    if (!row || row.id === excludeId) return candidate;
    candidate = `${base}-${n + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function MarketingView({ section = 'overview' }: { section?: MarketingSection }) {
  const { profile } = useUserProfile();
  const { changeView } = useBasicNavigation();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const defaultsAppliedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'website'>(section);
  const [dirty, setDirty] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const hero1InputRef = useRef<HTMLInputElement | null>(null);
  const hero2InputRef = useRef<HTMLInputElement | null>(null);
  const hero3InputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveTab(section);
  }, [section]);
  const [website, setWebsite] = useState<CompanyWebsite | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState("#3B82F6");
  const [titleColor, setTitleColor] = useState("#FFFFFF");
  const [isPublished, setIsPublished] = useState(false);
  const [pixel, setPixel] = useState("");
  const [analytics, setAnalytics] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [heroImage1, setHeroImage1] = useState("");
  const [heroImage2, setHeroImage2] = useState("");
  const [heroImage3, setHeroImage3] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState<1 | 2 | 3 | null>(null);
  const [extrasForm, setExtrasForm] = useState<VitrineExtrasForm>(() => mergeVitrineExtras({}));
  const [settingsFontHint, setSettingsFontHint] = useState<string | null>(null);

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
      if (!profile?.company_id || activeTab !== "website") return;
      const { data } = await supabase
        .from("company_settings")
        .select("company_name_font_family")
        .eq("company_id", profile.company_id)
        .maybeSingle();
      const row = data as { company_name_font_family?: string | null } | null;
      setSettingsFontHint(row?.company_name_font_family?.trim() || "Inter");
    }
    loadFontHint();
  }, [profile?.company_id, activeTab]);

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
          setWebsite(data as unknown as CompanyWebsite);
          setSlug(data.slug || "");
          setTitle(data.title || "");
          setDescription(data.description || "");
          setThemeColor(data.theme_color || "#3B82F6");
          setTitleColor((data as any).title_color || "#FFFFFF");
          setIsPublished(data.is_published || false);
          setPixel(data.pixel_facebook || "");
          setAnalytics(data.analytics_google || "");
          setLogoUrl((data as any).logo_url || "");
          const imgs = Array.isArray((data as any).hero_images) ? (data as any).hero_images : [];
          setHeroImage1(imgs[0] || "");
          setHeroImage2(imgs[1] || "");
          setHeroImage3(imgs[2] || "");
          setExtrasForm(mergeVitrineExtras(parseVitrineExtras((data as any).vitrine_extras)));
          defaultsAppliedRef.current = true;
        } else if (companyName && !defaultsAppliedRef.current) {
          const base = slugifyForUrl(companyName);
          const unique = await ensureUniqueWebsiteSlug(base);
          setTitle(companyName);
          setSlug(unique);
          setTitleColor("#FFFFFF");
          setExtrasForm(mergeVitrineExtras({}));
          defaultsAppliedRef.current = true;
        }
      } catch (err: any) {
        toast.error("Erro ao carregar configurações do site.");
      } finally {
        setLoading(false);
      }
    }
    loadWebsite();
  }, [profile?.company_id, companyName]);

  const handleSaveWebsite = async () => {
    if (!profile?.company_id) return;
    if (!slug || !title) {
      toast.error("Slug e Título são obrigatórios.");
      return;
    }
    
    // Validar slug básico (letras, numeros, hifens)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error("O link deve conter apenas letras minúsculas, números e hifens.");
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
      };

      if (website?.id) {
        // Update
        const { error } = await supabase
          .from('company_websites')
          .update(payload)
          .eq('id', website.id);
        if (error) throw error;
        toast.success("Site atualizado com sucesso!");
        setWebsite({ ...website, ...payload } as unknown as CompanyWebsite);
      } else {
        // Insert
        const { data, error } = await supabase
          .from('company_websites')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setWebsite(data as unknown as CompanyWebsite);
        toast.success("Site criado com sucesso!");
      }
      setDirty(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar o site. Verifique se o link já está em uso.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (file: File, kind: 'logo' | 'hero', slot?: 1 | 2 | 3): Promise<string | null> => {
    if (!profile?.company_id) return null;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
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
    // Alguns ambientes retornam URL sem /public/; garantir formato público
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
        setDirty(true);
        toast.success('Logo enviada. Clique em "Salvar alterações" para publicar.');
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
      setDirty(true);
      toast.success(`Capa ${slot} enviada. Clique em "Salvar alterações" para publicar.`);
    } finally {
      setUploadingHero(null);
    }
  };

  const clearLogo = () => {
    setLogoUrl('');
    setDirty(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const clearHero = (slot: 1 | 2 | 3) => {
    if (slot === 1) { setHeroImage1(''); if (hero1InputRef.current) hero1InputRef.current.value = ''; }
    if (slot === 2) { setHeroImage2(''); if (hero2InputRef.current) hero2InputRef.current.value = ''; }
    if (slot === 3) { setHeroImage3(''); if (hero3InputRef.current) hero3InputRef.current.value = ''; }
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-blue-500" />
            Marketing & Vendas
          </h1>
          <p className="text-gray-400 mt-1">
            Configure seu site vitrine, landing pages e integrações.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
            className={activeTab === 'overview' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700 text-gray-300'}
          >
            Visão Geral
          </Button>
          <Button 
            variant={activeTab === 'website' ? 'default' : 'outline'}
            onClick={() => setActiveTab('website')}
            className={activeTab === 'website' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700 text-gray-300'}
          >
            Site Vitrine
          </Button>
        </div>
      </div>
      
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <Globe className="h-8 w-8 text-purple-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Seu Site</h3>
            <p className="text-gray-400 text-sm mb-4">
              Status: {isPublished ? <span className="text-green-400 font-bold">Online</span> : <span className="text-gray-500">Offline</span>}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setActiveTab('website')} className="w-full bg-gray-800 hover:bg-gray-700 text-white">
                Configurar
              </Button>
              {isPublished && website?.slug && (
                <Button variant="outline" className="border-gray-700 hover:bg-gray-800" onClick={() => window.open(`/s/${website.slug}`, '_blank')}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <Layers className="h-8 w-8 text-blue-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Landing Pages</h3>
            <p className="text-gray-400 text-sm mb-4">
              Crie páginas de alta conversão diretamente nos detalhes de cada imóvel.
            </p>
            <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border-0" onClick={() => toast.info("Acesse a listagem de imóveis e clique em um imóvel para gerenciar sua Landing Page.")}>
              Ver Imóveis
            </Button>
          </div>

          <MarketingTrafficSection
            companyId={profile?.company_id ?? null}
            onOpenFullPage={() => changeView('marketing-visitas', 'Abrir página de visitas')}
          />
        </div>
      )}

      {activeTab === 'website' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 lg:p-8 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-800 pb-4">Construtor de Site Vitrine</h2>
          <p className="text-sm text-gray-200 mb-6 rounded-lg border border-gray-600 bg-gray-800 px-4 py-3">
            <strong className="text-gray-200">Como funciona:</strong> o site público fica em{' '}
            <code className="text-blue-300">/s/seu-slug</code> e lista os imóveis disponíveis. Cada imóvel pode ter uma
            landing em <code className="text-blue-300">/imovel/slug-da-lp</code> — configure em{' '}
            <span className="text-gray-200">Propriedades → abrir imóvel → Landing Page (LP)</span>. No vitrine, o card
            só vira link quando existir LP publicada para aquele imóvel.
          </p>

          {loading ? (
            <div className="text-gray-400 py-8 text-center">Carregando configurações...</div>
          ) : (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Título do Site</label>
                  <Input
                    value={title}
                    onChange={e => { setTitle(e.target.value); setDirty(true); }}
                    placeholder="Ex: Minha Imobiliária"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Link Personalizado (Slug)</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-700 bg-gray-800 text-gray-400 sm:text-sm">
                      imobi.iafeoficial.com/s/
                    </span>
                    <Input
                      value={slug}
                      onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setDirty(true); }}
                      placeholder="minha-imobiliaria"
                      className="rounded-l-none bg-gray-800 border-gray-700 text-white flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Descrição Breve</label>
                <Textarea
                  value={description}
                  onChange={e => { setDescription(e.target.value); setDirty(true); }}
                  placeholder="Os melhores imóveis da região..."
                  className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Cor Principal</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => { setThemeColor(e.target.value); setDirty(true); }}
                      className="h-10 w-10 rounded border border-gray-700 cursor-pointer bg-gray-800 p-1"
                    />
                    <Input
                      value={themeColor}
                      onChange={e => { setThemeColor(e.target.value); setDirty(true); }}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Cor do título (hero)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={titleColor}
                      onChange={e => { setTitleColor(e.target.value); setDirty(true); }}
                      className="h-10 w-10 rounded border border-gray-700 cursor-pointer bg-gray-800 p-1"
                    />
                    <Input
                      value={titleColor}
                      onChange={e => { setTitleColor(e.target.value); setDirty(true); }}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Meta Pixel (ID)</label>
                  <Input
                    value={pixel}
                    onChange={e => { setPixel(e.target.value); setDirty(true); }}
                    placeholder="Ex: 123456789"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Google Analytics (G-XXXX)</label>
                  <Input
                    value={analytics}
                    onChange={e => { setAnalytics(e.target.value); setDirty(true); }}
                    placeholder="Ex: G-XXXXXXXXXX"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">Menu fixo (topo público)</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Cores sólidas para o cabeçalho em <code className="text-blue-300">/s/seu-slug</code> — contraste legível sobre o hero.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Fundo do menu</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={extrasForm.header_bg}
                        onChange={(e) => { setExtrasForm({ ...extrasForm, header_bg: e.target.value }); setDirty(true); }}
                        className="h-9 w-9 rounded border border-gray-700 cursor-pointer bg-gray-800 p-0.5"
                      />
                      <Input
                        value={extrasForm.header_bg}
                        onChange={(e) => { setExtrasForm({ ...extrasForm, header_bg: e.target.value }); setDirty(true); }}
                        className="bg-gray-800 border-gray-700 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Texto principal</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={extrasForm.header_fg}
                        onChange={(e) => { setExtrasForm({ ...extrasForm, header_fg: e.target.value }); setDirty(true); }}
                        className="h-9 w-9 rounded border border-gray-700 cursor-pointer bg-gray-800 p-0.5"
                      />
                      <Input
                        value={extrasForm.header_fg}
                        onChange={(e) => { setExtrasForm({ ...extrasForm, header_fg: e.target.value }); setDirty(true); }}
                        className="bg-gray-800 border-gray-700 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Texto secundário / links</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={extrasForm.header_muted}
                        onChange={(e) => { setExtrasForm({ ...extrasForm, header_muted: e.target.value }); setDirty(true); }}
                        className="h-9 w-9 rounded border border-gray-700 cursor-pointer bg-gray-800 p-0.5"
                      />
                      <Input
                        value={extrasForm.header_muted}
                        onChange={(e) => { setExtrasForm({ ...extrasForm, header_muted: e.target.value }); setDirty(true); }}
                        className="bg-gray-800 border-gray-700 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Subtítulo sob o nome (ex.: Imóveis selecionados)</label>
                  <Input
                    value={extrasForm.header_tagline}
                    onChange={(e) => { setExtrasForm({ ...extrasForm, header_tagline: e.target.value }); setDirty(true); }}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="flex items-start gap-3 rounded-md border border-gray-700/80 bg-gray-950/50 px-3 py-3">
                  <Checkbox
                    id="sv-use-company-font"
                    checked={extrasForm.use_company_display_font}
                    onCheckedChange={(v) => {
                      setExtrasForm({ ...extrasForm, use_company_display_font: v === true });
                      setDirty(true);
                    }}
                    className="mt-0.5 border-gray-500 data-[state=checked]:bg-blue-600"
                  />
                  <div>
                    <label htmlFor="sv-use-company-font" className="text-sm font-medium text-gray-200 cursor-pointer">
                      Usar tipografia do nome da imobiliária nos títulos do site
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Fonte atual nas configurações: <span className="text-gray-300">{settingsFontHint ?? "…"}</span>. Ajuste em{" "}
                      <span className="text-gray-300">Configurações → Aparência</span> (famílias carregadas incluem Inter, Playfair, etc.).
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">Textos — Sobre e contato (página pública)</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Seção no fim do vitrine (<code className="text-blue-300">#sobre</code> / <code className="text-blue-300">#contato</code>). Instagram aparece no contato quando a empresa tem{" "}
                    <span className="text-gray-300">id_instagram</span> e <span className="text-gray-300">arroba_instagram_empresa</span> preenchidos.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Selo da coluna Sobre</label>
                    <Input
                      value={extrasForm.about_kicker}
                      onChange={(e) => { setExtrasForm({ ...extrasForm, about_kicker: e.target.value }); setDirty(true); }}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Título Sobre (vazio = nome da empresa)</label>
                    <Input
                      value={extrasForm.about_title}
                      onChange={(e) => { setExtrasForm({ ...extrasForm, about_title: e.target.value }); setDirty(true); }}
                      placeholder="Ex.: Jastelo Empreendimentos"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Parágrafo Sobre (vazio = descrição breve do site acima)</label>
                  <Textarea
                    value={extrasForm.about_paragraph}
                    onChange={(e) => { setExtrasForm({ ...extrasForm, about_paragraph: e.target.value }); setDirty(true); }}
                    rows={3}
                    className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {([1, 2, 3] as const).map((n) => (
                    <div key={n} className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Destaque {n}</label>
                      <Input
                        value={n === 1 ? extrasForm.about_bullet1 : n === 2 ? extrasForm.about_bullet2 : extrasForm.about_bullet3}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (n === 1) setExtrasForm({ ...extrasForm, about_bullet1: v });
                          else if (n === 2) setExtrasForm({ ...extrasForm, about_bullet2: v });
                          else setExtrasForm({ ...extrasForm, about_bullet3: v });
                          setDirty(true);
                        }}
                        className="bg-gray-800 border-gray-700 text-white text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-800">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Selo contato</label>
                    <Input
                      value={extrasForm.contact_kicker}
                      onChange={(e) => { setExtrasForm({ ...extrasForm, contact_kicker: e.target.value }); setDirty(true); }}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Título contato</label>
                    <Input
                      value={extrasForm.contact_title}
                      onChange={(e) => { setExtrasForm({ ...extrasForm, contact_title: e.target.value }); setDirty(true); }}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-sm font-medium text-gray-300">Intro contato</label>
                    <Textarea
                      value={extrasForm.contact_intro}
                      onChange={(e) => { setExtrasForm({ ...extrasForm, contact_intro: e.target.value }); setDirty(true); }}
                      rows={2}
                      className="bg-gray-800 border-gray-700 text-white min-h-[72px]"
                    />
                  </div>
                </div>
              </div>

              {/* LOGO */}
              <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">Logo da imobiliária</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      PNG/WEBP com fundo transparente · mín. 320×320px · máx. {LOGO_MAX_MB}MB
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="relative shrink-0 w-28 h-28 rounded-xl border border-dashed border-gray-700 bg-gray-950 flex items-center justify-center overflow-hidden">
                    {uploadingLogo ? (
                      <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                    ) : logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain bg-white/5"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="text-center px-2">
                        <ImageIcon className="h-7 w-7 text-gray-600 mx-auto mb-1" />
                        <span className="text-[10px] text-gray-500">Sem logo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={() => logoInputRef.current?.click()}
                        className="border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
                      >
                        <Upload className="w-3.5 h-3.5 mr-2" />
                        {logoUrl ? 'Trocar logo' : 'Enviar logo'}
                      </Button>
                      {logoUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearLogo}
                          className="border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/40"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Remover
                        </Button>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          onLogoFileChange(f);
                        }}
                      />
                    </div>
                    {logoUrl && (
                      <p className="text-[11px] text-emerald-400 break-all">
                        ✓ {logoUrl.split('/').pop()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* HERO */}
              <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">Capas do Hero (até 3 imagens)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Formato 16:9 · recomendado 1920×900px · máx. {HERO_MAX_MB}MB cada
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {[heroImage1, heroImage2, heroImage3].filter(Boolean).length}/3 preenchidas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {([
                    { slot: 1 as const, url: heroImage1, ref: hero1InputRef },
                    { slot: 2 as const, url: heroImage2, ref: hero2InputRef },
                    { slot: 3 as const, url: heroImage3, ref: hero3InputRef },
                  ]).map(({ slot, url, ref }) => (
                    <div key={slot} className="space-y-2">
                      <div
                        className={`relative aspect-video rounded-lg border overflow-hidden bg-gray-950 flex items-center justify-center transition-all ${
                          url ? 'border-gray-700' : 'border-dashed border-gray-700 hover:border-blue-700'
                        }`}
                      >
                        {uploadingHero === slot ? (
                          <Loader2 className="h-7 w-7 text-blue-400 animate-spin" />
                        ) : url ? (
                          <>
                            <img
                              src={url}
                              alt={`Capa ${slot}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                            <button
                              type="button"
                              onClick={() => clearHero(slot)}
                              className="absolute top-2 right-2 rounded-md bg-black/70 hover:bg-red-600/80 text-white p-1.5 shadow-lg transition"
                              title={`Remover capa ${slot}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/90 text-white">
                              Capa {slot}
                            </span>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => ref.current?.click()}
                            className="flex flex-col items-center justify-center text-gray-500 hover:text-blue-400 transition w-full h-full"
                          >
                            <Upload className="h-6 w-6 mb-1" />
                            <span className="text-xs font-medium">Enviar capa {slot}</span>
                            <span className="text-[10px] text-gray-600 mt-0.5">Clique para escolher</span>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingHero === slot}
                          onClick={() => ref.current?.click()}
                          className="flex-1 border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 h-8 text-xs"
                        >
                          <Upload className="w-3 h-3 mr-1.5" />
                          {url ? 'Trocar' : 'Selecionar'}
                        </Button>
                        <input
                          ref={ref}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            onHeroFileChange(slot, f);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* DOMÍNIO PRÓPRIO (white-label) — desabilitado temporariamente */}
              {/* <CustomDomainsSection companyId={profile?.company_id ?? null} /> */}

              {dirty && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-amber-200">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <strong className="font-semibold">Alterações não salvas.</strong>{' '}
                    Clique em <span className="underline decoration-amber-400/60">Salvar alterações</span> para aplicar no site público.
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-6 rounded-full flex items-center cursor-pointer transition-colors px-1 ${isPublished ? 'bg-green-500' : 'bg-gray-600'}`}
                    onClick={() => { setIsPublished(!isPublished); setDirty(true); }}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublished ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="text-sm font-medium text-gray-300">
                    {isPublished ? 'Site Aberto ao Público' : 'Site Oculto (Rascunho)'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isPublished && slug && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(`/s/${slug}`, '_blank')}
                      className="border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir site
                    </Button>
                  )}
                  <Button
                    onClick={handleSaveWebsite}
                    disabled={saving || uploadingLogo || uploadingHero !== null}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
