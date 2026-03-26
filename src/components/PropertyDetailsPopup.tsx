
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Bed, Bath, Square, Calendar, X, Shield, Globe, Link as LinkIcon, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [galleryIndex, setGalleryIndex] = useState(0);

  /* LP: carrega só ao abrir o modal (evita request a cada abertura do popup do imóvel) */
  useEffect(() => {
    if (!lpOpen || !property) return;
    loadLpData();
    // loadLpData usa `property` e `profile` atuais ao abrir o modal LP
    // eslint-disable-next-line react-hooks/exhaustive-deps -- disparamos só por lpOpen / troca de imóvel
  }, [lpOpen, property?.id]);

  useEffect(() => {
    if (open && property) {
      setGalleryIndex(0);
    }
  }, [open, property?.id]);

  const resolveLpCompanyId = (): string | null => {
    const fromProperty = (property as { company_id?: string | null })?.company_id;
    return profile?.company_id ?? fromProperty ?? null;
  };

  const loadLpData = async () => {
    if (!property) return;
    const companyId = resolveLpCompanyId();
    if (!companyId) {
      toast.error('Não foi possível identificar a empresa do imóvel.');
      return;
    }

    try {
      setLpLoading(true);
      const { data, error } = await supabase
        .from('property_landing_pages')
        .select('*')
        .eq('property_id', property.id)
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) {
        console.error(error);
        toast.error('Erro ao carregar dados da landing page.');
        return;
      }

      if (data) {
        setLpData(data);
        setLpSlug((data as { slug?: string }).slug || '');
        setLpTitle((data as { page_title?: string | null }).page_title || '');
        setLpPublished(!!(data as { is_published?: boolean }).is_published);
      } else {
        setLpData(null);
        setLpSlug(`imovel-${property.id}`);
        setLpTitle(property.title || '');
        setLpPublished(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar landing page.');
    } finally {
      setLpLoading(false);
    }
  };

  const handleSaveLp = async () => {
    if (!lpSlug) {
      toast.error('O link (slug) é obrigatório.');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(lpSlug)) {
      toast.error('O link deve conter apenas letras minúsculas, números e hifens.');
      return;
    }

    const companyId = resolveLpCompanyId();
    if (!companyId) {
      toast.error('Empresa não identificada. Faça login novamente.');
      return;
    }

    const propertyCompanyId = (property as { company_id?: string | null })?.company_id;
    if (propertyCompanyId && propertyCompanyId !== companyId) {
      toast.error('Este imóvel não pertence à sua empresa.');
      return;
    }

    try {
      const pageTitle = lpTitle.trim() || null;

      if (lpData?.id) {
        const { error } = await supabase
          .from('property_landing_pages')
          .update({
            slug: lpSlug,
            is_published: lpPublished,
            page_title: pageTitle,
          })
          .eq('id', lpData.id)
          .eq('company_id', companyId);
        if (error) throw error;
        setLpData({ ...lpData, slug: lpSlug, is_published: lpPublished, page_title: pageTitle });
        toast.success('Landing page atualizada!');
      } else {
        const { data, error } = await supabase
          .from('property_landing_pages')
          .insert({
            property_id: Number(property!.id),
            company_id: companyId,
            slug: lpSlug,
            is_published: lpPublished,
            page_title: pageTitle,
          })
          .select()
          .single();
        if (error) throw error;
        setLpData(data);
        toast.success('Landing page criada com sucesso!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Erro ao salvar. O slug pode já estar em uso por outro imóvel.');
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

  const galleryImages = property.property_images ?? [];
  const galleryLen = galleryImages.length;
  const activeGalleryIndex = galleryLen > 0 ? Math.min(galleryIndex, galleryLen - 1) : 0;
  const activeGalleryImage = galleryLen > 0 ? galleryImages[activeGalleryIndex] : null;

  const goPrevImage = () => {
    if (galleryLen < 2) return;
    setGalleryIndex((i) => (i - 1 + galleryLen) % galleryLen);
  };

  const goNextImage = () => {
    if (galleryLen < 2) return;
    setGalleryIndex((i) => (i + 1) % galleryLen);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[min(100%,896px)] max-h-[90vh] flex flex-col gap-0 overflow-hidden p-0 bg-background border-border text-foreground">
        <div className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border/60">
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
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden">
          {/* Galeria: preview fixo + miniaturas com scroll próprio */}
          <div className="flex w-full flex-shrink-0 flex-col border-b border-border/60 bg-muted/25 lg:w-[min(100%,380px)] lg:overflow-hidden lg:border-b-0 lg:border-r">
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="flex flex-shrink-0 items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-foreground">Imagens</h3>
                {galleryLen > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {activeGalleryIndex + 1} / {galleryLen}
                  </span>
                )}
              </div>

              <div className="relative flex w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted">
                {activeGalleryImage ? (
                  <>
                    <img
                      src={convertGoogleDriveUrl(activeGalleryImage.image_url, 'full')}
                      alt={`${property.title} - Imagem ${activeGalleryIndex + 1}`}
                      className="max-h-[min(28vh,220px)] min-h-[160px] w-full object-contain sm:min-h-[200px] sm:max-h-[min(38vh,320px)]"
                      loading="eager"
                      onError={(e) => {
                        handleImageErrorWithFallback(e, activeGalleryImage.image_url, '/placeholder-property.jpg');
                      }}
                    />
                    {galleryLen > 1 && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-border bg-background/90 shadow-md hover:bg-background"
                          onClick={goPrevImage}
                          aria-label="Imagem anterior"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-border bg-background/90 shadow-md hover:bg-background"
                          onClick={goNextImage}
                          aria-label="Próxima imagem"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[200px] w-full items-center justify-center py-12">
                    <span className="text-muted-foreground">Nenhuma imagem disponível</span>
                  </div>
                )}
              </div>

              {galleryLen > 1 && (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <p className="mb-2 text-xs text-muted-foreground">Clique na miniatura para ampliar</p>
                  <div className="max-h-[min(24vh,200px)] overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] sm:max-h-[min(30vh,240px)]">
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {galleryImages.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setGalleryIndex(index)}
                          className={cn(
                            'aspect-video overflow-hidden rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            index === activeGalleryIndex
                              ? 'border-primary ring-2 ring-primary/25'
                              : 'border-transparent opacity-85 hover:opacity-100'
                          )}
                        >
                          <img
                            src={convertGoogleDriveUrl(image.image_url, 'thumbnail')}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              handleImageErrorWithFallback(e, image.image_url, '/placeholder-property.jpg');
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informações — scroll independente */}
          <div className="min-h-0 flex-1 p-6 lg:overflow-y-auto lg:overscroll-contain">
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
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-4">
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
                  <label className="text-sm text-muted-foreground">Título da página (opcional)</label>
                  <Input
                    value={lpTitle}
                    onChange={(e) => setLpTitle(e.target.value)}
                    placeholder="Ex.: Casa 3 quartos no Turú — aparece no título do navegador"
                    className="bg-background border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se vazio, usamos os dados do imóvel na página pública.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Link personalizado (slug)</label>
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

                {lpPublished ? (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border mt-2">
                    <div className="text-xs text-muted-foreground mb-1">Link público (ativo após salvar):</div>
                    <div className="flex items-center gap-2">
                      <div className="text-indigo-700 dark:text-indigo-300 text-sm truncate flex-1">
                        {`${window.location.origin}/imovel/${lpSlug}`}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={handleCopyLink}
                        disabled={!lpSlug}
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => window.open(`/imovel/${lpSlug}`, '_blank')}
                        disabled={!lpSlug}
                      >
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    {!lpData?.id && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Clique em &quot;Salvar&quot; para registrar a página e tornar o link acessível.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border bg-muted/30 p-3">
                    Com o modo rascunho, o link <span className="font-mono">/imovel/{lpSlug || '…'}</span> não fica
                    público. Ative &quot;Publicada&quot; e salve para divulgar.
                  </p>
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
