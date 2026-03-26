import { useState, useEffect, useRef } from 'react';
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Globe, Layers, Save, ExternalLink } from "lucide-react";
import { slugifyForUrl } from '@/lib/slugify';
import { MarketingTrafficSection } from '@/components/MarketingTrafficSection';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const [companyName, setCompanyName] = useState<string | null>(null);
  const defaultsAppliedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'website'>(section);

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
          defaultsAppliedRef.current = true;
        } else if (companyName && !defaultsAppliedRef.current) {
          const base = slugifyForUrl(companyName);
          const unique = await ensureUniqueWebsiteSlug(base);
          setTitle(companyName);
          setSlug(unique);
          setTitleColor("#FFFFFF");
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
        hero_images: [heroImage1, heroImage2, heroImage3].map((s) => s.trim()).filter(Boolean)
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
        toast.success('Logo enviada com sucesso.');
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
      toast.success(`Capa ${slot} enviada com sucesso.`);
    } finally {
      setUploadingHero(null);
    }
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

          <MarketingTrafficSection companyId={profile?.company_id ?? null} />
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
                    onChange={e => setTitle(e.target.value)} 
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
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} 
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
                  onChange={e => setDescription(e.target.value)} 
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
                      onChange={e => setThemeColor(e.target.value)}
                      className="h-10 w-10 rounded border border-gray-700 cursor-pointer bg-gray-800 p-1"
                    />
                    <Input 
                      value={themeColor} 
                      onChange={e => setThemeColor(e.target.value)} 
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
                      onChange={e => setTitleColor(e.target.value)}
                      className="h-10 w-10 rounded border border-gray-700 cursor-pointer bg-gray-800 p-1"
                    />
                    <Input
                      value={titleColor}
                      onChange={e => setTitleColor(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Meta Pixel (ID)</label>
                  <Input 
                    value={pixel} 
                    onChange={e => setPixel(e.target.value)} 
                    placeholder="Ex: 123456789"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Google Analytics (G-XXXX)</label>
                  <Input 
                    value={analytics} 
                    onChange={e => setAnalytics(e.target.value)} 
                    placeholder="Ex: G-XXXXXXXXXX"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Logo da imobiliária</label>
                  <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/30 p-3">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => onLogoFileChange(e.target.files?.[0])}
                      className="bg-gray-800 border-gray-700 text-white file:text-gray-200"
                    />
                    <p className="text-xs text-gray-400">
                      Limite: {LOGO_MAX_MB}MB. Recomendado: PNG/WEBP com fundo transparente, 512x512px (mínimo 320x320).
                    </p>
                    {logoUrl && <p className="text-xs text-green-400 break-all">Logo carregada.</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">Capas do Hero (até 3 imagens)</h3>
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => onHeroFileChange(1, e.target.files?.[0])}
                    disabled={uploadingHero === 1}
                    className="bg-gray-800 border-gray-700 text-white file:text-gray-200"
                  />
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => onHeroFileChange(2, e.target.files?.[0])}
                    disabled={uploadingHero === 2}
                    className="bg-gray-800 border-gray-700 text-white file:text-gray-200"
                  />
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => onHeroFileChange(3, e.target.files?.[0])}
                    disabled={uploadingHero === 3}
                    className="bg-gray-800 border-gray-700 text-white file:text-gray-200"
                  />
                  <p className="text-xs text-gray-400">
                    Limite por imagem: {HERO_MAX_MB}MB. Recomendado: 1920x900px (mínimo 1440x720), formato horizontal 16:9.
                  </p>
                  <div className="text-xs text-gray-500">
                    {heroImage1 && <div>Capa 1 carregada</div>}
                    {heroImage2 && <div>Capa 2 carregada</div>}
                    {heroImage3 && <div>Capa 3 carregada</div>}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-12 h-6 rounded-full flex items-center cursor-pointer transition-colors px-1 ${isPublished ? 'bg-green-500' : 'bg-gray-600'}`}
                    onClick={() => setIsPublished(!isPublished)}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublished ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="text-sm font-medium text-gray-300">
                    {isPublished ? 'Site Aberto ao Público' : 'Site Oculto (Rascunho)'}
                  </span>
                </div>

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
          )}
        </div>
      )}
    </div>
  );
}
