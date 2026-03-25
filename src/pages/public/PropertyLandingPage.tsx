import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Bed, Bath, Car, Maximize, MapPin, CheckCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

type Imovel = Database['public']['Tables']['imoveisvivareal']['Row'];

export type PropertyLandingPageConfig = {
  id: string;
  property_id: number;
  company_id: string;
  slug: string;
  is_published: boolean;
  views: number;
  custom_color: string | null;
  company_name?: string; // We'll mock this for now
};

export default function PropertyLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lpConfig, setLpConfig] = useState<PropertyLandingPageConfig | null>(null);
  const [property, setProperty] = useState<Imovel | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '' });
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        setLoading(true);
        // Load LP
        const { data: lpData, error: lpError } = await supabase
          .from('property_landing_pages')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .single();

        if (lpError || !lpData) throw new Error('Página não encontrada ou desativada.');

        setLpConfig(lpData as unknown as PropertyLandingPageConfig);

        // Load Property
        const { data: propData, error: propError } = await supabase
          .from('imoveisvivareal')
          .select('*')
          .eq('id', lpData.property_id)
          .single();

        if (propError || !propData) throw new Error('Detalhes do imóvel não encontrados.');

        setProperty(propData);

        // Register View (Optional, ignore errors on views count update)
        supabase.rpc('increment_page_view', { page_id: lpData.id }).then().catch(() => {});

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lpConfig || !property) return;
    
    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke('capture-public-lead', {
        body: {
          name: leadForm.name,
          phone: leadForm.phone,
          email: leadForm.email,
          imovel_interesse: property.descricao || property.tipo_imovel || property.id.toString(),
          company_id: lpConfig.company_id,
          source: 'Landing Page: ' + slug
        }
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao enviar dados');
      
      setFormSuccess(true);
      toast.success('Informações enviadas com sucesso! Entraremos em contato.');
      setLeadForm({ name: '', phone: '', email: '' });
    } catch (err: any) {
      toast.error('Ocorreu um erro ao enviar. Tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWhatsApp = () => {
    // This could optionally fetch the broker's specific phone number if we fetched user_profile
    // For now we just use a generic message without specific number
    const msg = `Olá! Tenho interesse no imóvel: ${property?.tipo_imovel || 'Imóvel'} em ${property?.bairro || ''}. Vi pelo site.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !property || !lpConfig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Ops!</h1>
        <p className="text-gray-600 mb-8">{error || 'Página indisponível'}</p>
      </div>
    );
  }

  const primaryColor = lpConfig.custom_color || '#3B82F6';
  const priceFormatted = property.preco ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.preco) : 'Sob Consulta';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans" style={{ '--primary': primaryColor } as React.CSSProperties}>
      
      {/* Hero Image Section */}
      <div className="relative w-full h-[50vh] md:h-[65vh] bg-black">
        {property.imagens && property.imagens.length > 0 ? (
          <img 
            src={property.imagens[0]} 
            alt="Foto do imóvel" 
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">Sem Foto</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 text-white">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-sm font-medium mb-3 border border-white/30">
                {property.modalidade || 'Disponível'}
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold mb-2 drop-shadow-md">
                {property.tipo_imovel || 'Imóvel Exclusivo'}
              </h1>
              <p className="text-lg md:text-xl text-white/90 flex items-center">
                <MapPin className="w-5 h-5 mr-1" />
                {property.bairro}, {property.cidade}
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-gray-300 uppercase font-semibold tracking-wider">Investimento</p>
              <p className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">{priceFormatted}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Details (Left) */}
          <div className="lg:col-span-2 space-y-10">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col items-center justify-center p-2">
                <Maximize className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-2xl font-bold text-gray-800">{property.tamanho_m2 || '-'}</span>
                <span className="text-xs text-gray-500 uppercase">Área Total m²</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2">
                <Bed className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-2xl font-bold text-gray-800">{property.quartos || '-'}</span>
                <span className="text-xs text-gray-500 uppercase">Quartos</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2">
                <Bath className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-2xl font-bold text-gray-800">{property.banheiros || '-'}</span>
                <span className="text-xs text-gray-500 uppercase">Banheiros</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2">
                <Car className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-2xl font-bold text-gray-800">{property.garagem || '-'}</span>
                <span className="text-xs text-gray-500 uppercase">Vagas</span>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Sobre o Imóvel</h2>
              <div className="prose text-gray-600 leading-relaxed whitespace-pre-wrap">
                {property.descricao || 'Nenhuma descrição fornecida.'}
              </div>
            </div>

            {/* Features */}
            {property.features && property.features.length > 0 && (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Comodidades</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {property.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center text-gray-700">
                      <CheckCircle className="w-5 h-5 mr-3" style={{ color: 'var(--primary)' }} />
                      <span className="font-medium">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Lead Form (Right) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-gray-100 sticky top-8">
              <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Interessou?</h3>
              <p className="text-gray-500 mb-6 text-sm">Preencha seus dados e o corretor responsável entrará em contato em minutos.</p>
              
              {formSuccess ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-green-800 mb-1">Tudo certo!</p>
                  <p className="text-sm text-green-600">Recebemos seus dados. Logo falaremos com você.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome completo</label>
                    <input 
                      type="text" 
                      required
                      value={leadForm.name}
                      onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                    <input 
                      type="tel" 
                      required
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Opcional)</label>
                    <input 
                      type="email" 
                      value={leadForm.email}
                      onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="joao@email.com"
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full text-white font-bold py-4 px-4 rounded-xl shadow-md hover:shadow-lg hover:brightness-110 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-6"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {isSubmitting ? 'Enviando...' : 'Agendar Visita'}
                  </button>
                  
                </form>
              )}

              <div className="mt-6 flex items-center justify-center">
                <span className="text-gray-400 text-sm">ou</span>
              </div>

              <button 
                onClick={openWhatsApp}
                className="w-full mt-6 bg-[#25D366] text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-[#20bd5a] transition-all flex items-center justify-center"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Chamar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
