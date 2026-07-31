import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PendingVisitBrokerAssignments } from '@/components/PendingVisitBrokerAssignments';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import {
  BROKER_PRIORITY_TIER_OPTIONS,
  brokerPriorityTierToScore,
  configsEqual,
  DEFAULT_BROKER_PRIORITY_SCORE,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  PRIORITY_CRITERION_LABELS,
  scoreToBrokerPriorityTier,
  type AiVisitSchedulingConfig,
  type BrokerPriorityTier,
  type PriorityCriterion,
  type VisitBrokerAssignmentMode,
} from '@/lib/aiVisitScheduling';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { initials, SECTION_NAV } from '../helpers';

type Props = {
  companyId?: string;
  isManager: boolean;
  initialConfig: AiVisitSchedulingConfig;
  externalSaving: boolean;
  onSave: (config: AiVisitSchedulingConfig) => Promise<boolean>;
  /** Notify parent of draft changes for Completo % / checklist. */
  onDraftChange?: (config: AiVisitSchedulingConfig) => void;
};

const CRITERION_TABS: ReadonlyArray<{ id: PriorityCriterion; label: string }> = [
  { id: 'numeric', label: 'Prioridade por corretor' },
  { id: 'plantao_order', label: 'Ordem da escala do Plantão' },
  { id: 'least_busy', label: 'Menos visitas no dia' },
];

const TIER_IDLE: Record<BrokerPriorityTier, string> = {
  high: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800',
  medium: 'text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800',
  low: 'text-rose-700 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800',
};

const TIER_ACTIVE: Record<BrokerPriorityTier, string> = {
  high: 'btn-on-emerald bg-emerald-700 text-white border-emerald-700',
  medium: 'bg-blue-600 text-white border-blue-600',
  low: 'bg-rose-600 text-white border-rose-600',
};

