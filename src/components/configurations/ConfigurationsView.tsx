import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOwnCompany } from '@/hooks/useOwnCompany';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { normalizePhoneForStorage } from '@/lib/normalizePhone';
import {
  DEFAULT_PREFERENCES,
  EMPTY_COMPANY_FORM,
  parseConfigSection,
  type CompanyFormState,
  type ConfigSectionId,
  type PreferencesState,
} from './constants';
import {
  buildChecklist,
  buildKpis,
  buildUsageBars,
  capitalizePlan,
  formFromCompany,
  formatDateBr,
  isCompanyFormDirty,
  loadLocalCreci,
  loadLocalPreferences,
  renewDateIso,
  saveLocalCreci,
  saveLocalPreferences,
  softActivityLog,
} from './helpers';
import { ConfigurationsTopBar } from './ConfigurationsTopBar';
import { ConfigurationsToolbar } from './ConfigurationsToolbar';
import { ConfigurationsKpis } from './ConfigurationsKpis';
import { ConfigurationsSectionNav } from './ConfigurationsSectionNav';
import { ConfigurationsAccountCard } from './ConfigurationsAccountCard';
import { ConfigurationsChecklist } from './ConfigurationsChecklist';
import { ConfigurationsActivityCard } from './ConfigurationsActivityCard';
import { CompanyDataSection } from './sections/CompanyDataSection';
import { AddressSection } from './sections/AddressSection';
import { PlanSection } from './sections/PlanSection';
import { PreferencesSection } from './sections/PreferencesSection';
import { AppSection } from './sections/AppSection';

function prefsEqual(a: PreferencesState, b: PreferencesState): boolean {
  return (
    a.notifyNewLeads === b.notifyNewLeads &&
    a.visitConfirmation === b.visitConfirmation &&
    a.managerWhatsappAlerts === b.managerWhatsappAlerts &&
    a.platformNews === b.platformNews &&
    a.timezone === b.timezone
  );
}

