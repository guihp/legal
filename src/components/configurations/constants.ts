export const CONFIG_SECTIONS = [
  'empresa',
  'endereco',
  'plano',
  'preferencias',
  'aplicativo',
] as const;

export type ConfigSectionId = (typeof CONFIG_SECTIONS)[number];

export const DEFAULT_CONFIG_SECTION: ConfigSectionId = 'empresa';

export function parseConfigSection(raw: string | null): ConfigSectionId {
  if (raw && (CONFIG_SECTIONS as readonly string[]).includes(raw)) {
    return raw as ConfigSectionId;
  }
  return DEFAULT_CONFIG_SECTION;
}

export type CompanyFormState = {
  companyName: string;
  contactName: string;
  email: string;
  cnpj: string;
  phone: string;
  creci: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
};

export type PreferencesState = {
  notifyNewLeads: boolean;
  visitConfirmation: boolean;
  managerWhatsappAlerts: boolean;
  platformNews: boolean;
  timezone: string;
};

export const EMPTY_COMPANY_FORM: CompanyFormState = {
  companyName: '',
  contactName: '',
  email: '',
  cnpj: '',
  phone: '',
  creci: '',
  address: '',
  addressNumber: '',
  addressComplement: '',
  addressNeighborhood: '',
  addressCity: '',
  addressState: '',
  addressZipCode: '',
};

export const DEFAULT_PREFERENCES: PreferencesState = {
  notifyNewLeads: true,
  visitConfirmation: true,
  managerWhatsappAlerts: true,
  platformNews: false,
  timezone: 'America/Sao_Paulo',
};

export const TIMEZONE_OPTIONS = [
  'America/Fortaleza',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Recife',
  'America/Bahia',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Rio_Branco',
  'America/Noronha',
] as const;

/** Soft plan property cap used in mockup usage bars when schema has no max. */
export const SOFT_MAX_PROPERTIES = 500;
/** Soft WhatsApp instance cap used in mockup usage bars. */
export const SOFT_MAX_WHATSAPP = 1;
