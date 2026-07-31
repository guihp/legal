import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CalendarDays, DollarSign, Snowflake } from 'lucide-react';

export type SimulatorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  messageType?: 'text' | 'image';
  mediaUrl?: string;
  sentAt?: string;
  pending?: boolean;
};

export type AiTestScenario = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
  iconClass: string;
  iconBg: string;
};

export type DiagnosticItem = {
  id: string;
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'idle';
};

export const AI_TEST_SCENARIOS: AiTestScenario[] = [
  {
    id: 'lead-frio',
    title: 'Lead frio',
    description: 'primeiro contato, sem contexto',
    prompt: 'Oi! Vi o anúncio das casas no Altos do Ipê, ainda tem disponível?',
    icon: Snowflake,
    iconClass: 'text-sky-600',
    iconBg: 'bg-sky-100',
  },
  {
    id: 'preco',
    title: 'Pergunta de preço',
    description: 'testa tabela de valores',
    prompt: 'Qual o valor da que tem piscina?',
    icon: DollarSign,
    iconClass: 'text-emerald-700',
    iconBg: 'bg-emerald-100',
  },
  {
    id: 'agendamento',
    title: 'Agendamento',
    description: 'testa integração com a agenda',
    prompt: 'Posso agendar uma visita para sábado de manhã?',
    icon: CalendarDays,
    iconClass: 'text-violet-600',
    iconBg: 'bg-violet-100',
  },
  {
    id: 'fora-escopo',
    title: 'Fora do escopo',
    description: 'verifica limites do prompt',
    prompt: 'Vocês fazem reforma de telhado e pintam a fachada também?',
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
];

export const AI_TEST_SUGGESTIONS = [
  'Quero saber o valor',
  'Tem financiamento?',
  'Posso visitar sábado?',
  'Vocês têm terreno?',
] as const;

/** Forest green used on AI bubbles / usage card (match cream mockups). */
export const AI_TEST_EMERALD = '#0C2919';

export function assistantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'IA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function formatMessageTime(sentAt?: string): string {
  const d = sentAt ? new Date(sentAt) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatSessionDateLabel(date = new Date()): string {
  const raw = date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `SESSÃO DE TESTE · ${raw.toUpperCase()}`;
}

export function truncateSessionId(sessionId: string, head = 8, tail = 6): string {
  if (!sessionId || sessionId.length <= head + tail + 3) return sessionId || '—';
  return `${sessionId.slice(0, head)}…${sessionId.slice(-tail)}`;
}

/** Average assistant reply latency from consecutive user → assistant pairs. */
export function averageReplySeconds(messages: SimulatorMessage[]): number | null {
  const pairs: number[] = [];
  for (let i = 0; i < messages.length - 1; i += 1) {
    const a = messages[i];
    const b = messages[i + 1];
    if (a.role !== 'user' || b.role !== 'assistant') continue;
    if (!a.sentAt || !b.sentAt) continue;
    const start = new Date(a.sentAt).getTime();
    const end = new Date(b.sentAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) continue;
    pairs.push((end - start) / 1000);
  }
  if (pairs.length === 0) return null;
  return pairs.reduce((sum, n) => sum + n, 0) / pairs.length;
}

export function formatSecondsPt(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const rounded = Math.round(seconds * 10) / 10;
  return `${String(rounded).replace('.', ',')} s`;
}

export function replyLatencyForAssistant(
  messages: SimulatorMessage[],
  assistantIndex: number,
): number | null {
  if (assistantIndex <= 0) return null;
  const assistant = messages[assistantIndex];
  const prev = messages[assistantIndex - 1];
  if (!assistant || assistant.role !== 'assistant' || prev?.role !== 'user') return null;
  if (!assistant.sentAt || !prev.sentAt) return null;
  const start = new Date(prev.sentAt).getTime();
  const end = new Date(assistant.sentAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 1000;
}

export function buildSessionDiagnostics(params: {
  hasPrompt: boolean;
  propertyCount: number | null;
  hasAgendaHint: boolean;
  handoffTested: boolean;
}): DiagnosticItem[] {
  const { hasPrompt, propertyCount, hasAgendaHint, handoffTested } = params;
  return [
    {
      id: 'prompt',
      label: 'Prompt carregado',
      value: hasPrompt ? 'ok' : 'vazio',
      status: hasPrompt ? 'ok' : 'warn',
    },
    {
      id: 'properties',
      label: 'Base de imóveis',
      value: propertyCount == null ? '—' : `${propertyCount} itens`,
      status: propertyCount == null ? 'idle' : propertyCount > 0 ? 'ok' : 'warn',
    },
    {
      id: 'agenda',
      label: 'Integração da agenda',
      value: hasAgendaHint ? 'ok' : 'não testado',
      status: hasAgendaHint ? 'ok' : 'idle',
    },
    {
      id: 'handoff',
      label: 'Handoff para corretor',
      value: handoffTested ? 'ok' : 'não testado',
      status: handoffTested ? 'ok' : 'warn',
    },
  ];
}

export function sessionHealthLabel(items: DiagnosticItem[]): 'saudável' | 'atenção' {
  const hasWarn = items.some((i) => i.status === 'warn' && i.id !== 'handoff');
  return hasWarn ? 'atenção' : 'saudável';
}

export function messagesMentionAgenda(messages: SimulatorMessage[]): boolean {
  return messages.some((m) =>
    /visita|agend|horário|horario|sábado|sabado|calendário|calendario/i.test(m.content || ''),
  );
}

export function messagesMentionHandoff(messages: SimulatorMessage[]): boolean {
  return messages.some((m) =>
    /corretor|humano|atendente|transfer|handoff|especialista/i.test(m.content || ''),
  );
}
