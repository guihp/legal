import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useOwnCompany } from '@/hooks/useOwnCompany';
import { useCompanyApiMode } from '@/hooks/useCompanyApiMode';
import { useCompanyAiLabels } from '@/hooks/useCompanyAiLabels';
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
import { AiConfigSectionNav } from './AiConfigSectionNav';
import { AiConfigGeralSection } from './sections/AiConfigGeralSection';
import { AiConfigIdentidadeSection } from './sections/AiConfigIdentidadeSection';
import { AiConfigContextoSection } from './sections/AiConfigContextoSection';
import { AiConfigEtiquetasSection } from './sections/AiConfigEtiquetasSection';
import { AiConfigVisitasSection } from './sections/AiConfigVisitasSection';
import {
  AI_CONFIG_SECTION_META,
  EMPTY_AI_CONFIG_FORM,
  parseAiConfigSection,
  type AiConfigFormState,
  type AiConfigSectionId,
} from './constants';

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
    aiInitialMessage: company.ai_initial_message || '',
    aiAssistantName: company.ai_assistant_name || '',
    aiUnknownInfoMessage: company.ai_unknown_info_message || '',
    aiCompanyMission: company.ai_company_mission || '',
    aiTone: company.ai_tone || '',
    aiPaymentMethods: company.ai_payment_methods || '',
    aiVisitPolicy: company.ai_visit_policy || '',
    aiTargetAudience: company.ai_target_audience || '',
    aiRules: company.ai_rules || '',
    aiAdditionalInfo: company.ai_additional_info || '',
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
  return !(
    form.aiInitialMessage === (company.ai_initial_message || '') &&
    form.aiAssistantName === (company.ai_assistant_name || '') &&
    form.aiUnknownInfoMessage === (company.ai_unknown_info_message || '') &&
    form.aiCompanyMission === (company.ai_company_mission || '') &&
    form.aiTone === (company.ai_tone || '') &&
    form.aiPaymentMethods === (company.ai_payment_methods || '') &&
    form.aiVisitPolicy === (company.ai_visit_policy || '') &&
    form.aiTargetAudience === (company.ai_target_audience || '') &&
    form.aiRules === (company.ai_rules || '') &&
    form.aiAdditionalInfo === (company.ai_additional_info || '') &&
    serializeBusinessHours(form.businessHoursSchedule) === (company.business_hours || '')
  );
}

export function AiConfigurationView() {
  const { company, loading, updating, isManager, updateCompany } = useOwnCompany();
  const { isOfficialApi, loadingApiMode } = useCompanyApiMode();
  const { labels } = useCompanyAiLabels();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parseAiConfigSection(searchParams.get('section'));

  const [togglingAi, setTogglingAi] = useState(false);
  const [activationBlockers, setActivationBlockers] = useState<string[]>([]);
  const aiEnabled = company?.ai_assistant_enabled ?? false;
  const [form, setForm] = useState<AiConfigFormState>(EMPTY_AI_CONFIG_FORM);
  const [visitSchedulingConfig, setVisitSchedulingConfig] = useState<AiVisitSchedulingConfig>(
    () => companyRowToVisitSchedulingConfig(null),
  );

  const hasChanges = useMemo(
    () => (company ? isFormDirty(form, company) : false),
    [form, company],
  );

  const setSection = (next: AiConfigSectionId) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'geral') {
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

  const canEnableAi = useMemo(() => activationBlockers.length === 0, [activationBlockers]);

  useEffect(() => {
    if (!company) return;
    setVisitSchedulingConfig(companyRowToVisitSchedulingConfig(company));
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
    if (ok) toast.success('Configurações salvas');
  };

  const handleDiscard = () => {
    if (!company) return;
    setForm(formFromCompany(company));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const sectionMeta = AI_CONFIG_SECTION_META[section];

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={`mx-auto max-w-5xl space-y-4 px-1 sm:px-0 ${hasChanges ? 'pb-24' : 'pb-6'}`}
      >
        <header className="flex items-start gap-3">
          <Bot className="mt-0.5 h-7 w-7 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
              Configuração para IA
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Textos e contexto usados pela assistente no atendimento.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <AiConfigSectionNav
            section={section}
            onSectionChange={setSection}
            aiEnabled={aiEnabled}
            hasChanges={hasChanges}
            labelsCount={labels.length}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="md:hidden">
              <h2 className="text-sm font-medium text-foreground">{sectionMeta.label}</h2>
              <p className="text-xs text-muted-foreground">{sectionMeta.description}</p>
            </div>

            {section === 'geral' && (
              <AiConfigGeralSection
                aiEnabled={aiEnabled}
                isManager={isManager}
                isOfficialApi={isOfficialApi}
                togglingAi={togglingAi}
                updating={updating}
                activationBlockers={activationBlockers}
                canEnableAi={canEnableAi}
                onToggleAi={handleToggleAi}
              />
            )}

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
                onChangeDay={updateSchedule}
              />
            )}

            {section === 'etiquetas' && <AiConfigEtiquetasSection />}

            {section === 'visitas' && (
              <AiConfigVisitasSection
                companyId={company?.id}
                isManager={isManager}
                initialConfig={visitSchedulingConfig}
                externalSaving={updating}
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
        </div>

        {hasChanges && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-sm text-muted-foreground">
                Você tem alterações não salvas
                {section !== 'identidade' && section !== 'contexto'
                  ? ' em Identidade/Contexto'
                  : ''}
                .
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={updating}
                  className="flex-1 sm:flex-none"
                >
                  <X className="mr-2 h-4 w-4" />
                  Descartar
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!isManager || updating}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none"
                >
                  {updating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default AiConfigurationView;
