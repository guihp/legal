
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Square, Calendar, X, Shield } from "lucide-react";
import { PropertyWithImages } from "@/hooks/useProperties";
import { useState } from "react";

interface PropertyDetailsPopupProps {
  property: PropertyWithImages | null;
  open: boolean;
  onClose: () => void;
}

export function PropertyDetailsPopup({ property, open, onClose }: PropertyDetailsPopupProps) {
  const { profile } = useUserProfile();
  const isCorretor = profile?.role === 'corretor';
  const [availOpen, setAvailOpen] = useState(false);
  const [availValue, setAvailValue] = useState<'disponivel'|'indisponivel'|'reforma'>('disponivel');
  const [availNote, setAvailNote] = useState('');
  if (!property) return null;

  const getStatusBadge = (status: PropertyWithImages["status"]) => {
    const variants = {
      available: "bg-green-600 text-white",
      sold: "bg-blue-600 text-white", 
      rented: "bg-yellow-600 text-black"
    };
    
    const labels = {
      available: "Disponível",
      sold: "Vendido",
      rented: "Alugado"
    };

    return (
      <Badge className={variants[status || "available"]}>
        {labels[status || "available"]}
      </Badge>
    );
  };

  const getTypeLabel = (type: PropertyWithImages["type"]) => {
    const labels = {
      house: "Casa",
      apartment: "Apartamento", 
      commercial: "Comercial",
      land: "Terreno"
    };
    return labels[type];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              {/* Título agora mostra o ID Listing */}
              <DialogTitle className="text-2xl text-white mb-2">
                <span className="text-white font-semibold">ID:</span>{' '}
                <span className="text-emerald-400 font-semibold">{(property as any).listing_id || '-'}</span>
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Etiquetas topo (somente disponibilidade) */}
                <Badge variant="outline" className={(function(){
                  const v = ((property as any).disponibilidade || 'disponivel') as string;
                  const map: Record<string, string> = {
                    disponivel: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
                    indisponivel: 'bg-red-500/20 text-red-300 border-red-400/50',
                    reforma: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50'
                  };
                  return map[v];
                })()}>
                  {(((property as any).disponibilidade) || 'disponivel')}
                </Badge>
              </div>
              {/* Etiquetas organizadas abaixo do título: modalidade, tipo_imovel, tipo_categoria */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {(property as any).city && (
                  <Badge variant="outline" className="bg-slate-500/20 text-slate-300 border-slate-400/50">
                    {(property as any).city}
                  </Badge>
                )}
                {(property as any).tipo_imovel && (
                  <Badge variant="outline" className="bg-violet-500/20 text-violet-300 border-violet-400/50">
                    {(property as any).tipo_imovel}
                  </Badge>
                )}
                {(property as any).tipo_categoria && (
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-400/50">
                    {(property as any).tipo_categoria === 'Residential' ? 'Residencial' : (property as any).tipo_categoria === 'Commercial' ? 'Comercial' : (property as any).tipo_categoria}
                  </Badge>
                )}
              </div>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Imagens */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Imagens</h3>
            {property.property_images && property.property_images.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {property.property_images.map((image, index) => (
                  <div key={image.id} className="aspect-video bg-gray-700 rounded-lg overflow-hidden">
                    <img 
                      src={image.image_url} 
                      alt={`${property.title} - Imagem ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-video bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-gray-400">Nenhuma imagem disponível</span>
              </div>
            )}
          </div>

          {/* Informações */}
          <div className="space-y-6">
            {/* Preço */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Preço</h3>
              <div className="text-3xl font-bold text-white">
                R$ {property.price.toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Localização */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Localização</h3>
              <div className="flex items-center text-gray-300">
                <MapPin className="h-4 w-4 mr-2" />
                {property.address}, {property.city}
              </div>
            </div>

            {/* Características */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Características</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Square className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                  <div className="text-sm text-gray-400">Área</div>
                  <div className="font-semibold text-white">{property.area}m²</div>
                </div>
                {property.bedrooms && (
                  <div className="text-center">
                    <Bed className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                    <div className="text-sm text-gray-400">Quartos</div>
                    <div className="font-semibold text-white">{property.bedrooms}</div>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="text-center">
                    <Bath className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                    <div className="text-sm text-gray-400">Banheiros</div>
                    <div className="font-semibold text-white">{property.bathrooms}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Descrição */}
            {property.description && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Descrição</h3>
                <p className="text-gray-300 leading-relaxed">{property.description}</p>
              </div>
            )}

            {/* Data de criação */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Informações Adicionais</h3>
              <div className="flex items-center text-gray-300">
                <Calendar className="h-4 w-4 mr-2" />
                Cadastrado em {formatDate(property.created_at)}
              </div>

              <div className="mt-2 text-gray-300">
                <div className="text-sm">Disponibilidade atual: <span className="font-semibold">{(property as any).disponibilidade || 'disponivel'}</span></div>
                {(property as any).disponibilidade_observacao && (
                  <div className="text-xs text-gray-400">Obs: {(property as any).disponibilidade_observacao}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-700">
            Fechar
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setAvailValue(((property as any).disponibilidade || 'disponivel') as any);
              setAvailNote('');
              setAvailOpen(true);
            }}
            className="border-emerald-600 text-emerald-300 hover:bg-emerald-800/30"
          >
            <Shield className="h-4 w-4 mr-2" />
            Disponibilidade
          </Button>
        </div>

        {/* Modal disponibilidade */}
        <Dialog open={availOpen} onOpenChange={setAvailOpen}>
          <DialogContent className="bg-gray-900 border border-gray-700 text-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">Alterar disponibilidade</DialogTitle>
              <DialogDescription className="text-gray-300">
                Se marcar como Indisponível ou Reforma, descreva o motivo na observação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Select value={availValue} onValueChange={(v: any) => setAvailValue(v)}>
                  <SelectTrigger className="w-48 bg-gray-900/50 border-gray-600 text-white">
                    <SelectValue placeholder="Disponibilidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-600">
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="indisponivel">Indisponível</SelectItem>
                    <SelectItem value="reforma">Reforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-gray-300">Observação</label>
                <Textarea
                  value={availNote}
                  onChange={(e) => setAvailNote(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                  placeholder="Descreva o motivo quando marcar Indisponível ou Reforma"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800" onClick={() => setAvailOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const isViva = !(property as any).property_images; // heurística simples
                      const table = isViva ? 'imoveisvivareal' : 'properties';
                      const idCol = 'id';
                      if ((availValue === 'indisponivel' || availValue === 'reforma') && (!availNote || availNote.trim().length === 0)) {
                        // Exigir observação
                        return;
                      }
                      const updates: any = { disponibilidade: availValue, disponibilidade_observacao: availNote || null };
                      const idValue: any = isViva ? Number(property.id) : property.id;
                      const { error } = await supabase
                        .from(table)
                        .update(updates)
                        .eq(idCol, idValue)
                        .select('id')
                        .maybeSingle();
                      if (error) throw error;
                      setAvailOpen(false);
                    } catch (err: any) {
                      console.error(err);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
