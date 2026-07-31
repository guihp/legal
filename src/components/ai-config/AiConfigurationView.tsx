import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useOwnCompany } from '@/hooks/useOwnCompany';
import { useCompanyApiMode } from '@/hooks/useCompanyApiMode';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import {
  clearLegacyLocalVisitSchedulingConfig,
  companyRowToVisitSchedulingConfig,
  configsEqual,
  loadLegacyLocalVisitSchedulingConfig,
  type AiVisitSchedulingConfig,
} from '@/lib/aiVisitScheduling';
import {
  parseBusinessHours,
  serializeBusinessHours,
  type DaySchedule,
} from '@/lib/businessHours';
import {
  formatActivationBlockersMessage,
  getAiActivationBlockers,
} from '@/lib/aiAssistantActivation';
import { AiConfigTopBar } from './AiConfigTopBar';
import { AiConfigToolbar } from './AiConfigToolbar';
import { AiConfigStatusBar } from './AiConfigStatusBar';
import { AiConfigSectionNav } from './AiConfigSectionNav';
import { AiConfigPreview } from './AiConfigPreview';
import { AiConfigChecklist } from './AiConfigChecklist';
import { AiConfigImpactCard } from './AiConfigImpactCard';
import { AiConfigIdentidadeSection } from './sections/AiConfigIdentidadeSection';
import { AiConfigContextoSection } from './sections/AiConfigContextoSection';
import { AiConfigHorarioSection } from './sections/AiConfigHorarioSection';
import { AiConfigEtiquetasSection } from './sections/AiConfigEtiquetasSection';
import { AiConfigFollowUpSection } from './sections/AiConfigFollowUpSection';
import { AiConfigVisitasSection } from './sections/AiConfigVisitasSection';
import {
  EMPTY_AI_CONFIG_FORM,
  parseAiConfigSection,
  type AiConfigFormState,
  type AiConfigSectionId,
} from './constants';
import {
  asText,
  buildChecklist,
  fillPercent,
  formatSavedAt,
  softImpactMetrics,
} from './helpers';

function formFromCompany(company: {
  ai_initial_message?: string | null;
  ai_assistant_name?: string | null;
  ai_unknown_info_message?: string | null;
  ai_company_mission?: string | null;
  ai_tone?: string | null;
  ai_payment_methods?: string | null;
  ai_visit_policy?: string | null;
  ai_target_audience?: string | null;
  ai_rules?: string | null;
  ai_additional_info?: string | null;
  business_hours?: string | null;
}): AiConfigFormState {
  return {
    aiInitialMessage: asText(company.ai_initial_message),
    aiAssistantName: asText(company.ai_assistant_name),
    aiUnknownInfoMessage: asText(company.ai_unknown_info_message),
    aiCompanyMission: asText(company.ai_company_mission),
    aiTone: asText(company.ai_tone),
    aiPaymentMethods: asText(company.ai_payment_methods),
    aiVisitPolicy: asText(company.ai_visit_policy),
    aiTargetAudience: asText(company.ai_target_audience),
    aiRules: asText(company.ai_rules),
    aiAdditionalInfo: asText(company.ai_additional_info),
    businessHoursSchedule: parseBusinessHours(company.business_hours),
  };
}

function isFormDirty(
  form: AiConfigFormState,
  company: {
    ai_initial_message?: string | null;
    ai_assistant_name?: string | null;
    ai_unknown_info_message?: string | null;
    ai_company_mission?: string | null;
    ai_tone?: string | null;
    ai_payment_methods?: string | null;
    ai_visit_policy?: string | null;
    ai_target_audience?: string | null;
    ai_rules?: string | null;
    ai_additional_info?: string | null;
    business_hours?: string | null;
  },
): boolean {
  const baseline = formFromCompany(company);
  return !(
    form.aiInitialMessage === baseline.aiInitialMessage &&
    form.aiAssistantName === baseline.aiAssistantName &&
    form.aiUnknownInfoMessage === baseline.aiUnknownInfoMessage &&
    form.aiCompanyMission === baseline.aiCompanyMission &&
    form.aiTone === baseline.aiTone &&
    form.aiPaymentMethods === baseline.aiPaymentMethods &&
    form.aiVisitPolicy === baseline.aiVisitPolicy &&
    form.aiTargetAudience === baseline.aiTargetAudience &&
    form.aiRules === baseline.aiRules &&
    form.aiAdditionalInfo === baseline.aiAdditionalInfo &&
    serializeBusinessHours(form.businessHoursSchedule) ===
      serializeBusinessHours(baseline.businessHoursSchedule)
  );
}

