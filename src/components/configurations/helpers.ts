import type { LucideIcon } from 'lucide-react';
import { Building2, CircleDot, Contrast, LayoutPanelLeft } from 'lucide-react';
import { formatBrazilianMobileInput, normalizePhoneForStorage } from '@/lib/normalizePhone';
import type { OwnCompanyData } from '@/hooks/useOwnCompany';
import {
  DEFAULT_PREFERENCES,
  SOFT_MAX_PROPERTIES,
  SOFT_MAX_WHATSAPP,
  type CompanyFormState,
  type ConfigSectionId,
  type PreferencesState,
} from './constants';

/** Forest green for sticky account card (match cream mockups). */
export const CONFIG_EMERALD = '#0C2919';

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
};

export type ConfigKpiItem = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'positive' | 'negative' | 'warning' | 'neutral';
  progress?: number;
  progressClass?: string;
  dot: string;
};

export type ActivityItem = {
  id: string;
  text: string;
  when: string;
  tone: 'green' | 'purple' | 'amber';
};

export type UsageBar = {
  id: string;
  label: string;
  used: number;
  max: number;
  barClass: string;
};

export const SECTION_NAV: ReadonlyArray<{
  id: ConfigSectionId;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: 'empresa', label: 'Dados da empresa', Icon: Building2 },
  { id: 'endereco', label: 'Endereço', Icon: CircleDot },
  { id: 'plano', label: 'Plano e assinatura', Icon: LayoutPanelLeft },
  { id: 'preferencias', label: 'Preferências', Icon: Contrast },
];

export function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTimeShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export function capitalizePlan(plan: string | null | undefined): string {
  const raw = (plan || '—').trim();
  if (!raw || raw === '—') return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function statusLabel(status: string | null | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'Ativa';
    case 'trial':
      return 'Período de teste';
    case 'grace':
      return 'Carência';
    case 'expired':
      return 'Expirada';
    case 'blocked':
      return 'Bloqueada';
    default:
      return status ? capitalizePlan(status) : '—';
  }
}

export function formFromCompany(company: OwnCompanyData, creci = ''): CompanyFormState {
  return {
    companyName: asText(company.name),
    contactName: asText(company.contact_name),
    email: asText(company.email),
    cnpj: asText(company.cnpj),
    phone: formatBrazilianMobileInput(asText(company.phone)),
    creci,
    address: asText(company.address),
    addressNumber: asText(company.address_number),
    addressComplement: asText(company.address_complement),
    addressNeighborhood: asText(company.address_neighborhood),
    addressCity: asText(company.address_city),
    addressState: asText(company.address_state),
    addressZipCode: asText(company.address_zip_code),
  };
}

export function isCompanyFormDirty(
  form: CompanyFormState,
  company: OwnCompanyData,
  creciBaseline = '',
): boolean {
  const baseline = formFromCompany(company, creciBaseline);
  return !(
    form.companyName === baseline.companyName &&
    form.contactName === baseline.contactName &&
    form.email === baseline.email &&
    form.cnpj === baseline.cnpj &&
    normalizePhoneForStorage(form.phone) === normalizePhoneForStorage(baseline.phone) &&
    form.creci === baseline.creci &&
    form.address === baseline.address &&
    form.addressNumber === baseline.addressNumber &&
    form.addressComplement === baseline.addressComplement &&
    form.addressNeighborhood === baseline.addressNeighborhood &&
    form.addressCity === baseline.addressCity &&
    form.addressState === baseline.addressState &&
    form.addressZipCode === baseline.addressZipCode
  );
}

export function isAddressComplete(form: CompanyFormState): boolean {
  return Boolean(
    form.addressZipCode.trim() &&
      form.address.trim() &&
      form.addressNumber.trim() &&
      form.addressNeighborhood.trim() &&
      form.addressCity.trim() &&
      form.addressState.trim(),
  );
}

export function isCnpjFilled(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  return digits.length === 14 && !/^0+$/.test(digits);
}

export function buildChecklist(form: CompanyFormState): ChecklistItem[] {
  const nameOk = Boolean(form.companyName.trim() && form.contactName.trim());
  const contactOk = Boolean(form.email.trim() && form.phone.trim());
  const creciOk = Boolean(form.creci.trim());
  const cnpjOk = isCnpjFilled(form.cnpj);
  const addressOk = isAddressComplete(form);

  return [
    { id: 'nome', label: 'Nome e responsável', detail: nameOk ? 'ok' : 'pendente', ok: nameOk },
    { id: 'contato', label: 'E-mail e telefone', detail: contactOk ? 'ok' : 'pendente', ok: contactOk },
    { id: 'creci', label: 'CRECI', detail: creciOk ? 'ok' : 'pendente', ok: creciOk },
    { id: 'cnpj', label: 'CNPJ', detail: cnpjOk ? 'ok' : 'pendente', ok: cnpjOk },
    { id: 'endereco', label: 'Endereço completo', detail: addressOk ? 'ok' : 'pendente', ok: addressOk },
  ];
}

export function cadastroPercent(checklist: ChecklistItem[]): number {
  if (!checklist.length) return 0;
  const ok = checklist.filter((c) => c.ok).length;
  return Math.round((ok / checklist.length) * 100);
}

