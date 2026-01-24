import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImoveisVivaReal, ImovelVivaReal } from '@/hooks/useImoveisVivaReal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { convertMultipleToJPEG, downloadGoogleDriveImage, extractGoogleDriveFileId } from '@/utils/imageUtils';
import { X, ImagePlus, Link, Loader2 } from 'lucide-react';

interface AddImovelModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const AddImovelModal: React.FC<AddImovelModalProps> = ({ isOpen, onClose }) => {
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
  const [googleDriveLink, setGoogleDriveLink] = useState('');
  const [isDownloadingFromDrive, setIsDownloadingFromDrive] = useState(false);

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
    const digits = value.replace(/\D/g, '');
    const cents = digits ? parseInt(digits, 10) : 0;
    const num = cents / 100;
    setPriceDisplay(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num));
    setForm(prev => ({ ...prev, preco: num }));
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
      console.log(`✅ ${converted.length} imagem(ns) processadas com sucesso. Total: ${currentCount + converted.length}/${MAX_IMAGES}`);
      toast.success(`${converted.length} imagem(ns) processadas com sucesso!`);
    } catch (e) {
      console.error('Erro ao processar imagens:', e);
      toast.error('Falha ao processar imagens. Verifique se os arquivos são imagens válidas.');
    }
  };

  const onAddGoogleDriveImage = async () => {
    if (!googleDriveLink.trim()) {
      toast.warning('Cole um link do Google Drive válido.');
      return;
    }

    // Verificar se é um link válido do Google Drive
    const fileId = extractGoogleDriveFileId(googleDriveLink);
    if (!fileId) {
      toast.error('Link inválido. Use um link de compartilhamento do Google Drive (ex: https://drive.google.com/file/d/ID/view)');
      return;
    }

    const currentCount = images.length;
    if (currentCount >= MAX_IMAGES) {
      toast.warning(`Você já atingiu o limite de ${MAX_IMAGES} imagens.`);
      return;
    }

    setIsDownloadingFromDrive(true);
    
    try {
      console.log(`📥 Baixando imagem do Google Drive: ${fileId}`);
      toast.info('Baixando imagem do Google Drive...');
      
      const file = await downloadGoogleDriveImage(googleDriveLink, 1024 * 1024, 5 * 1024 * 1024);
      
      setImages(prev => [...prev, file]);
      setPreviews(prev => [...prev, URL.createObjectURL(file)]);
      setGoogleDriveLink(''); // Limpar o campo
      
      console.log(`✅ Imagem baixada e processada: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      toast.success(`Imagem baixada com sucesso! (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    } catch (e: any) {
      console.error('Erro ao baixar imagem do Google Drive:', e);
      toast.error(e.message || 'Falha ao baixar imagem. Verifique se o link está correto e público.');
    } finally {
      setIsDownloadingFromDrive(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index]);
      return newPreviews.filter((_, i) => i !== index);
    });
  };

  const uploadImagesAndCollectUrls = async (imovelId: number): Promise<string[]> => {
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
    
    // Processar resultados
    const urls: string[] = [];
    const errors: string[] = [];
    let bucketNotFound = false;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.success && data.url) {
          urls.push(data.url);
        } else {
          const errorMsg = data.error?.userMessage || data.error?.message || 'Erro desconhecido';
          errors.push(`Imagem ${index + 1}: ${errorMsg}`);
          
          // Verificar se é erro de bucket não encontrado
          if (errorMsg.includes('Bucket not found') || errorMsg.includes('bucket')) {
            bucketNotFound = true;
          }
        }
      } else {
        errors.push(`Imagem ${index + 1}: ${result.reason?.message || 'Erro desconhecido'}`);
      }
    });
    
    // Mostrar avisos sobre imagens que falharam
    if (errors.length > 0) {
      console.warn('⚠️ Algumas imagens falharam no upload:', errors);
      
      if (bucketNotFound && urls.length === 0) {
        // Se todas falharam por causa do bucket, mostrar mensagem específica
        toast.error('Bucket property-images não encontrado. O bucket precisa ser criado no Supabase Storage. Entre em contato com o administrador.');
      } else if (urls.length > 0) {
        toast.warning(`${errors.length} imagem(ns) falharam no upload. ${urls.length} imagem(ns) foram enviadas com sucesso.`);
      } else {
        toast.error(`Todas as ${errors.length} imagem(ns) falharam no upload. Verifique se o bucket property-images existe no Supabase Storage.`);
      }
    }
    
    return urls;
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
        features: null,
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
          const urls = await uploadImagesAndCollectUrls(created.id as number);
          
          if (urls.length > 0) {
            await supabase.from('imoveisvivareal').update({ imagens: urls }).eq('id', created.id);
            
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
      setImages([]); setPreviews([]);
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
          <DialogContent className="max-w-4xl h-[85vh] p-0 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 shadow-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25 }}
              className="relative h-full flex flex-col"
            >
              {/* Header fixo */}
              <div className="flex items-center justify-between p-6 pb-0">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Adicionar Imóvel</h2>
                  <p className="text-gray-400 text-sm">Preencha os dados conforme o cadastro interno.</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose} 
                  className="text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Conteúdo com scroll */}
              <div className="flex-1 overflow-y-auto p-6 pt-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Label className="text-white mb-2 block">Tipo do imóvel</Label>
                      <Select value={String(form.tipo_imovel || '')} onValueChange={(v) => updateField('tipo_imovel', v)}>
                        <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white hover:bg-gray-700/70">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent 
                          className="bg-gray-900 text-white border border-gray-700" 
                          style={{ zIndex: 9999 }}
                          position="popper"
                          sideOffset={5}
                        >
                          {tipos.map(opt => (
                            <SelectItem 
                              key={opt.value} 
                              value={opt.value}
                              className="text-white hover:bg-blue-500/30 focus:bg-blue-500/30 cursor-pointer"
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <Label className="text-white mb-2 block">Modalidade</Label>
                      <Select value={String(form.modalidade || '')} onValueChange={(v) => updateField('modalidade', v)}>
                        <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white hover:bg-gray-700/70">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent 
                          className="bg-gray-900 text-white border border-gray-700"
                          style={{ zIndex: 9999 }}
                          position="popper"
                          sideOffset={5}
                        >
                          {modalidades.map(opt => (
                            <SelectItem 
                              key={opt.value} 
                              value={opt.value}
                              className="text-white hover:bg-blue-500/30 focus:bg-blue-500/30 cursor-pointer"
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <Label className="text-white mb-2 block">Categoria</Label>
                      <Select value={String(form.tipo_categoria || '')} onValueChange={(v) => updateField('tipo_categoria', v)}>
                        <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white hover:bg-gray-700/70">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent 
                          className="bg-gray-900 text-white border border-gray-700"
                          style={{ zIndex: 9999 }}
                          position="popper"
                          sideOffset={5}
                        >
                          {categorias.map(opt => (
                            <SelectItem 
                              key={opt.value} 
                              value={opt.value}
                              className="text-white hover:bg-blue-500/30 focus:bg-blue-500/30 cursor-pointer"
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Preço</Label>
                      <Input 
                        inputMode="numeric" 
                        value={priceDisplay} 
                        onChange={(e) => handlePriceChange(e.target.value)} 
                        placeholder="R$ 0,00"
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Tamanho (m²)</Label>
                      <Input 
                        inputMode="numeric" 
                        value={form.tamanho_m2 ?? ''} 
                        onChange={(e) => handleOnlyInt(e.target.value, 'tamanho_m2')}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Quartos</Label>
                      <Input 
                        inputMode="numeric" 
                        value={form.quartos ?? ''} 
                        onChange={(e) => handleOnlyInt(e.target.value, 'quartos')}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Banheiros</Label>
                      <Input 
                        inputMode="numeric" 
                        value={form.banheiros ?? ''} 
                        onChange={(e) => handleOnlyInt(e.target.value, 'banheiros')}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Suítes</Label>
                      <Input 
                        inputMode="numeric" 
                        value={form.suite ?? ''} 
                        onChange={(e) => handleOnlyInt(e.target.value, 'suite')}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Garagem</Label>
                      <Input 
                        inputMode="numeric" 
                        value={form.garagem ?? ''} 
                        onChange={(e) => handleOnlyInt(e.target.value, 'garagem')}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-white mb-2 block">Descrição</Label>
                      <Textarea 
                        value={form.descricao ?? ''} 
                        onChange={e => updateField('descricao', e.target.value)} 
                        rows={3}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-white mb-2 block">Cidade</Label>
                      <Input 
                        value={form.cidade ?? ''} 
                        onChange={e => updateField('cidade', e.target.value)}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Bairro</Label>
                      <Input 
                        value={form.bairro ?? ''} 
                        onChange={e => updateField('bairro', e.target.value)}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">CEP</Label>
                      <Input 
                        value={form.cep ?? ''} 
                        onChange={e => updateField('cep', e.target.value.replace(/[^0-9]/g, ''))}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-white mb-2 block">Endereço</Label>
                      <Input 
                        value={form.endereco ?? ''} 
                        onChange={e => updateField('endereco', e.target.value)}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">Número</Label>
                      <Input 
                        value={form.numero ?? ''} 
                        onChange={e => updateField('numero', e.target.value.replace(/[^0-9]/g, ''))}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-white mb-2 block">Complemento</Label>
                      <Input 
                        value={form.complemento ?? ''} 
                        onChange={e => updateField('complemento', e.target.value)}
                        className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 hover:bg-gray-700/70"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="m-0 text-white">Imagens (até {MAX_IMAGES})</Label>
                      <small className="text-gray-400">{images.length}/{MAX_IMAGES}</small>
                    </div>
                    
                    {/* Opções de upload */}
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-700 text-gray-200 hover:bg-gray-800 cursor-pointer">
                        <ImagePlus className="w-4 h-4" />
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

                    {/* Upload via Google Drive Link */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Cole o link do Google Drive aqui..."
                          value={googleDriveLink}
                          onChange={(e) => setGoogleDriveLink(e.target.value)}
                          className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onAddGoogleDriveImage();
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={onAddGoogleDriveImage}
                        disabled={isDownloadingFromDrive || !googleDriveLink.trim()}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        {isDownloadingFromDrive ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Baixando...
                          </>
                        ) : (
                          'Adicionar'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Suporta links do formato: https://drive.google.com/file/d/ID/view
                    </p>

                    {/* Preview das imagens */}
                    {previews.length > 0 && (
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {previews.map((src, idx) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={src} 
                              className="w-full h-24 object-cover rounded-md border border-gray-700" 
                              alt={`Preview ${idx + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <span className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                              {idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer fixo */}
              <div className="border-t border-gray-700 p-6 pt-4">
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={onClose}
                    className="border-gray-700 text-red-400 hover:bg-gray-800 hover:text-red-300"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    disabled={!canSave || saving} 
                    onClick={handleSave}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
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