import React, { useState, useEffect, useMemo } from 'react';
import { Copy, X, AlertTriangle, CheckCircle, Clock, MessageSquare, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 180, damping: 18 },
  },
};

const staggerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

const QUALIDADE_LABELS: Record<string, string> = {
  cordialidade: 'Cordialidade',
  clareza: 'Clareza',
  objetividade: 'Objetividade',
  resolutividade: 'Resolutividade',
  consistencia: 'Consistência',
};

function normalizeScore10(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  // Aceita 0–10 ou 0–100 vindos do n8n
  if (n > 10) return Math.min(10, Math.max(0, n / 10));
  return Math.min(10, Math.max(0, n));
}

const ProgressRing = ({ value, size = 40 }: { value: number; size?: number }) => {
  const radius = (size - 4) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 10) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="transparent"
          className="text-muted-foreground/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          className="text-emerald-500"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.35 }}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-foreground">{value}</span>
    </div>
  );
};

const AnimatedCounter = ({ value, duration = 1 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | undefined;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (startTime === undefined) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{count}</span>;
};

const AccordionCard = ({
  id,
  title,
  icon: Icon,
  iconColor,
  accentBorder,
  children,
  expandedCards,
  toggleCard,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  accentBorder?: string;
  children: React.ReactNode;
  expandedCards: Set<string>;
  toggleCard: (id: string) => void;
}) => {
  const isExpanded = expandedCards.has(id);

  return (
    <motion.section
      className={cn(
        'rounded-xl sm:rounded-2xl border bg-card/80 shadow-sm transition-shadow',
        'border-border hover:shadow-md',
        accentBorder,
      )}
      variants={cardVariants}
    >
      <button
        type="button"
        className="w-full flex items-center gap-2.5 sm:gap-3 text-left p-3.5 sm:p-5"
        onClick={() => toggleCard(id)}
        aria-expanded={isExpanded}
      >
        <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0', iconColor)} />
        <h3 className="text-base sm:text-lg font-semibold text-foreground flex-1 min-w-0 truncate">
          {title}
        </h3>
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 sm:px-5 pb-3.5 sm:pb-5 pt-0 border-t border-border/70 mx-3.5 sm:mx-5">
              <div className="pt-3 sm:pt-4">{children}</div>
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
    imovel?: {
      bairro?: string;
      valor?: string | number;
      codigo_oferta?: string;
      codigo_portal?: string;
      link?: string;
    };
    agendamento?: { data?: string; hora?: string; corretor?: string };
  };
  metricas?: {
    total_mensagens?: number;
    mensagens_ia?: number;
    mensagens_human?: number;
    tempo_primeira_resposta_segundos?: number;
    repeticoes_detectadas?: number;
  };
  qualidade?: Record<string, number | string | null | undefined>;
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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(
    () => new Set(['resumo', 'proximas_acoes', 'metricas', 'qualidade']),
  );

  const qualidadeItems = useMemo(() => {
    if (!summaryData?.qualidade || typeof summaryData.qualidade !== 'object') return [];
    return Object.entries(summaryData.qualidade)
      .map(([key, raw]) => ({
        key,
        label: QUALIDADE_LABELS[key] || key.replace(/_/g, ' '),
        score: normalizeScore10(raw),
      }))
      .filter((item) => item.key);
  }, [summaryData?.qualidade]);

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'aberto':
        return 'text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
      case 'pendente':
        return 'text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10';
      case 'fechado':
        return 'text-rose-700 dark:text-rose-400 border-rose-500/40 bg-rose-500/10';
      default:
        return 'text-blue-700 dark:text-blue-400 border-blue-500/40 bg-blue-500/10';
    }
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
      if (summaryData.proximas_acoes?.length) {
        textToCopy += 'Próximas ações:\n';
        summaryData.proximas_acoes.forEach((acao) => {
          textToCopy += `- ${acao}\n`;
        });
        textToCopy += '\n';
      }
      textToCopy += `Status: ${summaryData.status_atendimento || '—'} | Nota: ${summaryData.nota_atendimento || 0}/10`;

      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: (
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            Copiado!
          </div>
        ),
        description: 'Resumo copiado para a área de transferência.',
      });
      setTimeout(() => setCopiedRecently(false), 1000);
    } catch {
      setCopiedRecently(false);
      toast({
        title: 'Erro',
        description: 'Falha ao copiar resumo.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!summaryData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm sm:backdrop-blur-md"
            variants={backdropVariants}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-modal-title"
            className={cn(
              'relative w-full sm:max-w-3xl lg:max-w-4xl',
              'h-[92dvh] sm:h-auto sm:max-h-[90vh]',
              'rounded-t-2xl sm:rounded-2xl',
              'border border-border bg-background shadow-2xl',
              'flex flex-col overflow-hidden',
            )}
            variants={modalVariants}
          >
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur-sm">
              <div className="flex items-start sm:items-center justify-between gap-3 p-4 sm:p-5 pb-3">
                <motion.h2
                  id="summary-modal-title"
                  className="text-lg sm:text-xl font-semibold text-foreground"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  Resumo da Conversa
                </motion.h2>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!summaryData.loading && !summaryData.error && (
                <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 pb-3 sm:pb-4">
                  {summaryData.status_atendimento && (
                    <div
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium',
                        getStatusColor(summaryData.status_atendimento),
                      )}
                    >
                      Status: {summaryData.status_atendimento}
                    </div>
                  )}

                  {summaryData.nota_atendimento !== undefined && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Nota: <ProgressRing value={summaryData.nota_atendimento} size={22} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-5">
              <motion.div
                className="space-y-3 sm:space-y-4 py-4 sm:py-5"
                variants={staggerVariants}
                initial="hidden"
                animate="visible"
              >
                {summaryData.loading &&
                  [1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="p-4 rounded-xl border border-border bg-card"
                      variants={cardVariants}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <Skeleton className="h-5 w-5 rounded" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </motion.div>
                  ))}

                {summaryData.error && (
                  <motion.div
                    className="p-5 sm:p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center"
                    variants={cardVariants}
                  >
                    <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-destructive mx-auto mb-3" />
                    <p className="text-destructive text-sm sm:text-base">
                      Não foi possível interpretar o resumo. Tente novamente.
                    </p>
                  </motion.div>
                )}

                {!summaryData.loading && !summaryData.error && (
                  <>
                    {summaryData.resumo_conversa && (
                      <AccordionCard
                        id="resumo"
                        title="Resumo"
                        icon={MessageSquare}
                        iconColor="text-sky-600 dark:text-sky-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {summaryData.resumo_conversa}
                        </p>
                      </AccordionCard>
                    )}

                    {!!summaryData.proximas_acoes?.length && (
                      <AccordionCard
                        id="proximas_acoes"
                        title="Próximas Ações"
                        icon={CheckCircle}
                        iconColor="text-sky-600 dark:text-sky-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <ul className="space-y-2.5">
                          {summaryData.proximas_acoes.map((acao, index) => (
                            <li
                              key={index}
                              className="text-sm sm:text-base text-foreground/90 flex items-start gap-2"
                            >
                              <CheckCircle className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
                              <span className="min-w-0 break-words">{acao}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionCard>
                    )}

                    {!!summaryData.pendencias?.length && (
                      <AccordionCard
                        id="pendencias"
                        title="Pendências"
                        icon={Clock}
                        iconColor="text-amber-600 dark:text-amber-300"
                        accentBorder="border-amber-500/30"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <ul className="space-y-2">
                          {summaryData.pendencias.map((pendencia, index) => (
                            <li
                              key={index}
                              className="text-sm sm:text-base text-foreground/90 flex items-start gap-2"
                            >
                              <span className="text-amber-500 mt-1 shrink-0">•</span>
                              <span className="min-w-0 break-words">{pendencia}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionCard>
                    )}

                    {!!summaryData.riscos?.length && (
                      <AccordionCard
                        id="riscos"
                        title="Riscos"
                        icon={AlertTriangle}
                        iconColor="text-rose-600 dark:text-rose-300"
                        accentBorder="border-rose-500/30"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <ul className="space-y-2">
                          {summaryData.riscos.map((risco, index) => (
                            <li
                              key={index}
                              className="text-sm sm:text-base text-foreground/90 flex items-start gap-2"
                            >
                              <span className="text-rose-500 mt-1 shrink-0">•</span>
                              <span className="min-w-0 break-words">{risco}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionCard>
                    )}

                    {summaryData.metricas && (
                      <AccordionCard
                        id="metricas"
                        title="Métricas"
                        icon={MessageSquare}
                        iconColor="text-indigo-600 dark:text-indigo-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                          <div className="text-center rounded-lg bg-muted/40 p-2.5">
                            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                              <AnimatedCounter value={summaryData.metricas.total_mensagens || 0} />
                            </div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground">Total</div>
                          </div>
                          <div className="text-center rounded-lg bg-muted/40 p-2.5">
                            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                              <AnimatedCounter value={summaryData.metricas.mensagens_ia || 0} />
                            </div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground">IA</div>
                          </div>
                          <div className="text-center rounded-lg bg-muted/40 p-2.5">
                            <div className="text-xl sm:text-2xl font-bold text-violet-600 dark:text-violet-400">
                              <AnimatedCounter value={summaryData.metricas.mensagens_human || 0} />
                            </div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground">Humano</div>
                          </div>
                          <div className="text-center rounded-lg bg-muted/40 p-2.5">
                            <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
                              {formatTime(summaryData.metricas.tempo_primeira_resposta_segundos)}
                            </div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground">1ª Resposta</div>
                          </div>
                          <div className="text-center rounded-lg bg-muted/40 p-2.5 col-span-2 sm:col-span-1">
                            <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
                              <AnimatedCounter value={summaryData.metricas.repeticoes_detectadas || 0} />
                            </div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground">Repetições</div>
                          </div>
                        </div>
                      </AccordionCard>
                    )}

                    {qualidadeItems.length > 0 && (
                      <AccordionCard
                        id="qualidade"
                        title="Qualidade"
                        icon={CheckCircle}
                        iconColor="text-emerald-600 dark:text-emerald-300"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <div className="space-y-4">
                          {qualidadeItems.map(({ key, label, score }) => (
                            <div key={key} className="space-y-1.5">
                              <div className="flex justify-between gap-3 text-sm">
                                <span className="text-foreground capitalize min-w-0 truncate">
                                  {label}
                                </span>
                                <span className="text-muted-foreground tabular-nums shrink-0">
                                  {score.toFixed(score % 1 === 0 ? 0 : 1)}/10
                                </span>
                              </div>
                              <Progress value={score * 10} className="h-2 bg-muted" />
                            </div>
                          ))}
                        </div>
                      </AccordionCard>
                    )}

                    {summaryData.flags && Object.values(summaryData.flags).some(Boolean) && (
                      <AccordionCard
                        id="flags"
                        title="Alertas"
                        icon={AlertTriangle}
                        iconColor="text-orange-600 dark:text-orange-300"
                        accentBorder="border-orange-500/30"
                        expandedCards={expandedCards}
                        toggleCard={toggleCard}
                      >
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(summaryData.flags)
                            .filter(([, value]) => value)
                            .map(([key]) => (
                              <div
                                key={key}
                                className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-700 dark:text-orange-300"
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span className="break-words">
                                  {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </span>
                              </div>
                            ))}
                        </div>
                      </AccordionCard>
                    )}
                  </>
                )}
              </motion.div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  disabled={summaryData.loading || summaryData.error || copiedRecently}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-auto"
                >
                  {copiedRecently ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedRecently ? 'Copiado!' : 'Copiar resumo'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-auto"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
