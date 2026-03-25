import { useState, useEffect } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Share2, Network, Search, Building2, MapPin, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { convertGoogleDriveUrl, handleImageErrorWithFallback } from "@/utils/imageUtils";
import { toast } from "sonner";

export function PartnershipsView() {
  const { profile } = useUserProfile();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadPartnerships() {
      if (!profile?.company_id) return;
      
      try {
        setLoading(true);
        // Buscar imoveis de outras imobiliarias (ou da mesma para teste, mas idealmente outras)
        // Aqui para demonstração vamos trazer todos que aceitam parceria menos os offline
        const { data, error } = await supabase
          .from('imoveisvivareal')
          .select(`
            *,
            companies:company_id (
              id,
              name
            )
          `)
          .eq('accepts_partnership', true)
          //.neq('company_id', profile.company_id) // Idealmente descomentar para ver só imoveis de TERCEIROS
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProperties(data || []);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar rede de parcerias");
      } finally {
        setLoading(false);
      }
    }

    loadPartnerships();
  }, [profile?.company_id]);

  const filtered = properties.filter(p => {
    const searchLow = searchTerm.toLowerCase();
    return (
      (p.cidade && p.cidade.toLowerCase().includes(searchLow)) ||
      (p.bairro && p.bairro.toLowerCase().includes(searchLow)) ||
      (p.tipo_imovel && p.tipo_imovel.toLowerCase().includes(searchLow)) ||
      (p.descricao && p.descricao.toLowerCase().includes(searchLow))
    );
  });

  const handleInterest = (property: any) => {
    toast.success("Interesse enviado! A imobiliária parceira será notificada.");
    // Aqui poderiamos inserir num banco de 'relacionamentos' ou abrir o chat (Módulo Conversas)
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Share2 className="h-8 w-8 text-emerald-500" />
            Rede de Parcerias
          </h1>
          <p className="text-gray-400 mt-1">
            Encontre imóveis de outras imobiliárias dispostos a realizar parcerias (50/50).
          </p>
        </div>
      </div>
      
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por bairro, cidade ou tipo..." 
          className="w-full bg-gray-900 border border-gray-800 rounded-lg py-6 pl-12 text-white text-lg"
        />
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-10">Conectando à Rede...</div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Network className="h-16 w-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhum imóvel encontrado</h3>
          <p className="text-gray-400 max-w-lg mx-auto">
            Nenhum imóvel está disponível para parceria com os filtros atuais.
            Ative a opção "Aceita Parceria" nos seus imóveis para alimentar a rede.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
          {filtered.map(property => (
            <div key={property.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors flex flex-col">
              <div className="aspect-[4/3] bg-gray-800 relative">
                <img 
                  src={property.imagens ? convertGoogleDriveUrl(property.imagens[0]) : '/placeholder-property.jpg'} 
                  alt="Imóvel"
                  className="w-full h-full object-cover"
                  onError={(e) => handleImageErrorWithFallback(e, property.imagens?.[0], '/placeholder-property.jpg')}
                />
                <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
                  Parceria 50/50
                </div>
              </div>
              
              <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-white font-bold text-lg truncate flex-1" title={property.tipo_imovel || 'Imóvel'}>
                    {property.tipo_imovel || 'Imóvel'}
                  </h3>
                  <div className="text-emerald-400 font-bold ml-2">
                    R$ {Number(property.preco).toLocaleString('pt-BR')}
                  </div>
                </div>
                
                <div className="text-gray-400 text-sm flex items-center mb-4">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span className="truncate">{property.bairro}, {property.cidade}</span>
                </div>
                
                <div className="bg-gray-800 rounded p-2 mb-4 flex items-center text-sm">
                  <Building2 className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-300 truncate">
                    {property.companies?.name || 'Imobiliária Parceira'}
                  </span>
                </div>
                
                {property.partnership_notes && (
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2 italic">
                    "{property.partnership_notes}"
                  </p>
                )}

                <div className="mt-auto pt-4 border-t border-gray-800">
                  <Button 
                    onClick={() => handleInterest(property)}
                    className="w-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-600/50 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Tenho Interesse
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
