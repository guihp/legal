import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImoveisVivaReal, ImovelVivaReal } from '@/hooks/useImoveisVivaReal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { convertMultipleToJPEG, captionFromFilename } from '@/utils/imageUtils';
import { X, ImagePlus } from 'lucide-react';
import { FEATURE_OPTIONS } from '@/constants/imovelFeatures';
import { formatBRLInput, parseBRLInput } from '@/lib/brlInput';

const FIELD_CLASS = 'bg-background border-border text-foreground placeholder:text-muted-foreground';
const LABEL_CLASS = 'text-sm text-muted-foreground mb-2 block';
const SELECT_ITEM_CLASS = 'text-foreground focus:bg-emerald-50 focus:text-emerald-900 dark:focus:bg-emerald-950/40 dark:focus:text-emerald-100 cursor-pointer';

interface AddImovelModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, header shows edit title instead of “Adicionar Imóvel”. */
  mode?: 'create' | 'edit';
}

type Option = { value: string; label: string };

const translateTipoImovel = (v: string): string => {
  const map: Record<string, string> = {
    'Home': 'Casa',
    'Apartment': 'Apartamento',
    'Building': 'Prédio',
    'Condo': 'Condomínio',
    'Land Lot': 'Terreno',
    'Sobrado': 'Sobrado',
    'Loja': 'Loja',
    'Agricultural': 'Agrícola',
    'Studio': 'Studio',
    // Tolerância para valores alternativos que possam existir no banco
    'House': 'Casa',
    'Land': 'Terreno',
    'Store': 'Loja',
  };
  return map[v] || v;
};

const translateModalidade = (v: string): string => {
  const map: Record<string, string> = {
    'For Sale': 'Venda',
    'Rent': 'Aluguel',
    'Sale/Rent': 'Venda/Aluguel',
  };
  return map[v] || v;
};

const TIPOS_ALLOWED: string[] = [
  'Home', 'Apartment', 'Building', 'Condo', 'Land Lot', 'Sobrado', 'Loja', 'Agricultural', 'Studio'
];
const MODALIDADES_ALLOWED: string[] = ['For Sale', 'Rent', 'Sale/Rent'];
const CATEGORIAS_ALLOWED: string[] = ['Residential', 'Commercial'];

