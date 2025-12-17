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
import { convertMultipleToWebP } from '@/utils/imageUtils';
import { X, ImagePlus } from 'lucide-react';

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

  const onSelectImages = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const total = Math.min(15, list.length + images.length);
    const chosen = list.slice(0, total - images.length);
    try {
      const converted = await convertMultipleToWebP(chosen, 0.8, 1280, 960);
      setImages(prev => [...prev, ...converted]);
      const newPreviews = converted.map(f => URL.createObjectURL(f));
      setPreviews(prev => [...prev, ...newPreviews]);
    } catch (e) {
      toast.error('Falha ao processar imagens');
    }
  };

  const uploadImagesAndCollectUrls = async (imovelId: number): Promise<string[]> => {
    // Usar bucket existente do projeto para imagens (mesmo do Properties)
    const BUCKET = 'property-images';
    const urls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const path = `imoveisvivareal/${imovelId}/${Date.now()}_${i}.webp`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'image/webp', upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      urls.push(pub.publicUrl);
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
          await supabase.from('imoveisvivareal').update({ imagens: urls }).eq('id', created.id);
        } catch (imgErr: any) {
          // Não bloquear o sucesso da criação do imóvel; apenas avisar sobre imagens
          toast.error('Imóvel criado, mas houve erro ao salvar imagens.');
        }
      }

      toast.success('Imóvel criado com sucesso');
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
                      <Label className="m-0 text-white">Imagens (até 15)</Label>
                      <small className="text-gray-400">{images.length}/15</small>
                    </div>
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-700 text-gray-200 hover:bg-gray-800 cursor-pointer w-fit">
                      <ImagePlus className="w-4 h-4" />
                      <span>Adicionar fotos</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => onSelectImages(e.target.files)} 
                      />
                    </label>
                    {previews.length > 0 && (
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {previews.map((src, idx) => (
                          <div key={idx} className="relative">
                            <img 
                              src={src} 
                              className="w-full h-24 object-cover rounded-md border border-gray-700" 
                              alt={`Preview ${idx + 1}`}
                            />
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