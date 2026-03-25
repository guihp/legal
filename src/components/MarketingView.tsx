import { useState, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Globe, Layers, Save, Eye, ExternalLink, Activity } from "lucide-react";
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
};

export function MarketingView() {
  const { profile } = useUserProfile();
  const [activeTab, setActiveTab] = useState<'overview' | 'website'>('overview');
  const [website, setWebsite] = useState<CompanyWebsite | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState("#3B82F6");
  const [isPublished, setIsPublished] = useState(false);
  const [pixel, setPixel] = useState("");
  const [analytics, setAnalytics] = useState("");

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
          setIsPublished(data.is_published || false);
          setPixel(data.pixel_facebook || "");
          setAnalytics(data.analytics_google || "");
        }
      } catch (err: any) {
        toast.error("Erro ao carregar configurações do site.");
      } finally {
        setLoading(false);
      }
    }
    loadWebsite();
  }, [profile?.company_id]);

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
        is_published: isPublished,
        pixel_facebook: pixel,
        analytics_google: analytics
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

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <Activity className="h-8 w-8 text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Leads Gerados</h3>
            <p className="text-gray-400 text-sm mb-4">
              Acompanhe quem entrou em contato via Site e LPs diretamente no seu CRM de Clientes.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'website' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 lg:p-8 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-800 pb-4">Construtor de Site Vitrine</h2>
          
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
                      seusite.com/s/
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
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar Alteraçoes'}
                </Button>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
