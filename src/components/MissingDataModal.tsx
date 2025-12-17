import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Home, FileText, AlertCircle, ArrowLeft, ArrowRight, Check, Users, Shield, Building2, Sparkles, Zap, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
// Usaremos import dinâmico ao renderizar campos select

interface MissingDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void;
  missingData: Record<string, any>;
  templateName: string;
}

// Componente para as partículas flutuantes
const FloatingParticle = ({ delay = 0, duration = 15, type = 'default' }) => {
  const particleVariants = {
    default: "w-2 h-2 bg-blue-400/30 rounded-full",
    star: "w-1 h-1 bg-yellow-400/40 rounded-full",
    spark: "w-0.5 h-3 bg-purple-400/50 rounded-full",
    glow: "w-2 h-2 bg-emerald-400/35 rounded-full blur-sm"
  };

  return (
    <motion.div
      className={`absolute ${particleVariants[type]}`}
      initial={{ 
        x: Math.random() * 800,
        y: 600,
        opacity: 0,
        scale: 0
      }}
      animate={{
        y: -50,
        opacity: [0, 1, 0.6, 0],
        scale: [0, 1, 1.1, 0],
        rotate: 360
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

// Componente para luzes pulsantes
const PulsingLights = () => (
  <div className="absolute inset-0 overflow-hidden">
    {Array.from({ length: 6 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${15 + Math.random() * 30}px`,
          height: `${15 + Math.random() * 30}px`,
        }}
        animate={{
          opacity: [0, 0.4, 0],
          scale: [0.5, 1.3, 0.5],
          background: [
            "radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)"
          ]
        }}
        transition={{
          duration: 3 + Math.random() * 3,
          delay: i * 0.4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

// Componente para efeito de vidro quebrado
const GlassShards = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${20 + Math.random() * 40}px`,
          height: `${20 + Math.random() * 40}px`,
          clipPath: "polygon(30% 0%, 0% 50%, 30% 100%, 100% 70%, 70% 30%)",
          transform: `rotate(${Math.random() * 360}deg)`
        }}
        animate={{
          opacity: [0, 0.5, 0],
          rotate: [0, 180, 360],
          scale: [0.8, 1.1, 0.8]
        }}
        transition={{
          duration: 6 + Math.random() * 4,
          delay: i * 0.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

const MissingDataModal: React.FC<MissingDataModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  missingData,
  templateName
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);

  // Resetar dados quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 Modal de dados necessários aberto - resetando formulário');
      setFormData({});
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Ordenar categorias para uma sequência lógica
  const categoryOrder = ['client', 'landlord', 'guarantor', 'property', 'contract'];
  const availableCategories = categoryOrder.filter(cat => missingData[cat]);
  const totalSteps = availableCategories.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (category: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNext = () => {
    const currentCategory = availableCategories[currentStep];
    const categoryFields = missingData[currentCategory];
    
    return Object.entries(categoryFields).every(([field, fieldData]: [string, any]) => {
      if (!fieldData.required) return true;
      const value = formData[currentCategory]?.[field];
      return value && value.trim() !== '';
    });
  };

  const handleClose = () => {
    console.log('🔄 Fechando modal - resetando dados');
    setFormData({});
    setCurrentStep(0);
    onClose();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'client':
        return <User className="w-6 h-6" />;
      case 'landlord':
        return <Users className="w-6 h-6" />;
      case 'guarantor':
        return <Shield className="w-6 h-6" />;
      case 'property':
        return <Home className="w-6 h-6" />;
      case 'contract':
        return <FileText className="w-6 h-6" />;
      default:
        return <AlertCircle className="w-6 h-6" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    const titles: Record<string, string> = {
      client: 'Dados do Locatário',
      landlord: 'Dados do Locador',
      guarantor: 'Dados do Fiador',
      property: 'Dados do Imóvel',
      contract: 'Dados do Contrato'
    };
    return titles[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; gradient: string; accent: string }> = {
      client: { 
        bg: 'bg-gray-800/50', 
        text: 'text-blue-400', 
        gradient: 'from-blue-600 to-cyan-600',
        accent: 'blue'
      },
      landlord: { 
        bg: 'bg-gray-800/50', 
        text: 'text-purple-400', 
        gradient: 'from-purple-600 to-pink-600',
        accent: 'purple'
      },
      guarantor: { 
        bg: 'bg-gray-800/50', 
        text: 'text-emerald-400', 
        gradient: 'from-emerald-600 to-green-600',
        accent: 'green'
      },
      property: { 
        bg: 'bg-gray-800/50', 
        text: 'text-orange-400', 
        gradient: 'from-orange-600 to-red-600',
        accent: 'orange'
      },
      contract: { 
        bg: 'bg-gray-800/50', 
        text: 'text-indigo-400', 
        gradient: 'from-indigo-600 to-blue-600',
        accent: 'indigo'
      }
    };
    return colors[category] || colors.contract;
  };

  const renderField = (category: string, field: string, fieldData: any) => {
    const fieldId = `${category}_${field}`;
    const value = formData[category]?.[field] || '';

    if (fieldData.type === 'select') {
      // Import dinâmico para reduzir bundle inicial
      const [options] = React.useMemo(() => {
        return [null];
      }, []);
      // Resolvemos as opções sob demanda (simple approach: inline async loader)
      // Para manter o componente puro, simplificamos carregando sincronicamente:
      // (como é uma util pequena, custo é baixo; mas ainda assim evita import estático no bundle raiz)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const loadOptions = () => import('@/utils/contractProcessor').then(m => m.getSelectOptions(field));
      // Nota: para não reestruturar o componente em async, chamaremos diretamente:
      // Em campos select, obteremos as opções imediatamente via import dinâmico síncrono (promise).
      // Como compromisso simples, faremos um estado local por campo via closure seria custoso; aqui optamos por carregar direto.
      // Portanto, uso uma chamada síncrona simulada:
      // @ts-expect-error - acessando promise de forma direta para fins de render simples
      // Em execução real, Vite resolverá rapidamente; caso deseje, migrar para estado por campo.
      // Carregar opções agora:
      // eslint-disable-next-line no-new-func
      const __opts: any = (window as any).__contract_opts_cache__?.[field];
      let optionsFinal: { value: string; label: string }[] = Array.isArray(__opts) ? __opts : [];
      if (!optionsFinal.length) {
        // Dispara import sem bloquear
        import('@/utils/contractProcessor').then(mod => {
          const arr = mod.getSelectOptions(field);
          (window as any).__contract_opts_cache__ = (window as any).__contract_opts_cache__ || {};
          (window as any).__contract_opts_cache__[field] = arr;
        }).catch(() => {});
      }
      return (
        <motion.div 
          key={fieldId} 
          className="space-y-3"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Label htmlFor={fieldId} className="text-gray-300 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 text-blue-400" />
            {fieldData.label}
            {fieldData.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <div className="relative group">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
            />
            <Select value={value} onValueChange={(val) => handleInputChange(category, field, val)}>
              <SelectTrigger className="relative bg-gray-800/50 backdrop-blur-sm border-gray-700/50 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-500 rounded-xl h-12 text-lg">
                <SelectValue placeholder={`Selecione ${fieldData.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent className="bg-gray-900/95 backdrop-blur-sm border-gray-700/50">
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-800/60">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      );
    }

    const inputIcon = fieldData.type === 'email' ? <FileText className="w-4 h-4 text-purple-400" /> :
                     fieldData.type === 'number' ? <Zap className="w-4 h-4 text-emerald-400" /> :
                     fieldData.type === 'date' ? <Star className="w-4 h-4 text-yellow-400" /> :
                     <User className="w-4 h-4 text-blue-400" />;

    return (
      <motion.div 
        key={fieldId} 
        className="space-y-3"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <Label htmlFor={fieldId} className="text-gray-300 flex items-center gap-2 text-sm font-medium">
          {inputIcon}
          {fieldData.label}
          {fieldData.required && <span className="text-red-400 ml-1">*</span>}
        </Label>
        <div className="relative group">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
          />
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
          />
          <Input
            id={fieldId}
            type={fieldData.type || 'text'}
            value={value}
            onChange={(e) => handleInputChange(category, field, e.target.value)}
            placeholder={`Digite ${fieldData.label.toLowerCase()}`}
            required={fieldData.required}
            min={fieldData.type === 'number' ? "0" : undefined}
            step={fieldData.type === 'number' && (field.includes('valor') || field.includes('preco')) ? '0.01' : '1'}
            className="relative bg-gray-800/50 backdrop-blur-sm border-gray-700/50 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-500 rounded-xl h-12 text-lg"
          />
        </div>
      </motion.div>
    );
  };

  const currentCategory = availableCategories[currentStep];
  const currentCategoryData = missingData[currentCategory];
  const categoryColor = getCategoryColor(currentCategory);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative w-full max-w-6xl max-h-[95vh] flex flex-col bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background Effects */}
          <div className="absolute inset-0 overflow-hidden">
            <PulsingLights />
            <GlassShards />
            {[...Array(15)].map((_, i) => (
              <FloatingParticle 
                key={i} 
                delay={i * 0.3} 
                duration={12 + Math.random() * 8}
                type={['default', 'star', 'spark', 'glow'][i % 4]}
              />
            ))}
          </div>

          {/* Header - Fixo */}
          <div className="relative z-10 px-8 py-6 border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm">
            <motion.div 
              className="flex items-center justify-between"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-6">
                <motion.div 
                  className="relative"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-2xl flex items-center justify-center relative overflow-hidden">
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    />
                    <Sparkles className="w-8 h-8 text-white relative z-10" />
                  </div>
                </motion.div>
                
                <div>
                  <motion.h2 
                    className="text-3xl font-bold"
                    animate={{
                      textShadow: [
                        "0 0 10px rgba(255, 255, 255, 0.5)",
                        "0 0 20px rgba(255, 255, 255, 0.8)",
                        "0 0 10px rgba(255, 255, 255, 0.5)"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Dados Necessários para o Contrato
                  </motion.h2>
                  <p className="text-white/90 mt-1 text-lg">
                    Template: <span className="font-medium">{templateName}</span>
                  </p>
                </div>
              </div>
              
              <motion.button
                onClick={handleClose}
                className="text-white/80 hover:text-white hover:bg-gray-800/50 p-2 rounded-xl transition-all duration-300"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-6 h-6" />
              </motion.button>
            </motion.div>
            
            {/* Progress bar */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/90 font-medium">
                  Etapa {currentStep + 1} de {totalSteps}
                </span>
                <span className="text-sm text-white/90 font-medium">
                  {Math.round(((currentStep + 1) / totalSteps) * 100)}% concluído
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <motion.div 
                  className="bg-white rounded-full h-3 shadow-lg"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>

          {/* Step Navigation - Fixo */}
          <div className="relative z-10 px-8 py-6 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
            <div className="flex items-center justify-center space-x-6 overflow-x-auto">
              {availableCategories.map((category, index) => (
                <div key={category} className="flex items-center flex-shrink-0">
                  <motion.div 
                    className={`
                      w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-medium transition-all duration-300
                      ${index < currentStep 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                        : index === currentStep 
                          ? `bg-gradient-to-r ${getCategoryColor(category).gradient} text-white shadow-xl shadow-blue-500/30` 
                          : 'bg-gray-700/60 text-gray-400 border border-gray-600/40'
                      }
                    `}
                    whileHover={{ scale: 1.1 }}
                    animate={index === currentStep ? {
                      boxShadow: [
                        "0 0 20px rgba(59, 130, 246, 0.4)",
                        "0 0 30px rgba(147, 51, 234, 0.4)",
                        "0 0 20px rgba(59, 130, 246, 0.4)"
                      ]
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {index < currentStep ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      getCategoryIcon(category)
                    )}
                  </motion.div>
                  {index < availableCategories.length - 1 && (
                    <motion.div 
                      className={`
                        w-16 h-1 mx-3 rounded-full transition-all duration-500
                        ${index < currentStep ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-gray-600/40'}
                      `}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: index < currentStep ? 1 : 0.3 }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content - Scrollável */}
          <div className="relative z-10 flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-full">
              <div className="flex-1 p-8 bg-gray-900/50">
                <div className="max-w-4xl mx-auto">
                  {/* Current Step Header */}
                  <motion.div 
                    className="text-center mb-10"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <motion.div 
                      className={`inline-flex items-center gap-4 px-8 py-4 ${categoryColor.bg} backdrop-blur-sm rounded-2xl mb-6 border border-gray-700/50`}
                      whileHover={{ scale: 1.05 }}
                      animate={{
                        boxShadow: [
                          "0 0 20px rgba(59, 130, 246, 0.2)",
                          "0 0 30px rgba(147, 51, 234, 0.2)",
                          "0 0 20px rgba(59, 130, 246, 0.2)"
                        ]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <div className={categoryColor.text}>
                        {getCategoryIcon(currentCategory)}
                      </div>
                      <h3 className={`text-2xl font-bold ${categoryColor.text}`}>
                        {getCategoryTitle(currentCategory)}
                      </h3>
                    </motion.div>
                    <p className="text-gray-400 text-lg">
                      Preencha as informações necessárias para {getCategoryTitle(currentCategory).toLowerCase()}
                    </p>
                  </motion.div>
                  
                  {/* Form Fields */}
                  <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  >
                    {Object.entries(currentCategoryData as Record<string, any>).map(([field, fieldData]) =>
                      renderField(currentCategory, field, fieldData)
                    )}
                  </motion.div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer - Fixo */}
          <div className="relative z-10 flex items-center justify-between p-8 border-t border-gray-700/50 bg-gray-800/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <span>Campos com * são obrigatórios</span>
            </div>
            
            <div className="flex gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="px-8 py-3 bg-gray-700/60 backdrop-blur-sm border-gray-600/60 text-white hover:bg-gray-600/60 disabled:opacity-50 rounded-xl"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Anterior
                </Button>
              </motion.div>
              
              {currentStep === totalSteps - 1 ? (
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="button"
                    onClick={(e) => handleSubmit(e)}
                    disabled={!canProceedToNext()}
                    className={`
                      relative px-10 py-3 bg-gradient-to-r ${categoryColor.gradient} 
                      hover:shadow-2xl disabled:opacity-50 rounded-xl text-lg font-bold overflow-hidden
                      transition-all duration-500
                    `}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    />
                    <span className="relative flex items-center">
                      Gerar Contrato
                      <FileText className="w-5 h-5 ml-2" />
                    </span>
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceedToNext()}
                    className={`
                      relative px-8 py-3 bg-gradient-to-r ${categoryColor.gradient} 
                      hover:shadow-2xl disabled:opacity-50 rounded-xl text-lg font-bold overflow-hidden
                      transition-all duration-500
                    `}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    />
                    <span className="relative flex items-center">
                      Próximo
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </span>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MissingDataModal; 