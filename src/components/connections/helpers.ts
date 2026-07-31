import type { PipelineKpi } from '@/components/pipeline/PipelineKpis';

export type ConnectionsKpiItem = PipelineKpi & { progress?: number; progressClass?: string };

export const INSTANCE_PLAN_LIMIT = 1;

export function getInstanceInitials(name?: string | null): string {
  const raw = String(name || '').trim();
  if (!raw) return 'WA';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

export function formatConnectionPhone(phone?: string | null): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export type InstanceChannelStats = {
  messages: number;
  contacts: number;
  chats: number;
  queued: number;
};

/** Prefer CRM WhatsApp conversation data when Evolution `_count` is missing/zero. */
export function buildInstanceChannelStats(params: {
  instanceName: string;
  evolutionMessages?: number;
  evolutionContacts?: number;
  evolutionChats?: number;
  conversas: Array<{
    instancia?: string | null;
    sessionId: string;
    hasCrmLead?: boolean;
  }>;
  companyMessagesTotal: number;
  /** When the company has a single WA instance, attribute company-wide message total to it. */
  isSoleInstance: boolean;
}): InstanceChannelStats {
  const key = String(params.instanceName || '').trim().toLowerCase();
  const related = params.conversas.filter((c) => {
    const inst = String(c.instancia || '').trim().toLowerCase();
    if (!inst) return params.isSoleInstance;
    return inst === key;
  });

  const chats = related.length;
  const contacts = new Set(related.map((c) => c.sessionId).filter(Boolean)).size;
  const queued = related.filter((c) => !c.hasCrmLead).length;

  const evoMsg = Number(params.evolutionMessages) || 0;
  const evoContacts = Number(params.evolutionContacts) || 0;
  const evoChats = Number(params.evolutionChats) || 0;

  const crmMessages =
    params.isSoleInstance && params.companyMessagesTotal > 0
      ? params.companyMessagesTotal
      : 0;

  return {
    messages: Math.max(evoMsg, crmMessages),
    contacts: Math.max(evoContacts, contacts),
    chats: Math.max(evoChats, chats),
    queued,
  };
}

export function buildActiveChannelLabels(params: {
  whatsappConnected: boolean;
  hasInstagram: boolean;
  hasSite?: boolean;
}): string {
  const labels: string[] = [];
  if (params.whatsappConnected) labels.push('WhatsApp');
  if (params.hasInstagram) labels.push('Instagram');
  if (params.hasSite) labels.push('Site');
  return labels.join(' · ') || 'Nenhum canal';
}

export function countActiveChannels(params: {
  whatsappConnected: boolean;
  hasInstagram: boolean;
  hasSite?: boolean;
}): number {
  let count = 0;
  if (params.whatsappConnected) count += 1;
  if (params.hasInstagram) count += 1;
  if (params.hasSite) count += 1;
  return count;
}

export function buildConnectionsKpis(params: {
  totalInstances: number;
  instanceLimit: number;
  connectedInstances: number;
  activeChats: number;
  messagesCount: number;
  activeChannels: number;
  channelLabels: string;
  /** Optional override for chats KPI hint (e.g. WhatsApp · Instagram breakdown). */
  chatsHint?: string;
  /** Optional override for messages KPI hint. */
  messagesHint?: string;
}): ConnectionsKpiItem[] {
  const {
    totalInstances,
    instanceLimit,
    connectedInstances,
    activeChats,
    messagesCount,
    activeChannels,
    channelLabels,
    chatsHint,
    messagesHint,
  } = params;

  const instancePct =
    instanceLimit > 0 ? Math.min(100, Math.round((totalInstances / instanceLimit) * 100)) : 0;
  const connectedPct =
    totalInstances > 0 ? Math.round((connectedInstances / totalInstances) * 100) : 0;
  const atLimit = totalInstances >= instanceLimit;

  return [
    {
      key: 'instances',
      label: 'Instâncias',
      value: `${totalInstances} / ${instanceLimit}`,
      hint: atLimit ? 'limite do plano atingido' : `${instanceLimit - totalInstances} disponível${instanceLimit - totalInstances !== 1 ? 'is' : ''}`,
      hintTone: atLimit ? 'negative' : 'neutral',
      dot: 'bg-amber-400',
      progress: instancePct,
      progressClass: 'bg-amber-400',
    },
    {
      key: 'connected',
      label: 'Conectadas',
      value: String(connectedInstances),
      hint: totalInstances > 0 ? `${connectedPct}% online` : 'nenhuma instância',
      hintTone: connectedPct === 100 && totalInstances > 0 ? 'positive' : 'neutral',
      dot: 'bg-emerald-600',
      progress: connectedPct,
      progressClass: 'bg-emerald-600',
    },
    {
      key: 'chats',
      label: 'Chats ativos',
      value: activeChats.toLocaleString('pt-BR'),
      hint:
        chatsHint ||
        (activeChats > 0 ? 'WhatsApp + Instagram' : 'sem chats ativos'),
      hintTone: 'neutral',
      dot: 'bg-blue-500',
      progress: activeChats > 0 ? Math.min(100, Math.round(activeChats / 3)) : 0,
      progressClass: 'bg-blue-500',
    },
    {
      key: 'messages',
      label: 'Mensagens (24 h)',
      value: messagesCount.toLocaleString('pt-BR'),
      hint:
        messagesHint ||
        (messagesCount > 0 ? 'últimas 24 h · todos os canais' : 'sem mensagens nas últimas 24 h'),
      hintTone: 'neutral',
      dot: 'bg-violet-500',
      progress: messagesCount > 0 ? Math.min(100, Math.round(messagesCount / 10)) : 0,
      progressClass: 'bg-violet-500',
    },
    {
      key: 'channels',
      label: 'Canais ativos',
      value: String(activeChannels),
      hint: channelLabels,
      hintTone: 'neutral',
      dot: 'bg-emerald-600',
      progress: Math.min(100, Math.round((activeChannels / 2) * 100)),
      progressClass: 'bg-emerald-600',
    },
  ];
}

export function buildConnectionsSubtitle(isManager: boolean): string {
  return isManager
    ? 'Canais de mensageria e integrações da equipe · visão gestor'
    : 'Canais de mensageria e integrações · visão corretor';
}
