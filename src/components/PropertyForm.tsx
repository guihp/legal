import { useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, X, Sparkles, Home, User, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { logAudit } from "@/lib/audit/logger";
import { PropertyFormFields } from "./PropertyFormFields";
import { PropertyImageManager } from "./PropertyImageManager";

// Função para gerar UUID v4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type PropertyType = Tables<'properties'>['type'];
type PropertyStatus = Tables<'properties'>['status'];

interface PropertyFormProps {
  isOpen: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PropertyForm({ isOpen, onSubmit, onCancel }: PropertyFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    propertyCode: "",
    title: "",
    type: "" as PropertyType,
    property_purpose: "Aluguel" as "Aluguel" | "Venda",
    price: "",
    area: "",
    bedrooms: "",
    bathrooms: "",
    address: "",
    city: "",
    state: "",
    status: "available" as PropertyStatus,
    description: "",
    proprietario_nome: "",
    proprietario_estado_civil: "",
    proprietario_cpf: "",
    proprietario_endereco: "",
    proprietario_email: "",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  const checkPropertyCodeExists = async (code: string) => {
    if (!code.trim()) return false;
    
    console.log('🔍 Verificando se código de referência existe:', code.trim());
    setCheckingCode(true);
    try {
      // Buscar propriedades que tenham o código no título
      const { data, error } = await supabase
        .from('properties')
        .select('id, title')
        .like('title', `[${code.trim()}]%`);

      console.log('📊 Resultado da verificação:', { data, error });

      if (error) {
        console.error('❌ Erro ao verificar código:', error);
        return false;
      }

      const exists = (data && data.length > 0);
      console.log('✅ Código já existe?', exists);
      return exists;
    } catch (error) {
      console.error('💥 Erro na verificação:', error);
      return false;
    } finally {
      setCheckingCode(false);
    }
  };

  const handleCodeBlur = async () => {
    if (!formData.propertyCode.trim()) return;

    console.log('👀 Verificando código ao sair do campo:', formData.propertyCode);
    const exists = await checkPropertyCodeExists(formData.propertyCode);
    if (exists) {
      toast({
        title: "Código já existe",
        description: "Este código de referência já está sendo usado. Por favor, escolha outro.",
        variant: "destructive",
      });
      setFormData(prev => ({ ...prev, propertyCode: "" }));
    }
  };

  const uploadImages = async (propertyId: string) => {
    console.log('📤 Iniciando upload de imagens WebP para propriedade:', propertyId);
    console.log('📸 Quantidade de imagens:', imageFiles.length);

    // Verificar se o bucket existe, senão criar
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
    } else {
      const propertyImagesBucket = buckets.find(bucket => bucket.name === 'property-images');
      if (!propertyImagesBucket) {
        console.log('🪣 Criando bucket property-images...');
        const { error: createBucketError } = await supabase.storage.createBucket('property-images', {
          public: true,
          allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/jpg'],
          fileSizeLimit: 5242880 // 5MB
        });
        
        if (createBucketError) {
          console.error('❌ Erro ao criar bucket:', createBucketError);
        } else {
          console.log('✅ Bucket criado com sucesso');
        }
      }
    }

    const uploadPromises = imageFiles.map(async (file, index) => {
      // Como as imagens já foram convertidas para WebP, usar sempre .webp
      const fileName = `${propertyId}/${Date.now()}_${index}.webp`;
      
      console.log('⬆️ Fazendo upload WebP:', fileName, 'Tamanho:', (file.size / 1024).toFixed(2), 'KB');

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(fileName, file, {
          contentType: 'image/webp',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(fileName);

      console.log('🔗 URL pública WebP:', publicUrl);

      const { error: insertError } = await supabase
        .from('property_images')
        .insert({
          property_id: propertyId,
          image_url: publicUrl,
          image_order: index
        });

      if (insertError) {
        console.error('❌ Erro ao inserir no banco:', insertError);
        throw insertError;
      }
      
      console.log('✅ Imagem WebP salva com sucesso');
      return publicUrl;
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    console.log('🚀 Iniciando submissão do formulário');
    console.log('📝 Dados do formulário:', formData);

    // Validação de campos obrigatórios
    if (!formData.propertyCode?.trim()) {
      console.log('❌ Código da propriedade não preenchido');
      toast({
        title: "Campo obrigatório",
        description: "Por favor, preencha o código da propriedade.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title?.trim() || !formData.type || !formData.property_purpose || !formData.price || !formData.area || !formData.address?.trim() || !formData.city?.trim() || !formData.state?.trim()) {
      console.log('❌ Campos obrigatórios não preenchidos');
      toast({
        title: "Erro no formulário",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se o preço e área são números válidos
    const priceNum = parseFloat(formData.price);
    const areaNum = parseFloat(formData.area);
    
    if (isNaN(priceNum) || priceNum <= 0) {
      console.log('❌ Preço inválido');
      toast({
        title: "Preço inválido",
        description: "Por favor, insira um preço válido maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(areaNum) || areaNum <= 0) {
      console.log('❌ Área inválida');
      toast({
        title: "Área inválida",
        description: "Por favor, insira uma área válida maior que zero.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se o código de referência já existe
    console.log('🔍 Verificação final do código de referência...');
    const codeExists = await checkPropertyCodeExists(formData.propertyCode);
    if (codeExists) {
      console.log('❌ Código de referência já existe na verificação final');
      toast({
        title: "Código já existe",
        description: "Este código de referência já está sendo usado. Por favor, escolha outro.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('💾 Inserindo propriedade no banco...');
      
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      
      // Gerar UUID para o ID e usar o código no título
      const propertyId = generateUUID();
      const propertyTitle = formData.propertyCode.trim() ? 
        `[${formData.propertyCode.trim()}] ${formData.title.trim()}` : 
        formData.title.trim();
      
      // Preparar dados para inserção
      const propertyData = {
        id: propertyId,
        title: propertyTitle,
        type: formData.type, // Campo correto é 'type', não 'property_type'
        property_purpose: formData.property_purpose, // Adicionar campo de finalidade
        price: priceNum,
        area: areaNum,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : 0,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : 0,
        address: formData.address.trim(),
        city: formData.city?.trim() || '', // Adicionar campo city
        state: formData.state?.trim() || '', // Adicionar campo state
        status: formData.status,
        description: formData.description?.trim() || '',
        proprietario_nome: formData.proprietario_nome?.trim() || null,
        proprietario_estado_civil: formData.proprietario_estado_civil?.trim() || null,
        proprietario_cpf: formData.proprietario_cpf?.trim() || null,  
        proprietario_endereco: formData.proprietario_endereco?.trim() || null,
        proprietario_email: formData.proprietario_email?.trim() || null,
        user_id: user.id // Adicionar user_id automaticamente
      };

      console.log('📋 Dados preparados para inserção:', propertyData);

      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .insert(propertyData)
        .select()
        .single();

      console.log('📊 Resultado da inserção:', { property, propertyError });

      if (propertyError) {
        console.error('❌ Erro ao inserir propriedade:', propertyError);
        throw new Error(`Erro na inserção: ${propertyError.message}`);
      }

      console.log('✅ Propriedade inserida com sucesso:', property);

      // Log de auditoria
      try {
        await logAudit({
          action: 'property.created',
          resource: 'property',
          resourceId: property.id,
          meta: {
            title: property.title,
            type: property.type,
            property_purpose: property.property_purpose,
            price: property.price,
            city: property.city,
            address: property.address
          }
        });
      } catch (auditError) {
        console.warn('Erro no log de auditoria:', auditError);
      }

      // Upload images if any
      if (imageFiles.length > 0) {
        console.log('📤 Iniciando upload de imagens...');
        await uploadImages(property.id);
        console.log('✅ Upload de imagens concluído');

        // Log de auditoria para upload de imagens
        try {
          await logAudit({
            action: 'property.images_uploaded',
            resource: 'property',
            resourceId: property.id,
            meta: {
              images_count: imageFiles.length,
              property_title: property.title
            }
          });
        } catch (auditError) {
          console.warn('Erro no log de auditoria para imagens:', auditError);
        }
      }

      console.log('🎉 Processo concluído com sucesso');
      toast({
        title: "Sucesso!",
        description: "Propriedade adicionada com sucesso.",
      });

      onSubmit();
    } catch (error) {
      console.error('💥 Erro geral:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro",
        description: `Erro ao adicionar propriedade: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    console.log('✏️ Alterando campo:', field, '=', value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.propertyCode?.trim() && formData.title?.trim() && formData.type && formData.property_purpose && formData.price && formData.area;
      case 2:
        return formData.address?.trim() && formData.city?.trim() && formData.state?.trim();
      case 3:
        return true; // Step de imagens é opcional
      default:
        return false;
    }
  };

  const renderStep = () => {
    const stepConfig = {
      1: {
        icon: Building2,
        title: 'Dados do Imóvel',
        description: 'Informações básicas da propriedade',
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-500/10 to-cyan-500/10',
      },
      2: {
        icon: User,
        title: 'Localização e Proprietário',
        description: 'Endereço e dados do proprietário',
        gradient: 'from-green-500 to-emerald-500',
        bgGradient: 'from-green-500/10 to-emerald-500/10',
      },
      3: {
        icon: FileImage,
        title: 'Imagens',
        description: 'Adicione fotos do imóvel (opcional)',
        gradient: 'from-purple-500 to-pink-500',
        bgGradient: 'from-purple-500/10 to-pink-500/10',
      },
    };

    const config = stepConfig[step as keyof typeof stepConfig];
    const Icon = config.icon;

    return (
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header com ícone */}
        <div className="text-center space-y-4">
          <motion.div
            className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br ${config.bgGradient} backdrop-blur-sm border border-white/10 flex items-center justify-center`}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Icon className="w-8 h-8 text-white" />
          </motion.div>
          
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{config.title}</h3>
            <p className="text-gray-400 text-sm">{config.description}</p>
          </div>
        </div>

        {/* Conteúdo do step */}
        <div className="space-y-4">
          {step === 1 && (
            <PropertyFormFields 
              formData={formData} 
              onChange={handleChange}
              onCodeBlur={handleCodeBlur}
              checkingCode={checkingCode}
              step={1}
            />
          )}

          {step === 2 && (
            <PropertyFormFields 
              formData={formData} 
              onChange={handleChange}
              onCodeBlur={handleCodeBlur}
              checkingCode={checkingCode}
              step={2}
            />
          )}

          {step === 3 && (
            <PropertyImageManager
              existingImages={[]}
              onImagesChange={() => {}}
              onNewImagesChange={(files, previews) => {
                console.log('🖼️ Novas imagens selecionadas:', files.length);
                setImageFiles(files);
                setImagePreviewUrls(previews);
              }}
              onImagesToDeleteChange={() => {}}
              newImageFiles={imageFiles}
              newImagePreviews={imagePreviewUrls}
              imagesToDelete={[]}
            />
          )}
        </div>
      </motion.div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <Dialog open={isOpen} onOpenChange={onCancel}>
            <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none max-h-[95vh] overflow-hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
                className="relative h-[95vh]"
              >
                {/* Background simples sem animações */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl" />

                {/* Conteúdo principal */}
                <div className="relative z-10 p-8 h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                          Novo Imóvel
                        </h2>
                        <p className="text-sm text-gray-400">Passo {step} de 3</p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCancel}
                      className="text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                      {[1, 2, 3].map((stepNumber) => (
                        <div key={stepNumber} className="flex items-center">
                          <motion.div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all duration-300 ${
                              stepNumber <= step
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 border-blue-500 text-white'
                                : 'bg-gray-800 border-gray-600 text-gray-400'
                            }`}
                            whileHover={{ scale: 1.05 }}
                          >
                            {stepNumber}
                          </motion.div>
                          {stepNumber < 3 && (
                            <div className={`w-16 h-0.5 mx-2 transition-all duration-300 ${
                              stepNumber < step ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-700'
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Conteúdo do step - Com scroll customizado */}
                  <div className="relative flex-1 min-h-0 mb-8">
                    {/* Fade shadows para indicar scroll */}
                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-gray-900/80 to-transparent z-10 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-900/80 to-transparent z-10 pointer-events-none" />
                    
                    <div className="h-full overflow-y-auto property-modal-scroll">
                      <AnimatePresence mode="wait">
                        <div className="px-1 py-4">
                          {renderStep()}
                        </div>
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Footer com botões */}
                  <div className="flex justify-between pt-4 border-t border-gray-700/50">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={step === 1}
                      className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Anterior
                    </Button>

                    {step < 3 ? (
                      <Button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próximo
                        <Home className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Salvando...' : 'Criar Imóvel'}
                        <Building2 className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
