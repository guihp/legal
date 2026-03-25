import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { BuildingIcon, MapPin, Search } from 'lucide-react';

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
};

export default function SiteVitrine({ companySlug: propCompanySlug }: { companySlug?: string }) {
  const { companySlug: paramCompanySlug } = useParams<{ companySlug: string }>();
  const companySlug = propCompanySlug || paramCompanySlug;
  const [website, setWebsite] = useState<CompanyWebsite | null>(null);
  const [properties, setProperties] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSite() {
      if (!companySlug) return;
      try {
        setLoading(true);
        // Load Website Config
        const { data, error: webError } = await supabase
          .from('company_websites' as any)
          .select('*')
          .eq('slug', companySlug)
          .eq('is_published', true)
          .single();

        const webData = data as any;

        if (webError || !webData) {
          throw new Error('Site não encontrado ou está fora do ar.');
        }

        setWebsite(webData as unknown as CompanyWebsite);

        // Load Active Properties for this company
        const { data: propData, error: propError } = await supabase
          .from('imoveisvivareal')
          .select('*')
          .eq('company_id', webData.company_id)
          .eq('disponibilidade', 'disponivel')
          .order('created_at', { ascending: false });

        if (!propError && propData) {
          setProperties(propData);
        }

        // Inject analytics if needed
        if (webData.pixel_facebook) {
          console.log('Injecting FB Pixel:', webData.pixel_facebook);
          // Real-world: Insert <script> block for FP Pixel here
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadSite();
  }, [companySlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !website) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <BuildingIcon className="w-16 h-16 text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Ops! Algo deu errado.</h1>
        <p className="text-gray-600">{error || 'Site indisponível'}</p>
      </div>
    );
  }

  // Define dynamic primary color
  const themeStyle = { '--primary': website.theme_color } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-gray-50 font-sans" style={themeStyle}>
      {/* Header */}
      <header 
        className="w-full text-white py-12 px-6 flex flex-col items-center text-center shadow-lg" 
        style={{ backgroundColor: 'var(--primary)', backgroundImage: 'linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.3))' }}
      >
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{website.title}</h1>
        {website.description && (
          <p className="text-lg md:text-xl text-white/90 max-w-2xl">{website.description}</p>
        )}
        
        {/* Search Bar Example */}
        <div className="mt-8 bg-white p-2 rounded-full shadow-lg flex items-center w-full max-w-md">
          <Search className="w-5 h-5 text-gray-400 ml-3" />
          <input 
            type="text" 
            placeholder="Buscar por bairro ou cidade..." 
            className="w-full bg-transparent border-none outline-none px-4 py-2 text-gray-800"
          />
          <button 
            className="px-6 py-2 rounded-full text-white font-medium hover:brightness-110 transition-all"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Buscar
          </button>
        </div>
      </header>

      {/* Property Grid */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Nossos Imóveis</h2>
          <span className="text-gray-500 font-medium">{properties.length} imóveis encontrados</span>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <BuildingIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Nenhum imóvel disponível</h3>
            <p className="text-gray-500">Volte novamente em breve para novidades!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((prop) => (
              <div key={prop.id} className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 group flex flex-col">
                <div className="relative h-64 overflow-hidden bg-gray-200">
                  {prop.imagens && prop.imagens.length > 0 ? (
                    <img 
                      src={prop.imagens[0]} 
                      alt={prop.descricao || 'Imóvel'} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Sem imagem
                    </div>
                  )}
                  {prop.modalidade && (
                    <div 
                      className="absolute top-4 left-4 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {prop.modalidade}
                    </div>
                  )}
                </div>
                
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900 line-clamp-2">{prop.tipo_imovel || 'Imóvel'}</h3>
                  </div>
                  
                  <div className="flex items-center text-gray-500 text-sm mb-4">
                    <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">{prop.bairro || 'Bairro'}, {prop.cidade || 'Cidade'}</span>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">Valor</p>
                      <p className="text-xl font-bold text-gray-900">
                        {prop.preco ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prop.preco) : 'Sob Consulta'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 text-center mt-12">
        <p>© {new Date().getFullYear()} {website.title}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