export function AiConfigVisitasSection({
  companyId,
  isManager,
  initialConfig,
  externalSaving,
  onSave,
  onDraftChange,
}: Props) {
  const meta = SECTION_NAV.find((s) => s.id === 'visitas')!;
  const Icon = meta.Icon;
  const { users, loading: loadingUsers, loadUsers } = useCompanyUsers();
  const [saved, setSaved] = useState<AiVisitSchedulingConfig>(initialConfig);
  const [draft, setDraft] = useState<AiVisitSchedulingConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  const eligibleBrokers = useMemo(
    () => users.filter((u) => u.isActive && (u.role === 'corretor' || u.role === 'gestor')),
    [users],
  );

  useEffect(() => {
    setSaved(initialConfig);
    setDraft(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  useEffect(() => {
    if (!companyId || draft.mode !== 'priority' || draft.priorityCriterion !== 'numeric') return;
    loadUsers(undefined, ['corretor', 'gestor'], false);
  }, [companyId, draft.mode, draft.priorityCriterion, loadUsers]);

  useEffect(() => {
    if (draft.mode !== 'priority' || draft.priorityCriterion !== 'numeric') return;
    if (!eligibleBrokers.length) return;
    setDraft((prev) => {
      const next = { ...prev.brokerPriorities };
      let changed = false;
      for (const b of eligibleBrokers) {
        if (next[b.id] === undefined) {
          next[b.id] = DEFAULT_BROKER_PRIORITY_SCORE;
          changed = true;
        }
      }
      return changed ? { ...prev, brokerPriorities: next } : prev;
    });
  }, [eligibleBrokers, draft.mode, draft.priorityCriterion]);

  const hasChanges = companyId ? !configsEqual(draft, saved) : false;

  const setMode = (mode: VisitBrokerAssignmentMode) => {
    setDraft((p) => ({ ...p, mode }));
  };

  const setPriorityCriterion = (priorityCriterion: PriorityCriterion) => {
    setDraft((p) => ({ ...p, priorityCriterion }));
  };

  const setBrokerPriorityTier = (userId: string, tier: BrokerPriorityTier) => {
    setDraft((p) => ({
      ...p,
      brokerPriorities: {
        ...p.brokerPriorities,
        [userId]: brokerPriorityTierToScore(tier),
      },
    }));
  };

  const handleSave = async () => {
    if (!companyId || !isManager) return;
    setSaving(true);
    try {
      const payload = {
        mode: draft.mode,
        priorityCriterion: draft.priorityCriterion,
        brokerPriorities: draft.brokerPriorities,
        updatedAt: '',
      };
      const ok = await onSave(payload);
      if (ok) {
        const next = { ...payload, updatedAt: new Date().toISOString() };
        setSaved(next);
        setDraft(next);
        toast.success('Preferências de agendamento salvas.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              meta.iconBg,
            )}
          >
            <Icon className={cn('h-4 w-4', meta.iconClass)} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{meta.label}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
          </div>
        </div>

        <fieldset disabled={!isManager} className="space-y-3 disabled:opacity-60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Modo de distribuição
          </p>
          <RadioGroup
            value={draft.mode}
            onValueChange={(v) => setMode(v as VisitBrokerAssignmentMode)}
            className="space-y-2.5"
          >
            {(['queue', 'priority', 'manual'] as const).map((mode) => {
              const selected = draft.mode === mode;
              return (
                <label
                  key={mode}
                  htmlFor={`visit-mode-${mode}`}
                  className={cn(
                    'flex gap-3 rounded-xl border p-4 cursor-pointer transition-colors',
                    selected
                      ? 'border-emerald-400 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/30'
                      : 'border-border/80 bg-white dark:bg-background hover:bg-[#F7F5F0]/60 dark:hover:bg-muted/40',
                  )}
                >
                  <RadioGroupItem
                    value={mode}
                    id={`visit-mode-${mode}`}
                    className="mt-1 border-emerald-600 text-emerald-700"
                  />
                  <div className="space-y-1 min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {MODE_LABELS[mode]}
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {MODE_DESCRIPTIONS[mode]}
                    </p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </fieldset>

        {draft.mode === 'priority' && (
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Critério de prioridade
            </p>

            <div className="inline-flex flex-wrap rounded-xl border border-border/80 bg-[#F7F5F0]/70 dark:bg-muted/30 p-1 gap-1">
              {CRITERION_TABS.map((tab) => {
                const active = draft.priorityCriterion === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={!isManager}
                    onClick={() => setPriorityCriterion(tab.id)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-white dark:bg-background text-foreground font-medium shadow-sm border border-border/70'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {draft.priorityCriterion === 'numeric' && (
              <div className="space-y-3">
                {loadingUsers ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando corretores...
                  </div>
                ) : eligibleBrokers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhum corretor ou gestor ativo encontrado para configurar prioridades.
                  </p>
                ) : (
                  <div className="rounded-xl border border-border/70 overflow-hidden">
                    <div className="hidden sm:grid sm:grid-cols-[1fr_auto] gap-3 px-4 py-2.5 bg-[#F7F5F0]/90 dark:bg-muted/40 border-b border-border/60 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                      <span>Corretor</span>
                      <span className="text-right pr-1">Prioridade na visita</span>
                    </div>
                    <ul className="divide-y divide-border/60">
                      {eligibleBrokers.map((b) => {
                        const score =
                          draft.brokerPriorities[b.id] ?? DEFAULT_BROKER_PRIORITY_SCORE;
                        const tier = scoreToBrokerPriorityTier(score);
                        return (
                          <li
                            key={b.id}
                            className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-4 py-3 bg-white dark:bg-background"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                                {initials(b.fullName)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {b.fullName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {b.role === 'gestor' ? 'gestor' : 'corretor'}
                                  {b.email ? ` · ${b.email}` : ''}
                                </p>
                              </div>
                            </div>
                            <div
                              className="flex flex-wrap gap-1.5"
                              role="group"
                              aria-label={`Prioridade de ${b.fullName}`}
                            >
                              {BROKER_PRIORITY_TIER_OPTIONS.map((opt) => {
                                const isSelected = tier === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={!isManager}
                                    onClick={() => setBrokerPriorityTier(b.id, opt.id)}
                                    className={cn(
                                      'h-8 min-w-[3.5rem] rounded-lg border px-3 text-xs font-semibold transition-colors',
                                      isSelected ? TIER_ACTIVE[opt.id] : TIER_IDLE[opt.id],
                                    )}
                                    style={
                                      isSelected && opt.id === 'high'
                                        ? { color: '#ffffff' }
                                        : isSelected
                                          ? { color: '#ffffff' }
                                          : undefined
                                    }
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="px-4 py-2.5 bg-[#F7F5F0]/70 dark:bg-muted/30 border-t border-border/60 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {BROKER_PRIORITY_TIER_OPTIONS.map((opt) => (
                        <span key={opt.id}>
                          <span
                            className={cn(
                              'font-semibold',
                              opt.id === 'high' && 'text-emerald-700 dark:text-emerald-400',
                              opt.id === 'medium' && 'text-blue-700 dark:text-blue-400',
                              opt.id === 'low' && 'text-rose-700 dark:text-rose-400',
                            )}
                          >
                            {opt.label}
                          </span>
                          {' — '}
                          {opt.hint}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {draft.priorityCriterion === 'plantao_order' && (
              <p className="text-sm text-muted-foreground rounded-xl border border-border/70 bg-[#F7F5F0]/60 dark:bg-muted/30 px-4 py-3">
                Organize a ordem dos corretores em{' '}
                <strong className="text-foreground">Plantão → Escala do Plantão</strong>. A
                assistente tentará o primeiro da lista que estiver de plantão e com horário livre.
                ({PRIORITY_CRITERION_LABELS.plantao_order})
              </p>
            )}

            {draft.priorityCriterion === 'least_busy' && (
              <p className="text-sm text-muted-foreground rounded-xl border border-border/70 bg-[#F7F5F0]/60 dark:bg-muted/30 px-4 py-3">
                Prioriza o corretor com menos visitas já marcadas naquele mesmo dia, para equilibrar
                a carga da equipe.
              </p>
            )}
          </div>
        )}

        {draft.mode === 'manual' && (
          <div className="rounded-xl border border-border/70 bg-[#F7F5F0]/60 dark:bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
            <p className="text-foreground font-medium">Como funciona</p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>A assistente combina data e horário da visita com o cliente no WhatsApp.</li>
              <li>A visita fica registrada na agenda, ainda sem corretor definido.</li>
              <li>Você ou um gestor escolhe qual corretor fará a visita depois do agendamento.</li>
            </ol>
          </div>
        )}

        {!isManager && (
          <p className="text-sm text-muted-foreground italic">
            Apenas administradores e gestores podem alterar estas preferências.
          </p>
        )}

        {hasChanges && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!isManager || !companyId || saving || externalSaving}
              className="btn-on-emerald inline-flex items-center rounded-xl h-9 px-4 text-sm font-medium bg-emerald-800 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
              style={{ color: '#ffffff' }}
            >
              {saving || externalSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar agendamento'
              )}
            </button>
          </div>
        )}
      </div>

      <PendingVisitBrokerAssignments />
    </div>
  );
}
