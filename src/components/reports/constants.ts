import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Filter,
  Users,
  TrendingUp,
  Globe,
  MessageSquare,
  CalendarDays,
  Shield,
} from 'lucide-react';
import type { PeriodPreset } from '@/components/dashboard/helpers';

export type ReportCategory = 'portfolio' | 'comercial' | 'marketing' | 'operacao';
export type ReportBadge = 'GESTOR' | 'ADMIN' | null;
export type ReportId =
  | 'portfolio'
  | 'funnel'
  | 'brokers'
  | 'market'
  | 'digital'
  | 'attendance'
  | 'agenda'
  | 'audit';

export type ReportDef = {
  id: ReportId;
  title: string;
  description: string;
  category: ReportCategory;
  badge: ReportBadge;
  /** Minimum role that may see the card. */
  minRole: 'corretor' | 'gestor' | 'admin';
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  pages: number;
  fileSlug: string;
};

export const PAGE_SUBTITLE_PREFIX =
  'Gere, agende e baixe relatórios da operação · período';

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
];

export const CATEGORY_TABS: { id: 'todos' | ReportCategory; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'portfolio', label: 'Portfólio' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'operacao', label: 'Operação' },
];

export const REPORT_DEFS: ReportDef[] = [
  {
    id: 'portfolio',
    title: 'Portfólio de imóveis',
    description: 'Inventário completo com situação, valores e responsáveis.',
    category: 'portfolio',
    badge: null,
    minRole: 'corretor',
    icon: Building2,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    pages: 12,
    fileSlug: 'Portfolio-imoveis',
  },
  {
    id: 'funnel',
    title: 'Funil comercial',
    description: 'Leads por etapa, conversão e tempo médio em cada estágio.',
    category: 'comercial',
    badge: 'GESTOR',
    minRole: 'gestor',
    icon: Filter,
    iconBg: 'bg-sky-50 dark:bg-sky-950/40',
    iconColor: 'text-sky-700 dark:text-sky-400',
    pages: 9,
    fileSlug: 'Funil-comercial',
  },
  {
    id: 'brokers',
    title: 'Desempenho por corretor',
    description: 'Leads atendidos, visitas, fechamentos e VGV por profissional.',
    category: 'comercial',
    badge: null,
    minRole: 'corretor',
    icon: Users,
    iconBg: 'bg-violet-50 dark:bg-violet-950/40',
    iconColor: 'text-violet-700 dark:text-violet-400',
    pages: 6,
    fileSlug: 'Desempenho-corretores',
  },
  {
    id: 'market',
    title: 'Análise de mercado',
    description: 'Origem dos clientes, canais mais efetivos e tendências de procura.',
    category: 'marketing',
    badge: null,
    minRole: 'corretor',
    icon: TrendingUp,
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-800 dark:text-amber-400',
    pages: 8,
    fileSlug: 'Analise-mercado',
  },
  {
    id: 'digital',
    title: 'Presença digital',
    description: 'Tráfego do site, landing pages e leads gerados online.',
    category: 'marketing',
    badge: null,
    minRole: 'corretor',
    icon: Globe,
    iconBg: 'bg-rose-50 dark:bg-rose-950/40',
    iconColor: 'text-rose-700 dark:text-rose-400',
    pages: 5,
    fileSlug: 'Presenca-digital',
  },
  {
    id: 'attendance',
    title: 'Atendimento e IA',
    description: 'Conversas, participação da IA e tempo de primeira resposta.',
    category: 'operacao',
    badge: null,
    minRole: 'corretor',
    icon: MessageSquare,
    iconBg: 'bg-teal-50 dark:bg-teal-950/40',
    iconColor: 'text-teal-700 dark:text-teal-400',
    pages: 7,
    fileSlug: 'Atendimento-IA',
  },
  {
    id: 'agenda',
    title: 'Agenda e plantão',
    description: 'Visitas realizadas, cancelamentos e cobertura da escala.',
    category: 'operacao',
    badge: null,
    minRole: 'corretor',
    icon: CalendarDays,
    iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-700 dark:text-blue-400',
    pages: 4,
    fileSlug: 'Agenda-plantao',
  },
  {
    id: 'audit',
    title: 'Auditoria de acessos',
    description: 'Logins, alterações de permissão e ações sensíveis da equipe.',
    category: 'operacao',
    badge: 'ADMIN',
    minRole: 'admin',
    icon: Shield,
    iconBg: 'bg-orange-50 dark:bg-orange-950/40',
    iconColor: 'text-orange-700 dark:text-orange-400',
    pages: 10,
    fileSlug: 'Auditoria-acessos',
  },
];

export const LS_EXPORT_HISTORY = 'imobi.reports.exportHistory.v1';
export const LS_SCHEDULED = 'imobi.reports.scheduled.v1';
export const LS_EXPORT_COUNTS = 'imobi.reports.exportCounts.v1';

export const DEFAULT_SCHEDULES = [
  {
    id: 'sched-funnel',
    reportId: 'funnel' as ReportId,
    title: 'Funil comercial',
    schedule: 'toda segunda, 08h · para gestores',
    enabled: true,
    iconTone: 'sky' as const,
  },
  {
    id: 'sched-portfolio',
    reportId: 'portfolio' as ReportId,
    title: 'Portfólio de imóveis',
    schedule: 'dia 1º de cada mês · para diretoria',
    enabled: true,
    iconTone: 'emerald' as const,
  },
  {
    id: 'sched-audit',
    reportId: 'audit' as ReportId,
    title: 'Auditoria de acessos',
    schedule: 'toda sexta, 18h · para administrador',
    enabled: false,
    iconTone: 'orange' as const,
  },
];
