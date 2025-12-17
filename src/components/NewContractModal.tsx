import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';
import { useContractTemplates } from '@/contexts/ContractTemplatesContext';
import { Tables } from '@/integrations/supabase/types';
import { User, Home, FileText, X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
// Imports dinâmicos serão usados nos handlers para reduzir bundle inicial

// Tipos corretos baseados no banco de dados
type Client = Tables<'leads'>;
type Property = Tables<'properties'>;
type ContractTemplate = Tables<'contract_templates'>;

interface NewContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (contractData: any) => void;
  onMissingDataRequired: (missingData: Record<string, any>, templateName: string, processingData: any) => void;
}

export const NewContractModal: React.FC<NewContractModalProps> = ({ isOpen, onClose, onSubmit, onMissingDataRequired }) => {
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { clients } = useClients();
  const { properties } = useProperties();
  const { templates } = useContractTemplates();

  // Resetar estado quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 Modal aberto - resetando seleções');
      setStep(1);
      setSelectedClient(null);
      setSelectedProperty(null);
      setSelectedTemplate(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleSubmit = async () => {
    if (!selectedClient || !selectedProperty || !selectedTemplate) {
      toast.error('Por favor, selecione cliente, imóvel e template');
      return;
    }

    setIsProcessing(true);

    try {
      // Encontrar dados selecionados
      const client = clients.find(c => c.id === selectedClient?.id);
      const property = properties.find(p => p.id === selectedProperty?.id);
      const template = templates.find(t => t.id === selectedTemplate?.id);

      if (!client || !property || !template) {
        toast.error('Erro ao encontrar dados selecionados');
        setIsProcessing(false);
        return;
      }

      // Baixar template do Supabase Storage
      console.log('📥 Baixando template:', template.file_path);
      const { data: templateBlob, error } = await supabase.storage
        .from('contract-templates')
        .download(template.file_path);

      if (error || !templateBlob) {
        console.error('❌ Erro ao baixar template:', error);
        toast.error('Erro ao baixar template');
        setIsProcessing(false);
        return;
      }

      // Detectar placeholders no template
      console.log('🔍 Detectando placeholders no template...');
      const { detectPlaceholders } = await import('@/utils/contractProcessor');
      const placeholders = await detectPlaceholders(templateBlob, template.file_name);
      console.log('📋 Placeholders encontrados:', placeholders);
      
      if (placeholders.length === 0) {
        console.warn('⚠️ Nenhum placeholder encontrado no template');
        toast.warning('Nenhum placeholder encontrado no template. Gerando contrato básico...');
      }

      // Criar dados do contrato com os dados disponíveis
      const contractData = {
        client: {
          id: client.id,
          name: client.name,
          email: client.email || '',
          phone: client.phone || '',
          cpf: '', // Campo não existe na tabela leads
          address: '', // Campo não existe na tabela leads
          nationality: '', // Campo não existe na tabela leads
          marital_status: '', // Campo não existe na tabela leads
        },
        property: {
          id: property.id,
          title: property.title,
          address: property.address,
          property_type: property.property_type,
          area: property.area,
          price: property.price,
          description: property.description,
          city: '', // Campo não existe na tabela properties
          state: '', // Campo não existe na tabela properties
          zip_code: '', // Campo não existe na tabela properties
        },
        template: {
          id: template.id,
          name: template.name,
          file_name: template.file_name,
          file_path: template.file_path,
          file_type: template.file_type || ''
        },
        landlord: {
          id: '',
          name: '', // Dados do proprietário não estão na tabela properties
          email: '',
          phone: '',
          cpf: '',
          address: '',
          nationality: '',
          marital_status: '',
        },
        guarantor: {
          id: '',
          name: '',
          email: '',
          phone: '',
          cpf: '',
          address: '',
          nationality: '',
          marital_status: '',
        },
        contractDate: new Date(),
        contractDuration: '',
        paymentDay: '',
        paymentMethod: '',
        contractCity: '',
      };

      // Identificar dados faltantes
      console.log('🔍 Identificando dados faltantes...');
      const { identifyMissingData } = await import('@/utils/contractProcessor');
      const { missingFields, missingData: missing } = identifyMissingData(placeholders, contractData);
      console.log('❌ Campos faltantes:', missingFields);
      console.log('📝 Dados necessários:', missing);

      if (missingFields.length > 0) {
        // Delegar para o componente pai
        console.log('🔔 Dados faltantes detectados. Delegando para componente pai...');
        const processingData = {
          client,
          property,
          template,
          contractData,
          templateBlob,
          placeholders
        };
        
        onMissingDataRequired(missing, template.name, processingData);
        setIsProcessing(false);
        return;
      }

      // Se não há dados faltantes, processar diretamente
      console.log('✅ Todos os dados disponíveis. Processando contrato...');
      await processContractWithData(contractData, templateBlob, template.name);

    } catch (error) {
      console.error('💥 Erro ao processar contrato:', error);
      toast.error('Erro ao processar contrato');
      setIsProcessing(false);
    }
  };

  const processContractWithData = async (contractData: any, templateBlob: Blob, templateName: string) => {
    try {
      // Processar o contrato
      const { processContract } = await import('@/utils/contractProcessor');
      const { blob: pdfBlob, fileName } = await processContract(contractData);

      // Criar URL para download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Contrato gerado e baixado com sucesso!');
      
      // Chamar callback do pai
      onSubmit({
        client: contractData.client,
        property: contractData.property,
        template: templateName
      });

      // Resetar estado
      handleClose();

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF do contrato');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedClient(null);
    setSelectedProperty(null);
    setSelectedTemplate(null);
    onClose();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedClient !== null;
      case 2:
        return selectedProperty !== null;
      case 3:
        return selectedTemplate !== null;
      default:
        return false;
    }
  };

  const renderStep = () => {
    const stepConfig = {
      1: {
        icon: User,
        title: 'Selecionar Cliente',
        description: 'Escolha o cliente para este contrato',
        gradient: 'from-blue-500 to-cyan-500',
        bgGradient: 'from-blue-500/10 to-cyan-500/10',
      },
      2: {
        icon: Home,
        title: 'Selecionar Imóvel',
        description: 'Escolha o imóvel para este contrato',
        gradient: 'from-green-500 to-emerald-500',
        bgGradient: 'from-green-500/10 to-emerald-500/10',
      },
      3: {
        icon: FileText,
        title: 'Selecionar Template',
        description: 'Escolha o template do contrato',
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
            <div className="space-y-3">
              <Select value={selectedClient?.id || ''} onValueChange={(value) => {
                const client = clients.find(c => c.id === value);
                setSelectedClient(client || null);
              }}>
                <SelectTrigger className="w-full h-12 bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800/70 transition-all duration-200">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id} className="text-white hover:bg-gray-700">
                      <div className="flex flex-col">
                        <span className="font-medium">{client.name}</span>
                        <span className="text-sm text-gray-400">{client.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Select value={selectedProperty?.id || ''} onValueChange={(value) => {
                const property = properties.find(p => p.id === value);
                setSelectedProperty(property || null);
              }}>
                <SelectTrigger className="w-full h-12 bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800/70 transition-all duration-200">
                  <SelectValue placeholder="Selecione um imóvel..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id} className="text-white hover:bg-gray-700">
                      <div className="flex flex-col">
                        <span className="font-medium">{property.title}</span>
                        <span className="text-sm text-gray-400">
                          R$ {property.price?.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <Select value={selectedTemplate?.id || ''} onValueChange={(value) => {
                const template = templates.find(t => t.id === value);
                setSelectedTemplate(template || null);
              }}>
                <SelectTrigger className="w-full h-12 bg-gray-800/50 border-gray-700 text-white hover:bg-gray-800/70 transition-all duration-200">
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id} className="text-white hover:bg-gray-700">
                      <div className="flex flex-col">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-sm text-gray-400">
                          {new Date(template.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 bg-transparent border-none shadow-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
                className="relative"
              >
                {/* Background simples sem animações */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl" />

                {/* Conteúdo principal */}
                <div className="relative z-10 p-8">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                          Novo Contrato
                        </h2>
                        <p className="text-sm text-gray-400">Passo {step} de 3</p>
                      </div>
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

                  {/* Conteúdo do step */}
                  <div className="mb-8 min-h-[200px]">
                    <AnimatePresence mode="wait">
                      {renderStep()}
                    </AnimatePresence>
                  </div>

                  {/* Footer com botões */}
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={step === 1}
                      className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Anterior
                    </Button>

                    {step < 3 ? (
                      <Button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próximo
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmit}
                        disabled={!canProceed() || isProcessing}
                        className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? 'Gerando...' : 'Gerar Contrato'}
                        <FileText className="w-4 h-4 ml-2" />
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
}; 