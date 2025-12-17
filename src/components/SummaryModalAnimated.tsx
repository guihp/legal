import React, { useState, useEffect } from 'react';
import { Copy, X, ExternalLink, AlertTriangle, CheckCircle, Clock, Users, MessageSquare, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// Variants de animação
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
};

const modalVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: 'spring', 
      stiffness: 180, 
      damping: 18,
      duration: 0.3
    } 
  }
};

const staggerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.2 }
  }
};

// Componente do anel de progresso animado
const ProgressRing = ({ value, size = 40 }: { value: number; size?: number }) => {
  const radius = (size - 4) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 10) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="currentColor" strokeWidth="2" fill="transparent"
          className="text-zinc-700"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="currentColor" strokeWidth="2" fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          className="text-green-400"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
        />
      </svg>
      <motion.span 
        className="absolute text-xs font-medium text-white"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
      >
        {value}
      </motion.span>
    </div>
  );
};

// Componente de contador animado
const AnimatedCounter = ({ value, duration = 1 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value, duration]);

  return <span>{count}</span>;
};

// Componente de Card Accordion
const AccordionCard = ({ 
  id, 
  title, 
  icon: Icon, 
  iconColor, 
  borderColor = "border-zinc-700/60",
  children, 
  expandedCards, 
  toggleCard,
  defaultExpanded = false 
}: {
  id: string;
  title: string;
  icon: any;
  iconColor: string;
  borderColor?: string;
  children: React.ReactNode;
  expandedCards: Set<string>;
  toggleCard: (id: string) => void;
  defaultExpanded?: boolean;
}) => {
  const isExpanded = expandedCards.has(id);

  return (
    <motion.section
      className={`p-4 md:p-5 rounded-2xl border ${borderColor} bg-zinc-900/60 shadow-xl hover:shadow-2xl/30 hover:-translate-y-[1px] transition-all duration-200`}
      variants={cardVariants}
      whileHover={{ y: -1 }}
    >
      <motion.button
        className="w-full flex items-center gap-3 text-left"
        onClick={() => toggleCard(id)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0`} />
        <h3 className="text-lg font-semibold text-white flex-1">{title}</h3>
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        </motion.div>
      </motion.button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-zinc-700/40 mt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

interface SummaryData {
  loading?: boolean;
  error?: boolean;
  nota_atendimento?: number;
  resumo_conversa?: string;
  status_atendimento?: string;
  proximas_acoes?: string[];
  pendencias?: string[];
  riscos?: string[];
  recomendacoes_processos?: string[];
  dados_extraidos?: {
    cliente?: { nome?: string; email?: string };
    imovel?: { bairro?: string; valor?: string | number; codigo_oferta?: string; codigo_portal?: string; link?: string };
    agendamento?: { data?: string; hora?: string; corretor?: string };
  };
  metricas?: {
    total_mensagens?: number;
    mensagens_ia?: number;
    mensagens_human?: number;
    tempo_primeira_resposta_segundos?: number;
    repeticoes_detectadas?: number;
  };
  qualidade?: {
    cordialidade?: number;
    clareza?: number;
    objetividade?: number;
    resolutividade?: number;
    consistencia?: number;
  };
  flags?: { [key: string]: boolean };
}

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: SummaryData | null;
}

export function SummaryModalAnimated({ isOpen, onClose, summaryData }: SummaryModalProps) {
  const { toast } = useToast();
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set([
    'resumo', 'proximas_acoes', 'dados_extraidos', 'metricas'
  ]));

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'aberto': return 'text-emerald-400 border-emerald-400/30';
      case 'pendente': return 'text-amber-400 border-amber-400/30';
      case 'fechado': return 'text-rose-400 border-rose-400/30';
      default: return 'text-blue-400 border-blue-400/30';
    }
  };

  const formatCurrency = (value: string | number | undefined) => {
    if (!value) return '—';
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) : value;
    if (isNaN(numValue)) return value.toString();
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue);
  };

  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleCopySummary = async () => {
    if (!summaryData || summaryData.loading || summaryData.error || copiedRecently) return;
    
    setCopiedRecently(true);
    
    try {
      let textToCopy = '';
      if (summaryData.resumo_conversa) textToCopy += `Resumo: ${summaryData.resumo_conversa}\n\n`;
      if (summaryData.proximas_acoes && summaryData.proximas_acoes.length > 0) {
        textToCopy += 'Próximas ações:\n';
        summaryData.proximas_acoes.forEach(acao => textToCopy += `- ${acao}\n`);
        textToCopy += '\n';
      }
      textToCopy += `Status: ${summaryData.status_atendimento || '—'} | Nota: ${summaryData.nota_atendimento || 0}/10`;

      await navigator.clipboard.writeText(textToCopy);
      
      toast({
        title: (
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              <Check className="h-4 w-4 text-green-400" />
            </motion.div>
            Copiado!
          </div>
        ),
        description: "Resumo copiado para a área de transferência.",
      });

      setTimeout(() => setCopiedRecently(false), 1000);
    } catch (error) {
      setCopiedRecently(false);
      toast({
        title: "Erro",
        description: "Falha ao copiar resumo.",
        variant: "destructive",
      });
    }
  };

  // Travar scroll e fechar com Esc
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isOpen, onClose]);

  if (!summaryData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            variants={backdropVariants}
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-zinc-700/60 bg-zinc-900/80 shadow-2xl overflow-hidden"
            variants={modalVariants}
          >
            {/* Header Sticky */}
            <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700/60">
              <div className="flex items-center justify-between p-6 pb-4">
                <motion.h2 
                  className="text-xl font-semibold text-white"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Resumo da Conversa
                </motion.h2>
                
                <motion.button
                  onClick={onClose}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
              
              {/* Badges animados */}
              {!summaryData.loading && !summaryData.error && (
                <motion.div 
                  className="flex items-center gap-3 px-6 pb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {summaryData.status_atendimento && (
                    <motion.div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(summaryData.status_atendimento)}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                    >
                      Status: {summaryData.status_atendimento}
                    </motion.div>
                  )}
                  
                  {summaryData.nota_atendimento !== undefined && (
                    <motion.div
                      className="inline-flex items-center gap-2 rounded-full border border-green-400/30 px-3 py-1 text-xs font-medium text-green-300"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                    >
                      Nota: <ProgressRing value={summaryData.nota_atendimento} size={24} />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
            
            {/* Conteúdo com scroll */}
            <div className="max-h-[70vh] overflow-y-auto px-6">
              <motion.div 
                className="space-y-4 pt-6 pb-6"
                variants={staggerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Loading */}
                {summaryData.loading && (
                  <>
                    {[1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        className="p-4 rounded-2xl border border-zinc-700/60 bg-zinc-900/60"
                        variants={cardVariants}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Skeleton className="h-5 w-5 rounded bg-zinc-700" />
                          <Skeleton className="h-4 w-32 bg-zinc-700" />
                        </div>
                        <Skeleton className="h-20 w-full bg-zinc-700 rounded-lg" />
                      </motion.div>
                    ))}
                  </>
                )}

                {/* Erro */}
                {summaryData.error && (
                  <motion.div
                    className="p-6 rounded-2xl border border-red-500/30 bg-zinc-900/60 text-center"
                    variants={cardVariants}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-red-300 mb-4">
                      Não foi possível interpretar o resumo. Tente novamente.
                    </p>
                  </motion.div>
                )}

                {/* Cards do conteúdo */}
                {!summaryData.loading && !summaryData.error && (
                  <>
                    {/* Resumo */}
                    {summaryData.resumo_conversa && (
                      <AccordionCard
                        id="resumo"
                        title="Resumo"
                        icon={MessageSquare}
                        iconColor="text-slate-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <p className="text-zinc-300 leading-relaxed">
                          {summaryData.resumo_conversa}
                        </p>
                      </AccordionCard>
                    )}

                    {/* Próximas Ações */}
                    {summaryData.proximas_acoes && summaryData.proximas_acoes.length > 0 && (
                      <AccordionCard
                        id="proximas_acoes"
                        title="Próximas Ações"
                        icon={CheckCircle}
                        iconColor="text-sky-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <ol className="list-decimal list-inside space-y-2">
                          {summaryData.proximas_acoes.map((acao, index) => (
                            <motion.li 
                              key={index} 
                              className="text-zinc-300 flex items-start gap-2"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <motion.div
                                className="mt-1"
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
                              >
                                <CheckCircle className="h-4 w-4 text-sky-400" />
                              </motion.div>
                              <span>{acao}</span>
                            </motion.li>
                          ))}
                        </ol>
                      </AccordionCard>
                    )}

                    {/* Pendências */}
                    {summaryData.pendencias && summaryData.pendencias.length > 0 && (
                      <AccordionCard
                        id="pendencias"
                        title="Pendências"
                        icon={Clock}
                        iconColor="text-yellow-300"
                        borderColor="border-yellow-500/30"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <ul className="space-y-2">
                          {summaryData.pendencias.map((pendencia, index) => (
                            <li key={index} className="text-zinc-300 flex items-start gap-2">
                              <span className="text-yellow-400 mt-1">•</span>
                              <span>{pendencia}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionCard>
                    )}

                    {/* Riscos */}
                    {summaryData.riscos && summaryData.riscos.length > 0 && (
                      <AccordionCard
                        id="riscos"
                        title="Riscos"
                        icon={AlertTriangle}
                        iconColor="text-rose-300"
                        borderColor="border-red-500/30"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <ul className="space-y-2">
                          {summaryData.riscos.map((risco, index) => (
                            <li key={index} className="text-zinc-300 flex items-start gap-2">
                              <span className="text-red-400 mt-1">•</span>
                              <span>{risco}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionCard>
                    )}

                    {/* Métricas */}
                    {summaryData.metricas && (
                      <AccordionCard
                        id="metricas"
                        title="Métricas"
                        icon={MessageSquare}
                        iconColor="text-indigo-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-400">
                              <AnimatedCounter value={summaryData.metricas.total_mensagens || 0} />
                            </div>
                            <div className="text-xs text-zinc-400">Total</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">
                              <AnimatedCounter value={summaryData.metricas.mensagens_ia || 0} />
                            </div>
                            <div className="text-xs text-zinc-400">IA</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-400">
                              <AnimatedCounter value={summaryData.metricas.mensagens_human || 0} />
                            </div>
                            <div className="text-xs text-zinc-400">Humano</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-400">
                              {formatTime(summaryData.metricas.tempo_primeira_resposta_segundos)}
                            </div>
                            <div className="text-xs text-zinc-400">1ª Resposta</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-400">
                              <AnimatedCounter value={summaryData.metricas.repeticoes_detectadas || 0} />
                            </div>
                            <div className="text-xs text-zinc-400">Repetições</div>
                          </div>
                        </div>
                      </AccordionCard>
                    )}

                    {/* Qualidade */}
                    {summaryData.qualidade && (
                      <AccordionCard
                        id="qualidade"
                        title="Qualidade"
                        icon={CheckCircle}
                        iconColor="text-green-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <div className="space-y-4">
                          {Object.entries(summaryData.qualidade).map(([key, value]) => (
                            <div key={key} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-300 capitalize">
                                  {key.replace('_', ' ')}
                                </span>
                                <span className="text-zinc-400">{value || 0}/10</span>
                              </div>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                              >
                                <Progress value={(value || 0) * 10} className="h-2" />
                              </motion.div>
                            </div>
                          ))}
                        </div>
                      </AccordionCard>
                    )}

                    {/* Flags */}
                    {summaryData.flags && Object.values(summaryData.flags).some(Boolean) && (
                      <AccordionCard
                        id="flags"
                        title="Alertas"
                        icon={AlertTriangle}
                        iconColor="text-orange-300"
                        borderColor="border-orange-500/30"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(summaryData.flags)
                            .filter(([, value]) => value)
                            .map(([key], index) => (
                              <motion.div
                                key={key}
                                className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 px-3 py-1 text-xs text-orange-300"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ 
                                  delay: index * 0.1,
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 20
                                }}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </motion.div>
                            ))}
                        </div>
                      </AccordionCard>
                    )}
                  </>
                )}
              </motion.div>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700/60 p-6">
              <div className="flex justify-end gap-3">
                <motion.button
                  onClick={handleCopySummary}
                  disabled={summaryData.loading || summaryData.error || copiedRecently}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {copiedRecently ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedRecently ? 'Copiado!' : 'Copiar resumo'}
                </motion.button>
                
                <motion.button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Fechar
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