export const AddImovelModal: React.FC<AddImovelModalProps> = ({ isOpen, onClose, mode = 'create' }) => {
  const isEdit = mode === 'edit';
  const dialogTitle = isEdit ? 'Editar Imóvel' : 'Adicionar Imóvel';
  const dialogSubtitle = isEdit
    ? 'Atualize os dados conforme o cadastro interno.'
    : 'Preencha os dados conforme o cadastro interno.';

  const { createImovel } = useImoveisVivaReal();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ImovelVivaReal>>({
    listing_id: '',
    tipo_categoria: '',
    tipo_imovel: '',
    descricao: '',
    preco: null,
    tamanho_m2: null,
    quartos: null,
    banheiros: null,
    ano_construcao: null,
    suite: null,
    garagem: null,
    cidade: '',
    bairro: '',
    endereco: '',
    numero: '',
    complemento: '',
    cep: '',
    modalidade: '',
  });
  const [priceDisplay, setPriceDisplay] = useState('');
  const [tipos, setTipos] = useState<Option[]>([]);
  const [modalidades, setModalidades] = useState<Option[]>([]);
  const [categorias, setCategorias] = useState<Option[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // Legendas opcionais por imagem (max 50 chars) — mesmo índice de `images`/`previews`.
  // Salvas em imoveisvivareal.imagens_legendas (text[]) no insert.
  // Usadas pela IA do n8n via property-images-api pra escolher quais fotos enviar.
  const [imageCaptions, setImageCaptions] = useState<string[]>([]);
  const IMAGE_CAPTION_MAX = 50;
  const clampCaption = (s: string) => s.slice(0, IMAGE_CAPTION_MAX);
  // Features = amenidades selecionadas (gravadas em INGLÊS para casar com a tool
  // `buscar_por_features` do agente n8n — ver src/constants/imovelFeatures.ts).
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const toggleFeature = (value: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        // Auto listing_id (pega maior numérico e soma 1)
        const { data: rows } = await supabase
          .from('imoveisvivareal')
          .select('listing_id, created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        let maxNum = 0;
        (rows || []).forEach((r: any) => {
          const n = parseInt(String(r.listing_id || '').replace(/\D/g, ''), 10);
          if (!isNaN(n)) maxNum = Math.max(maxNum, n);
        });
        setForm(prev => ({ ...prev, listing_id: String(maxNum + 1) }));
      } finally {
        // Sempre usar listas canônicas exigidas pelo produto
        setTipos(TIPOS_ALLOWED.map(v => ({ value: v, label: translateTipoImovel(v) })));
        setModalidades(MODALIDADES_ALLOWED.map(v => ({ value: v, label: translateModalidade(v) })));
        setCategorias(CATEGORIAS_ALLOWED.map(v => ({ value: v, label: v === 'Residential' ? 'Residencial' : v === 'Commercial' ? 'Comercial' : v })));
      }
    })();
  }, [isOpen]);

  const canSave = useMemo(() => {
    const hasTipo = !!form.tipo_imovel && String(form.tipo_imovel).trim().length > 0;
    const hasModalidade = !!form.modalidade && String(form.modalidade).trim().length > 0;
    const hasPreco = typeof form.preco === 'number' && (form.preco as number) > 0;
    const hasCidade = !!form.cidade && String(form.cidade).trim().length > 0;
    const hasEndereco = !!form.endereco && String(form.endereco).trim().length > 0;
    return hasTipo && hasModalidade && hasPreco && hasCidade && hasEndereco;
  }, [form]);

  const updateField = (field: keyof ImovelVivaReal, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePriceChange = (value: string) => {
    const display = formatBRLInput(value);
    setPriceDisplay(display);
    setForm((prev) => ({ ...prev, preco: parseBRLInput(display) }));
  };

  const handleOnlyInt = (value: string, field: keyof ImovelVivaReal) => {
    const digits = value.replace(/\D/g, '');
    updateField(field, digits ? Number(digits) : null);
  };

  const MAX_IMAGES = 50; // Limite máximo de imagens por imóvel

  const onSelectImages = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const currentCount = images.length;
    const remainingSlots = MAX_IMAGES - currentCount;
    
    if (remainingSlots <= 0) {
      toast.warning(`Você já atingiu o limite de ${MAX_IMAGES} imagens.`);
      return;
    }
    
    const chosen = list.slice(0, remainingSlots);
    
    if (chosen.length < list.length) {
      toast.warning(`Apenas ${chosen.length} imagem(ns) foram selecionadas. Limite máximo: ${MAX_IMAGES} imagens.`);
    }
    
    try {
      console.log(`📸 Processando ${chosen.length} imagem(ns) de ${list.length} selecionadas...`);
      toast.info('Processando imagens para qualidade ideal (1-5MB)...');
      // Converter para JPEG com tamanho entre 1MB e 5MB (ideal para WhatsApp)
      const converted = await convertMultipleToJPEG(chosen, 1024 * 1024, 5 * 1024 * 1024, 1920, 1440);
      setImages(prev => [...prev, ...converted]);
      const newPreviews = converted.map(f => URL.createObjectURL(f));
      setPreviews(prev => [...prev, ...newPreviews]);
      // Pré-preenche legenda a partir do nome do arquivo (heurística: nome limpo
      // se não parecer padrão de câmera). Usuário pode editar/limpar antes de salvar.
      const suggestedCaptions = converted.map(f => captionFromFilename(f.name, IMAGE_CAPTION_MAX));
      setImageCaptions(prev => [...prev, ...suggestedCaptions]);
      console.log(`✅ ${converted.length} imagem(ns) processadas com sucesso. Total: ${currentCount + converted.length}/${MAX_IMAGES}`);
      toast.success(`${converted.length} imagem(ns) processadas com sucesso!`);
    } catch (e) {
      console.error('Erro ao processar imagens:', e);
      toast.error('Falha ao processar imagens. Verifique se os arquivos são imagens válidas.');
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index]);
      return newPreviews.filter((_, i) => i !== index);
    });
    // Mantém legendas sincronizadas com images/previews por índice.
    setImageCaptions(prev => prev.filter((_, i) => i !== index));
  };

  const updateImageCaption = (index: number, value: string) => {
    const trimmed = clampCaption(value);
    setImageCaptions(prev => {
      const next = [...prev];
      while (next.length <= index) next.push('');
      next[index] = trimmed;
      return next;
    });
  };

  const uploadImagesAndCollectUrls = async (imovelId: number): Promise<{ urls: string[]; captions: string[] }> => {
    // Usar bucket existente do projeto para imagens (mesmo do Properties)
    const BUCKET = 'property-images';
    
    // Verificar se o bucket existe, senão tentar criar via Edge Function
    console.log('🔍 Verificando bucket property-images...');
    let bucketExists = false;
    
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.warn('⚠️ Não foi possível listar buckets:', bucketsError);
      } else {
        const propertyImagesBucket = buckets?.find(bucket => bucket.name === BUCKET);
        if (propertyImagesBucket) {
          bucketExists = true;
          console.log('✅ Bucket property-images encontrado');
        }
      }
      
      // Se o bucket não existe, tentar criar via Edge Function (com SERVICE_ROLE)
      if (!bucketExists) {
        console.log('🪣 Tentando criar bucket property-images via Edge Function...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: functionResult, error: functionError } = await supabase.functions.invoke('ensure-storage-bucket', {
              body: { bucketName: BUCKET }
            });
            
            if (functionError) {
              console.warn('⚠️ Erro ao chamar função de criação de bucket:', functionError);
            } else if (functionResult?.success) {
              console.log('✅ Bucket criado via Edge Function');
              bucketExists = true;
            }
          }
        } catch (funcErr) {
          console.warn('⚠️ Erro ao chamar Edge Function, tentando criar diretamente...', funcErr);
          
          // Fallback: tentar criar diretamente (pode não ter permissão)
          const { error: createBucketError } = await supabase.storage.createBucket(BUCKET, {
            public: true,
            allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/jpg'],
            fileSizeLimit: 5242880 // 5MB
          });
          
          if (!createBucketError) {
            console.log('✅ Bucket criado diretamente');
            bucketExists = true;
          } else {
            console.warn('⚠️ Não foi possível criar bucket. Continuando com upload...', createBucketError);
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Erro ao verificar/criar bucket, continuando mesmo assim:', err);
    }
    
    // Upload em paralelo para melhor performance
    // Usar Promise.allSettled para não parar se uma imagem falhar
    const baseTimestamp = Date.now();
    const uploadPromises = images.map(async (file, i) => {
      // Usar timestamp único para cada imagem (adicionar índice e pequeno delay)
      const timestamp = baseTimestamp + i;
      const path = `imoveisvivareal/${imovelId}/${timestamp}_${i}.jpg`;
      
      try {
        console.log(`📤 Fazendo upload da imagem ${i + 1}/${images.length}: ${path} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { 
            contentType: 'image/jpeg', 
            upsert: false 
          });
        
        if (error) {
          console.error(`❌ Erro ao fazer upload da imagem ${i + 1}:`, error);
          
          // Se o erro for "Bucket not found", fornecer mensagem mais clara
          if (error.message?.includes('Bucket not found') || error.error === 'Bucket not found') {
            return { 
              success: false, 
              index: i, 
              error: { 
                ...error, 
                userMessage: 'Bucket property-images não encontrado. Entre em contato com o administrador para criar o bucket no Supabase Storage.' 
              } 
            };
          }
          
          return { success: false, index: i, error };
        }
        
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        console.log(`✅ Imagem ${i + 1} enviada com sucesso:`, pub.publicUrl);
        return { success: true, index: i, url: pub.publicUrl };
      } catch (err: any) {
        console.error(`❌ Falha no upload da imagem ${i + 1}:`, err);
        return { success: false, index: i, error: err };
      }
    });
    
    // Aguardar todos os uploads (mesmo os que falharam)
    const results = await Promise.allSettled(uploadPromises);

    // Processar resultados — mantém pares (url, legenda) por sourceIdx pra
    // legendas casarem certinho mesmo se promises completarem fora de ordem
    // ou se alguma imagem do meio falhar.
    const pairs: Array<{ url: string; caption: string; sourceIdx: number }> = [];
    const errors: string[] = [];
    let bucketNotFound = false;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.success && data.url) {
          pairs.push({
            url: data.url,
            caption: clampCaption(imageCaptions[data.index] || ''),
            sourceIdx: data.index,
          });
        } else {
          const errorMsg = data.error?.userMessage || data.error?.message || 'Erro desconhecido';
          errors.push(`Imagem ${index + 1}: ${errorMsg}`);

          if (errorMsg.includes('Bucket not found') || errorMsg.includes('bucket')) {
            bucketNotFound = true;
          }
        }
      } else {
        errors.push(`Imagem ${index + 1}: ${result.reason?.message || 'Erro desconhecido'}`);
      }
    });

    // Ordena por sourceIdx para garantir que ordem das URLs reflete ordem
    // que o usuário viu nos previews (e não ordem de conclusão dos uploads).
    pairs.sort((a, b) => a.sourceIdx - b.sourceIdx);

    if (errors.length > 0) {
      console.warn('⚠️ Algumas imagens falharam no upload:', errors);

      if (bucketNotFound && pairs.length === 0) {
        toast.error('Bucket property-images não encontrado. O bucket precisa ser criado no Supabase Storage. Entre em contato com o administrador.');
      } else if (pairs.length > 0) {
        toast.warning(`${errors.length} imagem(ns) falharam no upload. ${pairs.length} imagem(ns) foram enviadas com sucesso.`);
      } else {
        toast.error(`Todas as ${errors.length} imagem(ns) falharam no upload. Verifique se o bucket property-images existe no Supabase Storage.`);
      }
    }

    return {
      urls: pairs.map(p => p.url),
      captions: pairs.map(p => p.caption),
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: any = {
        listing_id: form.listing_id || null,
        imagens: null,
        tipo_categoria: form.tipo_categoria || null,
        tipo_imovel: form.tipo_imovel || null,
        descricao: form.descricao || null,
        preco: typeof form.preco === 'number' ? form.preco : null,
        tamanho_m2: typeof form.tamanho_m2 === 'number' ? form.tamanho_m2 : null,
        quartos: typeof form.quartos === 'number' ? form.quartos : null,
        banheiros: typeof form.banheiros === 'number' ? form.banheiros : null,
        ano_construcao: typeof form.ano_construcao === 'number' ? form.ano_construcao : null,
        suite: typeof form.suite === 'number' ? form.suite : null,
        garagem: typeof form.garagem === 'number' ? form.garagem : null,
        features: selectedFeatures.length > 0 ? selectedFeatures : null,
        andar: (form as any).andar ? Number((form as any).andar) : null,
        blocos: (form as any).blocos ? Number((form as any).blocos) : null,
        cidade: form.cidade || null,
        bairro: form.bairro || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        cep: form.cep || null,
        modalidade: form.modalidade || null,
        disponibilidade: 'disponivel',
      };

      const created = await createImovel(payload);
      if (!created) throw new Error('Falha ao inserir imóvel');

      if (images.length > 0) {
        try {
          const { urls, captions } = await uploadImagesAndCollectUrls(created.id as number);

          if (urls.length > 0) {
            // Persist imagens E imagens_legendas (mesmo índice).
            await supabase
              .from('imoveisvivareal')
              .update({ imagens: urls, imagens_legendas: captions })
              .eq('id', created.id);

            if (urls.length < images.length) {
              toast.warning(`Imóvel criado! ${urls.length} de ${images.length} imagens foram salvas com sucesso.`);
            } else {
              toast.success(`Imóvel criado com ${urls.length} imagem(ns)!`);
            }
          } else {
            toast.warning('Imóvel criado, mas nenhuma imagem foi salva. Tente adicionar as imagens novamente editando o imóvel.');
          }
        } catch (imgErr: any) {
          console.error('Erro ao processar imagens:', imgErr);
          toast.error('Imóvel criado, mas houve erro ao salvar imagens. Tente adicionar as imagens novamente editando o imóvel.');
        }
      } else {
        toast.success('Imóvel criado com sucesso');
      }

      if (images.length === 0) {
        toast.success('Imóvel criado com sucesso');
      }
      onClose();
      setImages([]); setPreviews([]); setImageCaptions([]); setSelectedFeatures([]);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar imóvel');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-4xl w-[min(100%,56rem)] h-[85vh] max-h-[92vh] flex flex-col gap-0 overflow-hidden p-0 bg-background border-border text-foreground sm:rounded-2xl shadow-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25 }}
              className="relative h-full min-h-0 flex flex-col"
            >
              {/* Header — dark forest */}
              <div
                className="flex-shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5"
                style={{ backgroundColor: '#1a2e24' }}
              >
                <DialogHeader className="space-y-1.5 text-left min-w-0 flex-1">
                  <DialogTitle className="text-lg sm:text-xl font-semibold" style={{ color: '#ffffff' }}>
                    {dialogTitle}
                  </DialogTitle>
                  <DialogDescription className="text-sm" style={{ color: '#a3a3a3' }}>
                    {dialogSubtitle}
                  </DialogDescription>
                </DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-9 w-9 rounded-lg hover:bg-white/10 shrink-0"
                  aria-label="Fechar"
                  style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.25)' }}
                >
                  <X className="h-4 w-4" style={{ color: '#ffffff' }} />
                </Button>
              </div>

              {/* Body — cream / light */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 bg-[#F7F5F0] dark:bg-background">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Label className={LABEL_CLASS}>Tipo do imóvel</Label>
                      <Select value={String(form.tipo_imovel || '')} onValueChange={(v) => updateField('tipo_imovel', v)}>
                        <SelectTrigger className={FIELD_CLASS}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent
                          className="bg-background text-foreground border border-border"
                          style={{ zIndex: 9999 }}
                          position="popper"
                          sideOffset={5}
                        >
                          {tipos.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={SELECT_ITEM_CLASS}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <Label className={LABEL_CLASS}>Modalidade</Label>
                      <Select value={String(form.modalidade || '')} onValueChange={(v) => updateField('modalidade', v)}>
                        <SelectTrigger className={FIELD_CLASS}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent
                          className="bg-background text-foreground border border-border"
                          style={{ zIndex: 9999 }}
                          position="popper"
                          sideOffset={5}
                        >
                          {modalidades.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={SELECT_ITEM_CLASS}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <Label className={LABEL_CLASS}>Categoria</Label>
                      <Select value={String(form.tipo_categoria || '')} onValueChange={(v) => updateField('tipo_categoria', v)}>
                        <SelectTrigger className={FIELD_CLASS}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent
                          className="bg-background text-foreground border border-border"
                          style={{ zIndex: 9999 }}
                          position="popper"
                          sideOffset={5}
                        >
                          {categorias.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={SELECT_ITEM_CLASS}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Preço</Label>
                      <Input
                        inputMode="numeric"
                        value={priceDisplay}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        placeholder="R$ 0,00"
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Tamanho (m²)</Label>
                      <Input
                        inputMode="numeric"
                        value={form.tamanho_m2 ?? ''}
                        onChange={(e) => handleOnlyInt(e.target.value, 'tamanho_m2')}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Quartos</Label>
                      <Input
                        inputMode="numeric"
                        value={form.quartos ?? ''}
                        onChange={(e) => handleOnlyInt(e.target.value, 'quartos')}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Banheiros</Label>
                      <Input
                        inputMode="numeric"
                        value={form.banheiros ?? ''}
                        onChange={(e) => handleOnlyInt(e.target.value, 'banheiros')}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Suítes</Label>
                      <Input
                        inputMode="numeric"
                        value={form.suite ?? ''}
                        onChange={(e) => handleOnlyInt(e.target.value, 'suite')}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Garagem</Label>
                      <Input
                        inputMode="numeric"
                        value={form.garagem ?? ''}
                        onChange={(e) => handleOnlyInt(e.target.value, 'garagem')}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className={LABEL_CLASS}>Descrição</Label>
                      <Textarea
                        value={form.descricao ?? ''}
                        onChange={e => updateField('descricao', e.target.value)}
                        rows={3}
                        className={FIELD_CLASS}
                      />
                    </div>

                    {/*
                      Características / amenidades — selecionar as que se aplicam.
                      Os valores são salvos em INGLÊS para alimentar a tool
                      `buscar_por_features` do agente n8n (ver
                      src/constants/imovelFeatures.ts).
                    */}
                    <div className="md:col-span-2">
                      <Label className={LABEL_CLASS}>Características</Label>
                      <div className="flex flex-wrap gap-2">
                        {FEATURE_OPTIONS.map((opt) => {
                          const active = selectedFeatures.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => toggleFeature(opt.value)}
                              className={
                                'px-3 py-1.5 rounded-full text-sm border transition-colors ' +
                                (active
                                  ? 'btn-on-emerald bg-emerald-800 border-emerald-700 text-white hover:bg-emerald-700'
                                  : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground')
                              }
                              aria-pressed={active}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedFeatures.length === 0
                          ? 'Nenhuma característica selecionada'
                          : `${selectedFeatures.length} selecionada${selectedFeatures.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className={LABEL_CLASS}>Cidade</Label>
                      <Input
                        value={form.cidade ?? ''}
                        onChange={e => updateField('cidade', e.target.value)}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Bairro</Label>
                      <Input
                        value={form.bairro ?? ''}
                        onChange={e => updateField('bairro', e.target.value)}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>CEP</Label>
                      <Input
                        value={form.cep ?? ''}
                        onChange={e => updateField('cep', e.target.value.replace(/[^0-9]/g, ''))}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className={LABEL_CLASS}>Endereço</Label>
                      <Input
                        value={form.endereco ?? ''}
                        onChange={e => updateField('endereco', e.target.value)}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <Label className={LABEL_CLASS}>Número</Label>
                      <Input
                        value={form.numero ?? ''}
                        onChange={e => updateField('numero', e.target.value.replace(/[^0-9]/g, ''))}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className={LABEL_CLASS}>Complemento</Label>
                      <Input
                        value={form.complemento ?? ''}
                        onChange={e => updateField('complemento', e.target.value)}
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="m-0 text-sm text-muted-foreground">Imagens (até {MAX_IMAGES})</Label>
                      <small className="text-muted-foreground">{images.length}/{MAX_IMAGES}</small>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background text-foreground hover:bg-muted cursor-pointer text-sm">
                        <ImagePlus className="w-4 h-4 text-muted-foreground" />
                        <span>Do computador</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => onSelectImages(e.target.files)}
                        />
                      </label>
                    </div>

                    {previews.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Adicione uma descrição curta (opcional, max {IMAGE_CAPTION_MAX} chars) para cada foto.
                          A IA do WhatsApp usa pra escolher quais fotos enviar quando o cliente pedir algo
                          específico (ex.: &quot;fotos da piscina&quot;).
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {previews.map((src, idx) => {
                            const cap = imageCaptions[idx] || '';
                            return (
                              <div key={idx} className="flex flex-col gap-1">
                                <div className="relative group">
                                  <img
                                    src={src}
                                    className="w-full h-24 object-cover rounded-md border border-border"
                                    alt={`Preview ${idx + 1}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(idx)}
                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    style={{ color: '#ffffff' }}
                                  >
                                    <X className="h-3 w-3" style={{ color: '#ffffff' }} />
                                  </button>
                                  <span
                                    className="absolute bottom-1 left-1 bg-black/70 text-xs px-1 rounded"
                                    style={{ color: '#ffffff' }}
                                  >
                                    {idx + 1}
                                  </span>
                                </div>
                                <Input
                                  value={cap}
                                  maxLength={IMAGE_CAPTION_MAX}
                                  placeholder="Descrição (opcional)"
                                  onChange={(e) => updateImageCaption(idx, e.target.value)}
                                  className={`${FIELD_CLASS} text-xs h-7`}
                                />
                                <span className="text-[10px] text-muted-foreground text-right">
                                  {cap.length}/{IMAGE_CAPTION_MAX}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 border-t border-border bg-background px-5 sm:px-6 py-4">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={!canSave || saving}
                    onClick={handleSave}
                    className="btn-on-emerald bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50"
                    style={{ color: '#ffffff' }}
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default AddImovelModal;