export function ConfigurationsView() {
  const { company, loading, updating, isManager, updateCompany } = useOwnCompany();
  const {
    settings,
    loading: settingsLoading,
    updating: settingsUpdating,
    uploadLogo,
    updateSetting,
  } = useCompanySettings();
  const { users, loadUsers } = useCompanyUsers();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parseConfigSection(searchParams.get('section'));

  const [form, setForm] = useState<CompanyFormState>(EMPTY_COMPANY_FORM);
  const [creciBaseline, setCreciBaseline] = useState('');
  const [prefs, setPrefs] = useState<PreferencesState>(DEFAULT_PREFERENCES);
  const [prefsBaseline, setPrefsBaseline] = useState<PreferencesState>(DEFAULT_PREFERENCES);
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [whatsappCount, setWhatsappCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const setSection = (next: ConfigSectionId) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'empresa') params.delete('section');
        else params.set('section', next);
        return params;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (!company?.id) return;
    void loadUsers(undefined, undefined, false);
  }, [company?.id, loadUsers]);

  useEffect(() => {
    if (!company) return;
    const creci = loadLocalCreci(company.id);
    setCreciBaseline(creci);
    setForm(formFromCompany(company, creci));
  }, [company]);

  useEffect(() => {
    if (!company?.id) return;
    const tz = settings?.timezone || DEFAULT_PREFERENCES.timezone;
    const loaded = loadLocalPreferences(company.id, tz);
    // Prefer live timezone from company_settings when present
    const next = { ...loaded, timezone: settings?.timezone || loaded.timezone };
    setPrefs(next);
    setPrefsBaseline(next);
  }, [company?.id, settings?.timezone]);

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;

    void (async () => {
      try {
        const [{ count: propsCount }, { count: waCount }] = await Promise.all([
          supabase
            .from('imoveisvivareal')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),
          supabase
            .from('whatsapp_instances')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id),
        ]);
        if (cancelled) return;
        setPropertiesCount(propsCount ?? 0);
        setWhatsappCount(waCount ?? 0);
      } catch {
        if (!cancelled) {
          setPropertiesCount(null);
          setWhatsappCount(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  const companyDirty = useMemo(
    () => (company ? isCompanyFormDirty(form, company, creciBaseline) : false),
    [form, company, creciBaseline],
  );

  const prefsDirty = useMemo(() => !prefsEqual(prefs, prefsBaseline), [prefs, prefsBaseline]);

  const hasChanges = companyDirty || prefsDirty;

  const checklist = useMemo(() => buildChecklist(form), [form]);

  const activeUsers = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const maxUsers = company?.max_users ?? 0;
  const renewIso = renewDateIso(company);
  const daysRemaining = (() => {
    if (!company) return null;
    const target = renewIso;
    if (!target) return null;
    const diff = Math.ceil((new Date(target).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  const kpis = useMemo(
    () =>
      buildKpis({
        status: company?.subscription_status,
        daysRemaining,
        plan: company?.plan,
        renewAt: renewIso,
        usersCount: activeUsers,
        maxUsers,
        checklist,
      }),
    [company?.subscription_status, company?.plan, daysRemaining, renewIso, activeUsers, maxUsers, checklist],
  );

  const usage = useMemo(
    () =>
      buildUsageBars({
        usersCount: activeUsers,
        maxUsers: maxUsers || 1,
        propertiesCount,
        whatsappCount,
      }),
    [activeUsers, maxUsers, propertiesCount, whatsappCount],
  );

  const activity = useMemo(() => softActivityLog(company), [company]);

  const accountProgress =
    daysRemaining == null ? 100 : Math.min(100, Math.max(8, Math.round((daysRemaining / 365) * 100)));

  const subtitle = company
    ? `Dados cadastrais, endereço e plano da imobiliária · conta criada em ${formatDateBr(company.created_at)}`
    : 'Dados cadastrais, endereço e plano da imobiliária';

  const patchForm = (patch: Partial<CompanyFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const patchPrefs = (patch: Partial<PreferencesState>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  };

  const handleDiscard = () => {
    if (!company) return;
    setForm(formFromCompany(company, creciBaseline));
    setPrefs({ ...prefsBaseline });
    toast.message('Alterações descartadas');
  };

  const handleSave = async () => {
    if (!isManager || !company) {
      toast.error('Sem permissão para salvar');
      return;
    }

    setSaving(true);
    try {
      let ok = true;

      if (companyDirty) {
        ok = await updateCompany({
          name: form.companyName,
          contact_name: form.contactName,
          email: form.email,
          cnpj: form.cnpj,
          phone: normalizePhoneForStorage(form.phone) || null,
          address: form.address,
          address_number: form.addressNumber,
          address_complement: form.addressComplement,
          address_neighborhood: form.addressNeighborhood,
          address_city: form.addressCity,
          address_state: form.addressState,
          address_zip_code: form.addressZipCode,
        });
        if (ok) {
          saveLocalCreci(company.id, form.creci);
          setCreciBaseline(form.creci);
        }
      }

      if (ok && prefsDirty) {
        saveLocalPreferences(company.id, prefs);
        if (prefs.timezone !== (settings?.timezone || '')) {
          const tzOk = await updateSetting('timezone', prefs.timezone);
          if (!tzOk) ok = false;
        }
        if (ok) setPrefsBaseline({ ...prefs });
      }

      if (ok && prefsDirty && !companyDirty) {
        toast.success('Preferências salvas');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!isManager) {
      toast.error('Sem permissão para alterar o logo');
      return;
    }
    await uploadLogo(file);
  };

  const busy = loading || settingsLoading;
  const isSaving = saving || updating || settingsUpdating === 'timezone';

  if (busy) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center bg-[#F7F5F0] dark:bg-background text-muted-foreground">
        Empresa não encontrada
      </div>
    );
  }

  const logoUrl = settings?.logo_url || company.logo_url;

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-2 space-y-2 sm:px-4 sm:py-3 sm:space-y-3 md:px-6 md:py-4 md:space-y-4">
            <ConfigurationsTopBar />
            <ConfigurationsToolbar
              subtitle={subtitle}
              saving={isSaving}
              canSave={isManager && hasChanges}
              canDiscard={hasChanges}
              onDiscard={handleDiscard}
              onSave={() => void handleSave()}
            />
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background">
        <ConfigurationsKpis items={kpis} />

        <ConfigurationsSectionNav
          section={section}
          hasChanges={hasChanges}
          onSectionChange={setSection}
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)] gap-4 items-start">
          <div className="min-w-0 space-y-4">
            {section === 'empresa' && (
              <CompanyDataSection
                form={form}
                isManager={isManager}
                logoUrl={logoUrl}
                logoUpdating={settingsUpdating === 'logo_url'}
                onChange={patchForm}
                onUploadLogo={(file) => void handleUploadLogo(file)}
              />
            )}
            {section === 'endereco' && (
              <AddressSection form={form} isManager={isManager} onChange={patchForm} />
            )}
            {section === 'plano' && (
              <PlanSection
                plan={company.plan}
                maxUsers={maxUsers}
                status={company.subscription_status}
                clientSince={formatDateBr(company.created_at)}
                usage={usage}
              />
            )}
            {section === 'preferencias' && (
              <PreferencesSection prefs={prefs} isManager={isManager} onChange={patchPrefs} />
            )}
            {section === 'aplicativo' && <AppSection />}
          </div>

          <aside className="space-y-4 min-w-0 xl:sticky xl:top-4">
            <ConfigurationsAccountCard
              planLabel={capitalizePlan(company.plan)}
              daysRemaining={daysRemaining}
              startLabel={formatDateBr(company.created_at)}
              renewLabel={formatDateBr(renewIso)}
              progress={accountProgress}
            />
            <ConfigurationsChecklist items={checklist} />
            <ConfigurationsActivityCard items={activity} />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default ConfigurationsView;
