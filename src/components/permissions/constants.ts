import type { LucideIcon } from 'lucide-react';
import { Building2, LayoutGrid, Menu, Shield } from 'lucide-react';

export const PERMISSIONS_EMERALD = '#0C2919';

export type PermissionSectionId = 'imoveis' | 'leads' | 'menus' | 'admin';

export type PermissionFilterId = 'all' | PermissionSectionId;

export type PermissionDisplayMeta = {
  title: string;
  description: string;
  sensitive?: boolean;
  escrita?: boolean;
};

/** Display copy aligned to cream mockups (keys unchanged in DB). */
export const PERMISSION_DISPLAY: Record<string, PermissionDisplayMeta> = {
  leads_read: {
    title: 'Visualizar leads',
    description: 'Ver os leads da empresa',
  },
  leads_write: {
    title: 'Gerenciar leads',
    description: 'Criar, editar e excluir leads',
    escrita: true,
  },
  imoveisvivareal_read: {
    title: 'Visualizar imóveis',
    description: 'Ver imóveis da empresa',
  },
  imoveisvivareal_write: {
    title: 'Gerenciar imóveis',
    description: 'Criar, editar e excluir imóveis',
    escrita: true,
  },
  menu_clients_crm: {
    title: 'CRM de clientes',
    description: 'Acesso à base completa de relacionamento',
  },
  menu_dashboard: {
    title: 'Painel',
    description: 'Acesso ao dashboard e indicadores',
  },
  menu_properties: {
    title: 'Propriedades',
    description: 'Acesso ao módulo de propriedades',
  },
  menu_agenda: {
    title: 'Agenda',
    description: 'Acesso ao módulo de agenda',
  },
  menu_plantao: {
    title: 'Plantão',
    description: 'Acesso à escala e calendários',
  },
  menu_clients: {
    title: 'Pipeline de clientes',
    description: 'Acesso ao funil comercial',
  },
  menu_conversas: {
    title: 'Conversas',
    description: 'Acesso ao atendimento por WhatsApp',
  },
  menu_contracts: {
    title: 'Contratos',
    description: 'Acesso ao módulo de contratos',
  },
  menu_inquilinato: {
    title: 'Lei do inquilinato',
    description: 'Consulta jurídica de locação',
  },
  menu_marketing: {
    title: 'Presença digital',
    description: 'Site vitrine, landing pages e visitas',
  },
  menu_reports: {
    title: 'Relatórios',
    description: 'Exportações e relatórios gerenciais',
  },
  menu_disparador: {
    title: 'Disparador',
    description: 'Envio de campanhas em massa',
    sensitive: true,
  },
  menu_users: {
    title: 'Usuários',
    description: 'Convidar, editar e desativar membros',
    sensitive: true,
  },
  menu_permissions: {
    title: 'Permissões',
    description: 'Alterar o que cada perfil pode fazer',
    sensitive: true,
  },
  menu_configurations: {
    title: 'Configurações',
    description: 'Dados da empresa, plano e preferências',
  },
  menu_connections: {
    title: 'Conexões',
    description: 'Instâncias WhatsApp e integrações',
  },
  menu_security_monitoring: {
    title: 'Monitoramento',
    description: 'Logs de segurança e auditoria',
    sensitive: true,
  },
};

export const SECTION_DEFS: ReadonlyArray<{
  id: PermissionSectionId;
  label: string;
  keys: readonly string[];
  Icon: LucideIcon;
  /** Soft tint for the module icon chip */
  iconTone: 'green' | 'blue' | 'violet' | 'amber';
}> = [
  {
    id: 'imoveis',
    label: 'Imóveis',
    Icon: Building2,
    iconTone: 'green',
    keys: ['imoveisvivareal_read', 'imoveisvivareal_write'],
  },
  {
    id: 'leads',
    label: 'Leads e CRM',
    Icon: LayoutGrid,
    iconTone: 'blue',
    keys: ['leads_read', 'leads_write', 'menu_clients_crm'],
  },
  {
    id: 'menus',
    label: 'Menus de navegação',
    Icon: Menu,
    iconTone: 'violet',
    keys: [
      'menu_dashboard',
      'menu_properties',
      'menu_agenda',
      'menu_plantao',
      'menu_clients',
      'menu_conversas',
      'menu_contracts',
      'menu_inquilinato',
      'menu_marketing',
      'menu_reports',
      'menu_disparador',
    ],
  },
  {
    id: 'admin',
    label: 'Administração',
    Icon: Shield,
    iconTone: 'amber',
    keys: [
      'menu_users',
      'menu_permissions',
      'menu_configurations',
      'menu_connections',
      'menu_security_monitoring',
    ],
  },
];

export const FILTER_PILLS: ReadonlyArray<{
  id: PermissionFilterId;
  label: string;
}> = [
  { id: 'all', label: 'Todos' },
  { id: 'imoveis', label: 'Imóveis' },
  { id: 'leads', label: 'Leads e CRM' },
  { id: 'menus', label: 'Menus de navegação' },
  { id: 'admin', label: 'Administração' },
];

export const COLUMN_ROLES = ['gestor', 'corretor'] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

export const ROLE_COLUMN_LABEL: Record<ColumnRole | 'admin', string> = {
  gestor: 'Gestor',
  corretor: 'Corretor',
  admin: 'Administrador',
};

export const MATRIX_GRID =
  'grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem_6.75rem] sm:grid-cols-[minmax(0,1fr)_6rem_6rem_7.5rem] gap-2 items-center';

export const BEST_PRACTICES = [
  'Conceda o mínimo necessário — roles amplos aumentam risco operacional.',
  'Itens SENSÍVEL afetam segurança e cobrança; revise com cuidado.',
  'Alterações passam a valer no próximo login do usuário afetado.',
] as const;

export const PAGE_SUBTITLE =
  'Controle o que cada perfil pode ver e fazer. O administrador tem acesso total e não pode ser restringido.';
