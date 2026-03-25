
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Square, Calendar, X, Shield, Globe, Link as LinkIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import { PropertyWithImages } from "@/hooks/useProperties";
import { useState, useEffect } from "react";
import { convertGoogleDriveUrl, handleImageErrorWithFallback } from "@/utils/imageUtils";
import { MarketingActionCards } from "./MarketingActionCards";

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
  
  // States Modal LP
  const [lpOpen, setLpOpen] = useState(false);
  const [lpLoading, setLpLoading] = useState(false);
  const [lpData, setLpData] = useState<any>(null);
  const [lpSlug, setLpSlug] = useState('');
  const [lpTitle, setLpTitle] = useState('');
  const [lpPublished, setLpPublished] = useState(false);

  useEffect(() => {
    if (open && property) {
      loadLpData();
    }
  }, [open, property]);

  const loadLpData = async () => {
    if (!property) return;
    
    try {
      setLpLoading(true);
      const { data, error } = await supabase
        .from('property_landing_pages')
        .select('*')
        .eq('property_id', property.id)
        .maybeSingle();
      
      if (data) {
        setLpData(data);
        setLpSlug(data.slug || '');
        setLpTitle(data.title || '');
        setLpPublished(data.is_published || false);
      } else {
        setLpData(null);
        // Sugerir slug baseado no ID
        setLpSlug(`imovel-${property.id}`);
        setLpTitle(property.title || 'Lindo Imóvel');
        setLpPublished(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLpLoading(false);
    }
  };

  const handleSaveLp = async () => {
    if (!lpSlug) {
      toast.error('O link (slug) é obrigatório.');
      return;
    }
    
    // Validar slug básico (letras, numeros, hifens)
    if (!/^[a-z0-9-]+$/.test(lpSlug)) {
      toast.error("O link deve conter apenas letras minúsculas, números e hifens.");
      return;
    }

    try {
      const payload = {
        property_id: Number(property!.id),
        slug: lpSlug,
        title: lpTitle,
        is_published: lpPublished,
        theme_color: '#3B82F6' // Padrão
      };

      if (lpData?.id) {
        const { error } = await supabase
          .from('property_landing_pages')
          .update(payload)
          .eq('id', lpData.id);
        if (error) throw error;
        toast.success("Landing Page atualizada!");
      } else {
        const { data, error } = await supabase
          .from('property_landing_pages')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setLpData(data);
        toast.success("Landing Page gerada com sucesso!");
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar LP. Link já existente?');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/imovel/${lpSlug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência!");
  };
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border-border text-foreground">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              {/* Título agora mostra o ID Listing */}
              <DialogTitle className="text-2xl text-foreground mb-2">
                <span className="text-foreground font-semibold">ID:</span>{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{(property as any).listing_id || '-'}</span>
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
            <h3 className="text-lg font-semibold text-foreground">Imagens</h3>
            {property.property_images && property.property_images.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {property.property_images.map((image, index) => (
                  <div key={image.id} className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img 
                      src={convertGoogleDriveUrl(image.image_url, 'medium')} 
                      alt={`${property.title} - Imagem ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        handleImageErrorWithFallback(e, image.image_url, '/placeholder-property.jpg');
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground">Nenhuma imagem disponível</span>
              </div>
            )}
          </div>

          {/* Informações */}
          <div className="space-y-6">
            {/* Preço */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Preço</h3>
              <div className="text-3xl font-bold text-foreground">
                R$ {property.price.toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Localização */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Localização</h3>
              <div className="flex items-center text-muted-foreground">
                <MapPin className="h-4 w-4 mr-2" />
                {property.address}, {property.city}
              </div>
            </div>

            {/* Características */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Características</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Square className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">Área</div>
                  <div className="font-semibold text-foreground">{property.area}m²</div>
                </div>
                {property.bedrooms && (
                  <div className="text-center">
                    <Bed className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Quartos</div>
                    <div className="font-semibold text-foreground">{property.bedrooms}</div>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="text-center">
                    <Bath className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Banheiros</div>
                    <div className="font-semibold text-foreground">{property.bathrooms}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Descrição */}
            {property.description && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Descrição</h3>
                <p className="text-muted-foreground leading-relaxed">{property.description}</p>
              </div>
            )}

            {/* Data de criação */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Informações Adicionais</h3>
              <div className="flex items-center text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2" />
                Cadastrado em {formatDate(property.created_at)}
              </div>

              <div className="mt-2 text-muted-foreground">
                <div className="text-sm">Disponibilidade atual: <span className="font-semibold">{(property as any).disponibilidade || 'disponivel'}</span></div>
                {(property as any).disponibilidade_observacao && (
                  <div className="text-xs text-muted-foreground/80">Obs: {(property as any).disponibilidade_observacao}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t border-border flex-wrap gap-4">
          <div className="flex gap-2 items-center flex-wrap">
            <Button 
              variant="outline"
              onClick={() => setLpOpen(true)}
              className="border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
            >
              <Globe className="h-4 w-4 mr-2" />
              Landing Page (LP)
            </Button>
            
            <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>
            
            <MarketingActionCards property={property as any} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="border-border text-foreground hover:bg-muted">
              Fechar
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setAvailValue(((property as any).disponibilidade || 'disponivel') as any);
                setAvailNote('');
                setAvailOpen(true);
              }}
              className="border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Shield className="h-4 w-4 mr-2" />
              Disponibilidade
            </Button>
          </div>
        </div>

        {/* Modal disponibilidade */}
        <Dialog open={availOpen} onOpenChange={setAvailOpen}>
          <DialogContent className="bg-background border-border text-foreground sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">Alterar disponibilidade</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Se marcar como Indisponível ou Reforma, descreva o motivo na observação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Select value={availValue} onValueChange={(v: any) => setAvailValue(v)}>
                  <SelectTrigger className="w-48 bg-background border-border text-foreground">
                    <SelectValue placeholder="Disponibilidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="indisponivel">Indisponível</SelectItem>
                    <SelectItem value="reforma">Reforma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Observação</label>
                <Textarea
                  value={availNote}
                  onChange={(e) => setAvailNote(e.target.value)}
                  className="mt-1 bg-background border-border text-foreground"
                  placeholder="Descreva o motivo quando marcar Indisponível ou Reforma"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" className="border-border text-foreground hover:bg-muted" onClick={() => setAvailOpen(false)}>
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
        {/* Modal Landing Page */}
        <Dialog open={lpOpen} onOpenChange={setLpOpen}>
          <DialogContent className="bg-background border-border text-foreground sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-500" />
                Landing Page Individual
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Gere uma página de divulgação exclusiva para este imóvel para captar leads.
              </DialogDescription>
            </DialogHeader>
            
            {lpLoading ? (
              <div className="py-8 text-center text-muted-foreground">Carregando dados da LP...</div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Título da LP</label>
                  <Input 
                    value={lpTitle}
                    onChange={e => setLpTitle(e.target.value)}
                    placeholder="Título chamativo..."
                    className="bg-background border-border text-foreground"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Link Personalizado (Slug)</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted text-muted-foreground sm:text-xs">
                      /imovel/
                    </span>
                    <Input 
                      value={lpSlug}
                      onChange={e => setLpSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="imovel-123"
                      className="rounded-l-none bg-background border-border text-foreground flex-1 text-sm pt-2"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <div 
                    className={`w-10 h-5 rounded-full flex items-center cursor-pointer transition-colors px-1 ${lpPublished ? 'bg-indigo-500' : 'bg-gray-600'}`}
                    onClick={() => setLpPublished(!lpPublished)}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${lpPublished ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {lpPublished ? 'Página Publicada' : 'Rascunho (Offline)'}
                  </span>
                </div>

                {lpPublished && lpData && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border mt-2">
                    <div className="text-xs text-muted-foreground mb-1">Seu link de divulgação:</div>
                    <div className="flex items-center gap-2">
                      <div className="text-indigo-700 dark:text-indigo-300 text-sm truncate flex-1">
                        {window.location.host}/imovel/{lpSlug}
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => window.open(`/imovel/${lpSlug}`, '_blank')}>
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-border">
                  <Button variant="outline" className="border-border text-foreground hover:bg-muted" onClick={() => setLpOpen(false)}>
                    Fechar
                  </Button>
                  <Button onClick={handleSaveLp} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {lpData ? 'Salvar Alterações' : 'Gerar Página'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