export function buildKpis(args: {
  status: string | null | undefined;
  daysRemaining: number | null;
  plan: string | null | undefined;
  renewAt: string | null | undefined;
  usersCount: number;
  maxUsers: number;
  checklist: ChecklistItem[];
}): ConfigKpiItem[] {
  const percent = cadastroPercent(args.checklist);
  const pending = args.checklist.find((c) => !c.ok);
  const slots = Math.max(0, args.maxUsers - args.usersCount);
  const days = args.daysRemaining;
  const statusProgress =
    days == null ? 100 : Math.min(100, Math.max(8, Math.round((days / 365) * 100)));
  const renewLabel = args.renewAt
    ? `renova em ${formatDateBr(args.renewAt)}`
    : days != null
      ? `${days} dias restantes`
      : '—';

  return [
    {
      key: 'status',
      label: 'Status da conta',
      value: statusLabel(args.status),
      hint:
        days == null
          ? 'Sem data de expiração'
          : days === 0
            ? 'Expira hoje'
            : `${days} dias restantes`,
      hintTone: days != null && days <= 7 ? 'warning' : 'positive',
      progress: statusProgress,
      progressClass: 'bg-emerald-600',
      dot: 'bg-emerald-500',
    },
    {
      key: 'plano',
      label: 'Plano',
      value: capitalizePlan(args.plan),
      hint: renewLabel,
      hintTone: 'neutral',
      progress: 72,
      progressClass: 'bg-violet-500',
      dot: 'bg-violet-500',
    },
    {
      key: 'usuarios',
      label: 'Usuários',
      value: `${args.usersCount} / ${args.maxUsers || '—'}`,
      hint: `${slots} vagas disponíveis`,
      hintTone: 'neutral',
      progress: args.maxUsers > 0 ? Math.min(100, Math.round((args.usersCount / args.maxUsers) * 100)) : 0,
      progressClass: 'bg-sky-500',
      dot: 'bg-sky-500',
    },
    {
      key: 'cadastro',
      label: 'Cadastro',
      value: `${percent}%`,
      hint: pending ? `${pending.label} pendente`.replace(' completo', '') : 'Completo',
      hintTone: pending ? 'warning' : 'positive',
      progress: percent,
      progressClass: 'bg-amber-500',
      dot: 'bg-amber-500',
    },
  ];
}

export function buildUsageBars(args: {
  usersCount: number;
  maxUsers: number;
  propertiesCount: number | null;
  whatsappCount: number | null;
}): UsageBar[] {
  return [
    {
      id: 'users',
      label: 'Usuários',
      used: args.usersCount,
      max: Math.max(1, args.maxUsers || 1),
      barClass: 'bg-emerald-600',
    },
    {
      id: 'properties',
      label: 'Imóveis cadastrados',
      used: args.propertiesCount ?? 0,
      max: SOFT_MAX_PROPERTIES,
      barClass: 'bg-sky-500',
    },
    {
      id: 'whatsapp',
      label: 'Instâncias WhatsApp',
      used: args.whatsappCount ?? 0,
      max: SOFT_MAX_WHATSAPP,
      barClass: 'bg-amber-500',
    },
  ];
}

export function softActivityLog(company: OwnCompanyData | null): ActivityItem[] {
  if (!company) return [];
  const when = formatDateTimeShort(company.created_at);
  const name = company.contact_name || 'equipe';
  return [
    {
      id: '1',
      text: company.phone
        ? `Telefone da empresa atualizado por ${name}.`
        : `Conta criada por ${name}.`,
      when,
      tone: 'green',
    },
    {
      id: '2',
      text: `Plano renovado automaticamente · ${capitalizePlan(company.plan)}.`,
      when: formatDateTimeShort(company.subscription_expires_at || company.created_at),
      tone: 'purple',
    },
  ];
}

export function prefsStorageKey(companyId: string): string {
  return `iafe:config-prefs:${companyId}`;
}

export function creciStorageKey(companyId: string): string {
  return `iafe:config-creci:${companyId}`;
}

export function loadLocalPreferences(companyId: string, timezoneFallback: string): PreferencesState {
  try {
    const raw = localStorage.getItem(prefsStorageKey(companyId));
    if (!raw) {
      return { ...DEFAULT_PREFERENCES, timezone: timezoneFallback || DEFAULT_PREFERENCES.timezone };
    }
    const parsed = JSON.parse(raw) as Partial<PreferencesState>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      timezone: parsed.timezone || timezoneFallback || DEFAULT_PREFERENCES.timezone,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES, timezone: timezoneFallback || DEFAULT_PREFERENCES.timezone };
  }
}

export function saveLocalPreferences(companyId: string, prefs: PreferencesState): void {
  localStorage.setItem(prefsStorageKey(companyId), JSON.stringify(prefs));
}

export function loadLocalCreci(companyId: string): string {
  try {
    return localStorage.getItem(creciStorageKey(companyId)) || '';
  } catch {
    return '';
  }
}

export function saveLocalCreci(companyId: string, creci: string): void {
  localStorage.setItem(creciStorageKey(companyId), creci);
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export async function lookupCep(cep: string): Promise<{
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
} | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro) return null;
  return {
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    localidade: data.localidade || '',
    uf: data.uf || '',
  };
}

export function formatCepInput(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function renewDateIso(company: OwnCompanyData | null): string | null {
  if (!company) return null;
  if (company.subscription_status === 'trial' && company.trial_ends_at) return company.trial_ends_at;
  return company.subscription_expires_at;
}