export function AiConfigurationView() {
  const { company, loading, updating, isManager, updateCompany } = useOwnCompany();
  const { isOfficialApi, loadingApiMode } = useCompanyApiMode();
  const { users, loadUsers } = useCompanyUsers();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parseAiConfigSection(searchParams.get('section'));

  const [togglingAi, setTogglingAi] = useState(false);
  const [activationBlockers, setActivationBlockers] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const aiEnabled = company?.ai_assistant_enabled ?? false;
  const [form, setForm] = useState<AiConfigFormState>(EMPTY_AI_CONFIG_FORM);
  const [visitSchedulingConfig, setVisitSchedulingConfig] = useState<AiVisitSchedulingConfig>(
    () => companyRowToVisitSchedulingConfig(null),
  );
  const [visitDraft, setVisitDraft] = useState<AiVisitSchedulingConfig>(
    () => companyRowToVisitSchedulingConfig(null),
  );

  const hasChanges = useMemo(
    () => (company ? isFormDirty(form, company) : false),
    [form, company],
  );

  const brokerCount = useMemo(
    () => users.filter((u) => u.isActive && (u.role === 'corretor' || u.role === 'gestor')).length,
    [users],
  );

  const percent = useMemo(
    () => fillPercent(form, visitDraft, brokerCount),
    [form, visitDraft, brokerCount],
  );

  const checklist = useMemo(
    () => buildChecklist(form, visitDraft, brokerCount),
    [form, visitDraft, brokerCount],
  );

  const impactMetrics = useMemo(() => softImpactMetrics(), []);

  const setSection = (next: AiConfigSectionId) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'identidade') {
          params.delete('section');
        } else {
          params.set('section', next);
        }
        return params;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (!company?.id) return;
    loadUsers(undefined, ['corretor', 'gestor'], false);
  }, [company?.id, loadUsers]);

  useEffect(() => {
    if (!company?.id) {
      setActivationBlockers([]);
      return;
    }
    if (loadingApiMode) return;

    let cancelled = false;
    void getAiActivationBlockers(company.id, company, { isOfficialApi }).then((blockers) => {
      if (!cancelled) setActivationBlockers(blockers);
    });
    return () => {
      cancelled = true;
    };
  }, [company, isOfficialApi, loadingApiMode]);

  useEffect(() => {
    if (!company) return;
    const next = companyRowToVisitSchedulingConfig(company);
    setVisitSchedulingConfig(next);
    setVisitDraft(next);
  }, [company]);

  useEffect(() => {
    if (!company?.id || !isManager) return;
    const legacy = loadLegacyLocalVisitSchedulingConfig(company.id);
    if (!legacy?.updatedAt) return;
    const dbConfig = companyRowToVisitSchedulingConfig(company);
    if (!configsEqual(legacy, dbConfig)) {
      void (async () => {
        const ok = await updateCompany({
          ai_visit_broker_mode: legacy.mode,
          ai_visit_priority_criterion: legacy.priorityCriterion,
          ai_visit_broker_priorities: legacy.brokerPriorities,
        });
        if (ok) clearLegacyLocalVisitSchedulingConfig(company.id);
      })();
    } else {
      clearLegacyLocalVisitSchedulingConfig(company.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate once per company/manager
  }, [company?.id, isManager]);

  useEffect(() => {
    if (!company) return;
    setForm(formFromCompany(company));
  }, [company]);

  const patchForm = (patch: Partial<AiConfigFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateSchedule = (dayKey: string, patch: Partial<DaySchedule>) => {
    setForm((prev) => ({
      ...prev,
      businessHoursSchedule: prev.businessHoursSchedule.map((day) =>
        day.dayKey === dayKey ? { ...day, ...patch } : day,
      ),
    }));
  };

  const handleToggleAi = async (checked: boolean) => {
    if (!isManager || !company) return;

    if (checked) {
      const blockers = await getAiActivationBlockers(company.id, company, { isOfficialApi });
      if (blockers.length > 0) {
        setActivationBlockers(blockers);
        toast.error(formatActivationBlockersMessage(blockers), { duration: 8000 });
        return;
      }
    }

    setTogglingAi(true);
    try {
      const ok = await updateCompany({ ai_assistant_enabled: checked });
      if (!ok) return;
      toast.success(checked ? 'Assistente IA ativada' : 'Assistente IA desativada');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar status da IA';
      toast.error(msg);
    } finally {
      setTogglingAi(false);
    }
  };

  const handleSave = async () => {
    const ok = await updateCompany({
      business_hours: serializeBusinessHours(form.businessHoursSchedule),
      ai_initial_message: form.aiInitialMessage,
      ai_assistant_name: form.aiAssistantName,
      ai_unknown_info_message: form.aiUnknownInfoMessage,
      ai_company_mission: form.aiCompanyMission,
      ai_tone: form.aiTone,
      ai_payment_methods: form.aiPaymentMethods,
      ai_visit_policy: form.aiVisitPolicy,
      ai_target_audience: form.aiTargetAudience,
      ai_rules: form.aiRules,
      ai_additional_info: form.aiAdditionalInfo,
    });
    if (ok) {
      setLastSavedAt(new Date().toISOString());
      toast.success('Configurações salvas');
    }
  };

  const goTest = () => {
    window.location.assign('/ai-test');
  };

  const goHistory = () => {
    toast.message('Histórico de alterações da IA ainda não está disponível nesta versão.');
  };

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  const showSidebar = section !== 'etiquetas' && section !== 'followup';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
        <div className="border-b border-border/70">
          <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
            <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
              <AiConfigTopBar />
              <AiConfigToolbar
                saving={updating}
                canSave={isManager && hasChanges}
                onHistory={goHistory}
                onTest={goTest}
                onSave={() => void handleSave()}
              />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
          <AiConfigStatusBar
            aiEnabled={aiEnabled}
            isManager={isManager}
            toggling={togglingAi}
            updating={updating}
            savedAtLabel={lastSavedAt ? formatSavedAt(lastSavedAt) : undefined}
            hasChanges={hasChanges}
            activationBlockers={activationBlockers}
            onToggleAi={(checked) => void handleToggleAi(checked)}
          />

          <AiConfigSectionNav
            section={section}
            fillPercent={percent}
            onSectionChange={setSection}
          />

          {section === 'etiquetas' ? (
            <div className="space-y-3">
              <AiConfigEtiquetasSection />
            </div>
          ) : section === 'followup' ? (
            <div className="space-y-3">
              <AiConfigFollowUpSection />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)] gap-4 items-start">
              <div className="min-w-0 space-y-4">
                {section === 'identidade' && (
                  <AiConfigIdentidadeSection
                    form={form}
                    isManager={isManager}
                    onChange={patchForm}
                  />
                )}
                {section === 'contexto' && (
                  <AiConfigContextoSection
                    form={form}
                    isManager={isManager}
                    onChange={patchForm}
                  />
                )}
                {section === 'horario' && (
                  <AiConfigHorarioSection
                    form={form}
                    isManager={isManager}
                    onChange={patchForm}
                    onChangeDay={updateSchedule}
                  />
                )}
                {section === 'visitas' && (
                  <AiConfigVisitasSection
                    companyId={company?.id}
                    isManager={isManager}
                    initialConfig={visitSchedulingConfig}
                    externalSaving={updating}
                    onDraftChange={setVisitDraft}
                    onSave={async (config) =>
                      updateCompany({
                        ai_visit_broker_mode: config.mode,
                        ai_visit_priority_criterion: config.priorityCriterion,
                        ai_visit_broker_priorities: config.brokerPriorities,
                      })
                    }
                  />
                )}
              </div>

              {showSidebar && (
                <aside className="space-y-4 min-w-0 xl:sticky xl:top-4">
                  <AiConfigPreview
                    assistantName={form.aiAssistantName}
                    companyName={company?.name || ''}
                    initialMessage={form.aiInitialMessage}
                  />
                  <AiConfigChecklist items={checklist} />
                  <AiConfigImpactCard metrics={impactMetrics} />
                </aside>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AiConfigurationView;
