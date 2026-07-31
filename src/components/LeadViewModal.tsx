import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, DollarSign, Building2, Mail, Phone, User, FileText, Clock, Edit, X, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  parseConversationSummaryResponse,
  parseStoredConversationSummary,
  type ConversationSummaryData,
} from '@/lib/parseConversationSummaryResponse';
import { ConversationSummaryCard } from '@/components/ConversationSummaryCard';
import { resolveListingDisplay } from '@/lib/listingBasics';

const RESUMO_CONVERSA_WEBHOOK =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/resumo_conversa';

const SECTION_CLASS =
  'rounded-xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-sm dark:border-gray-700/60';
const SECTION_TITLE =
  'text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200 pb-2 border-b border-border/60 dark:border-gray-700';
const FIELD_ROW =
  'flex items-start gap-2.5 text-sm text-foreground dark:text-gray-200';
const FIELD_LABEL =
  'text-xs font-medium uppercase tracking-wide text-muted-foreground shrink-0 min-w-[4.5rem] dark:text-gray-400';
const FIELD_VALUE = 'min-w-0 break-words';

function normalizeStageKey(stage: string): string {
  return (stage || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function humanizeStageLabel(stage: string | null | undefined): string {
  if (!stage) return '';
  const key = normalizeStageKey(stage);
  const titles: Record<string, string> = {
    'novo lead': 'Novo Lead',
    qualificado: 'Qualificado',
    'visita agendada': 'Visita Agendada',
    'visita realizada': 'Visita Realizada',
    'visita cancelada': 'Visita Cancelada',
    'em negociação': 'Em Negociação',
    documentação: 'Documentação',
    contrato: 'Contrato',
    fechamento: 'Fechamento',
  };
  if (titles[key]) return titles[key];
  return stage
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function stageHeaderBadgeClasses(stage: string): string {
  const s = normalizeStageKey(stage);
  const map: Record<string, string> = {
    'novo lead': 'bg-blue-500/25 border-blue-400/40 text-blue-100',
    qualificado: 'bg-emerald-500/25 border-emerald-400/40 text-emerald-100',
    'visita agendada': 'bg-purple-500/25 border-purple-400/40 text-purple-100',
    'visita realizada': 'bg-teal-500/25 border-teal-400/40 text-teal-100',
    'visita cancelada': 'bg-rose-500/25 border-rose-400/40 text-rose-100',
    'em negociação': 'bg-indigo-500/25 border-indigo-400/40 text-indigo-100',
    documentação: 'bg-violet-500/25 border-violet-400/40 text-violet-100',
    contrato: 'bg-yellow-500/25 border-yellow-400/40 text-yellow-100',
    fechamento: 'bg-green-500/25 border-green-400/40 text-green-100',
  };
  return map[s] || 'bg-white/10 border-white/20 text-white/90';
}

// Função para humanizar ações dos logs
const humanizeAction = (action: string | null): string => {
  if (!action) return 'Ação não identificada';

  const actionMap: Record<string, string> = {
    'lead.created': 'Lead criado',
    'lead.updated': 'Informações atualizadas',
    'lead.deleted': 'Lead removido',
    'lead.stage_changed': 'Status alterado',
    'lead.assigned': 'Lead atribuído',
    'lead.contacted': 'Contato realizado',
    'lead.note_added': 'Observação adicionada',
    'lead.email_sent': 'E-mail enviado',
    'lead.call_made': 'Ligação realizada',
    'lead.meeting_scheduled': 'Reunião agendada',
    'lead.converted': 'Lead convertido',
    'lead.qualification_updated': 'Qualificação atualizada',
    'lead.follow_up_scheduled': 'Follow-up agendado',
    'whatsapp.message_sent': 'Mensagem WhatsApp enviada',
    'whatsapp.chat_created': 'Conversa WhatsApp iniciada',
    'property.viewed': 'Imóvel visualizado',
    'contract.created': 'Contrato criado',
    'contract.updated': 'Contrato atualizado',
  };

  return actionMap[action] || action.replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

// Função para humanizar metadados dos logs
const humanizeMeta = (meta: any, action: string | null): string => {
  if (!meta || typeof meta !== 'object') return '';

  try {
    const details: string[] = [];

    switch (action) {
      case 'lead.stage_changed':
        if (meta.from_stage && meta.to_stage) {
          details.push(
            `De "${humanizeStageLabel(meta.from_stage)}" para "${humanizeStageLabel(meta.to_stage)}"`,
          );
        }
        if (meta.reason) {
          details.push(`Motivo: ${meta.reason}`);
        }
        break;

      case 'lead.updated':
        if (meta.updated_fields && Array.isArray(meta.updated_fields)) {
          const fieldNames: Record<string, string> = {
            name: 'Nome',
            email: 'E-mail',
            phone: 'Telefone',
            interest: 'Interesse',
            estimated_value: 'Valor estimado',
            notes: 'Observações',
            stage: 'Status',
          };
          const humanFields = meta.updated_fields.map(
            (field: string) => fieldNames[field] || field,
          );
          details.push(`Campos alterados: ${humanFields.join(', ')}`);
        }
        break;

      case 'lead.assigned':
        if (meta.assigned_to) {
          details.push(`Atribuído para: ${meta.assigned_to}`);
        }
        if (meta.assigned_by) {
          details.push(`Por: ${meta.assigned_by}`);
        }
        break;

      case 'whatsapp.message_sent':
        if (meta.message_content) {
          const content =
            meta.message_content.length > 50
              ? meta.message_content.substring(0, 50) + '...'
              : meta.message_content;
          details.push(`Mensagem: "${content}"`);
        }
        break;

      case 'lead.created':
        if (meta.source) {
          details.push(`Origem: ${meta.source}`);
        }
        if (meta.estimated_value) {
          details.push(`Valor estimado: R$ ${meta.estimated_value.toLocaleString('pt-BR')}`);
        }
        break;

      default:
        if (meta.value || meta.amount) {
          const value = meta.value || meta.amount;
          details.push(`Valor: R$ ${value.toLocaleString('pt-BR')}`);
        }
        if (meta.description || meta.comment || meta.note) {
          const desc = meta.description || meta.comment || meta.note;
          details.push(`Descrição: ${desc}`);
        }
        if (meta.status) {
          details.push(`Status: ${meta.status}`);
        }
        if (meta.contact_method) {
          details.push(`Método de contato: ${meta.contact_method}`);
        }
    }

    return details.join(' • ');
  } catch {
    return 'Detalhes não disponíveis';
  }
};

interface LeadViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
}

interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  interest: string | null;
  estimated_value: number | null;
  stage: string | null;
  created_at: string | null;
  notes: string | null;
  imovel_interesse: string | null;
  source: string;
  company_id: string | null;
  conversation_summary: string | null;
  instagram_id_cliente: string | null;
  arroba_instagram_cliente: string | null;
}

function resolveLeadSessionContext(lead: LeadRow): {
  sessionId: string;
  plataforma: 'WhatsApp' | 'Instagram';
  rota: 'whatsapp' | 'instagram';
} | null {
  const isInstagram =
    Boolean(lead.instagram_id_cliente || lead.arroba_instagram_cliente) ||
    /instagram/i.test(lead.source || '');

  if (isInstagram) {
    return { sessionId: lead.id, plataforma: 'Instagram', rota: 'instagram' };
  }

  const phoneDigits = lead.phone?.replace(/[^0-9]/g, '') || '';
  if (phoneDigits) {
    return { sessionId: phoneDigits, plataforma: 'WhatsApp', rota: 'whatsapp' };
  }

  return null;
}

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string | null;
  resource: string | null;
  resource_id: string | null;
  meta: any;
  created_at: string;
}

export const LeadViewModal: React.FC<LeadViewModalProps> = ({ isOpen, onClose, leadId }) => {
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummaryData | null>(null);
  const [imovelInfo, setImovelInfo] = useState<{
    tipo_imovel: string | null;
    descricao: string | null;
    endereco: string | null;
  } | null>(null);

  const loadLead = async () => {
    if (!leadId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (error) throw error;
      const leadRow = data as unknown as LeadRow;
      setLead(leadRow);
      setConversationSummary(parseStoredConversationSummary(leadRow.conversation_summary));

      const { data: logData } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('resource', 'lead')
        .eq('resource_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20);
      setLogs((logData as any[]) || []);

      const listing = (data as any)?.imovel_interesse as string | null;
      if (listing) {
        const { data: imv } = await supabase
          .from('imoveisvivareal')
          .select('tipo_imovel, descricao, endereco')
          .ilike('listing_id', listing)
          .limit(1)
          .maybeSingle();
        if (imv)
          setImovelInfo({
            tipo_imovel: (imv as any)?.tipo_imovel || null,
            descricao: (imv as any)?.descricao || null,
            endereco: (imv as any)?.endereco || null,
          });
      } else {
        setImovelInfo(null);
      }
    } catch {
      // silenciar erro no modal; poderia usar toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadLead();
    else {
      setConversationSummary(null);
      setSummaryLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, leadId]);

  const handleGenerateSummary = async () => {
    if (!lead) return;

    if (!profile?.company_id) {
      toast({
        title: 'Empresa não identificada',
        description: 'Não foi possível identificar a empresa. Faça login novamente.',
        variant: 'destructive',
      });
      return;
    }

    const sessionContext = resolveLeadSessionContext(lead);
    if (!sessionContext) {
      toast({
        title: 'Contato insuficiente',
        description: 'Este lead não possui telefone ou identificador de conversa para gerar o resumo.',
        variant: 'destructive',
      });
      return;
    }

    setSummaryLoading(true);
    try {
      const response = await fetch(RESUMO_CONVERSA_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          session_id: sessionContext.sessionId,
          phone: lead.phone || '',
          email: lead.email || '',
          name: lead.name || '',
          company_id: profile.company_id,
          user_email: profile.email || '',
          role: profile.role || '',
          instancia: profile.chat_instance || '',
          plataforma: sessionContext.plataforma,
          rota: sessionContext.rota,
        }),
      });

      const raw = await response.text();
      const { data: summaryData, text: summaryText, persistValue } =
        parseConversationSummaryResponse(raw);

      if (!response.ok) {
        throw new Error(summaryText || 'Falha ao gerar resumo da conversa');
      }

      if (!summaryText.trim()) {
        throw new Error('O serviço retornou um resumo vazio. Tente novamente.');
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update({ conversation_summary: persistValue })
        .eq('id', lead.id);

      if (updateError) {
        console.error('[LeadViewModal] Falha ao salvar resumo:', updateError);
        toast({
          title: 'Resumo gerado, mas não salvo',
          description: 'O resumo foi exibido, porém não foi possível gravá-lo no lead.',
          variant: 'destructive',
        });
      }

      setConversationSummary(summaryData ?? { resumo_conversa: summaryText });
      setLead((prev) =>
        prev ? { ...prev, conversation_summary: persistValue } : prev,
      );
      toast({ title: 'Resumo gerado com sucesso' });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível gerar o resumo da conversa.';
      toast({
        title: 'Erro ao gerar resumo',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const stageLabel = useMemo(
    () => (lead?.stage ? humanizeStageLabel(lead.stage) : null),
    [lead?.stage],
  );

  const listingDisplay = useMemo(
    () => resolveListingDisplay(lead?.imovel_interesse),
    [lead?.imovel_interesse],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[min(100%,48rem)] max-h-[min(90vh,100dvh)] flex flex-col gap-0 overflow-hidden p-0 bg-background border-border text-foreground sm:rounded-2xl shadow-2xl">
        {/* Header — forest green */}
        <div
          className="flex-shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5"
          style={{ backgroundColor: '#1a2e24' }}
        >
          <DialogHeader className="space-y-1.5 text-left min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-emerald-100" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <DialogTitle
                    className="text-lg sm:text-xl font-semibold leading-snug"
                    style={{ color: '#ffffff' }}
                  >
                    {lead?.name || 'Lead'}
                  </DialogTitle>
                  {stageLabel && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide border',
                        stageHeaderBadgeClasses(lead!.stage!),
                      )}
                    >
                      {stageLabel}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-sm mt-0.5" style={{ color: '#a3a3a3' }}>
                  {loading
                    ? 'Carregando informações…'
                    : lead?.source
                      ? `Origem: ${lead.source}`
                      : 'Visualização do lead'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Fechar"
            style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.25)' }}
          >
            <X className="h-4 w-4" style={{ color: '#ffffff' }} />
          </Button>
        </div>

        {/* Body — cream */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 bg-[#F7F5F0] dark:bg-background">
          {loading && !lead ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Carregando lead…
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* Contato & valor */}
                <section className={SECTION_CLASS}>
                  <h3 className={SECTION_TITLE}>Contato</h3>
                  <div className="space-y-3">
                    <div className={FIELD_ROW}>
                      <Mail className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className={FIELD_LABEL}>E-mail</p>
                        <p className={FIELD_VALUE}>{lead?.email || '—'}</p>
                      </div>
                    </div>
                    <div className={FIELD_ROW}>
                      <Phone className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className={FIELD_LABEL}>Telefone</p>
                        <p className={FIELD_VALUE}>{lead?.phone || '—'}</p>
                      </div>
                    </div>
                    <div className={FIELD_ROW}>
                      <DollarSign className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className={FIELD_LABEL}>Valor est.</p>
                        <p className={cn(FIELD_VALUE, 'font-medium text-emerald-800 dark:text-emerald-300')}>
                          {lead?.estimated_value
                            ? `R$ ${lead.estimated_value.toLocaleString('pt-BR')}`
                            : 'R$ 0'}
                        </p>
                      </div>
                    </div>
                    <div className={FIELD_ROW}>
                      <Calendar className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className={FIELD_LABEL}>Cadastro</p>
                        <p className={FIELD_VALUE}>
                          {lead?.created_at
                            ? new Date(lead.created_at).toLocaleDateString('pt-BR')
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1">
                      <Button
                        type="button"
                        size="sm"
                        disabled={summaryLoading || loading || !lead}
                        onClick={handleGenerateSummary}
                        className="btn-on-emerald w-full sm:w-auto rounded-lg bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
                      >
                        {summaryLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            Gerando resumo…
                          </>
                        ) : (
                          'Gerar resumo'
                        )}
                      </Button>
                    </div>

                    {conversationSummary && (
                      <ConversationSummaryCard summary={conversationSummary} />
                    )}
                  </div>
                </section>

                {/* Imóvel & interesse */}
                <section className={SECTION_CLASS}>
                  <h3 className={SECTION_TITLE}>Imóvel & Interesse</h3>
                  <div className="space-y-3">
                    <div className={FIELD_ROW}>
                      <Building2 className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className={FIELD_LABEL}>Listing</p>
                        {listingDisplay.kind === 'facts' ? (
                          <dl className="space-y-1.5">
                            {listingDisplay.facts.map(({ label, value }, i) => (
                              <div
                                key={`${label}-${i}`}
                                className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-2 gap-y-0.5 text-sm"
                              >
                                <dt className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                                  {label}
                                </dt>
                                <dd className="min-w-0 break-words text-foreground dark:text-gray-200">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p
                            className={cn(
                              FIELD_VALUE,
                              listingDisplay.kind === 'text' &&
                                listingDisplay.text.includes('\n') &&
                                'text-xs whitespace-pre-wrap leading-relaxed',
                            )}
                          >
                            {listingDisplay.kind === 'empty' ? '—' : listingDisplay.text}
                          </p>
                        )}
                      </div>
                    </div>

                    {imovelInfo && (
                      <div className="rounded-lg border border-border/60 bg-[#F7F5F0]/80 dark:bg-gray-900/40 p-3 space-y-2 text-sm">
                        {imovelInfo.tipo_imovel && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                              Tipo
                            </p>
                            <p className="text-foreground dark:text-gray-200">{imovelInfo.tipo_imovel}</p>
                          </div>
                        )}
                        {imovelInfo.endereco && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Endereço
                            </p>
                            <p className="text-foreground dark:text-gray-200">{imovelInfo.endereco}</p>
                          </div>
                        )}
                        {imovelInfo.descricao && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                              Descrição
                            </p>
                            <p className="text-foreground/90 dark:text-gray-300 text-xs leading-relaxed line-clamp-4">
                              {imovelInfo.descricao}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {lead?.interest && (
                      <div className={FIELD_ROW}>
                        <FileText className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className={FIELD_LABEL}>Interesse</p>
                          <p className="text-xs leading-relaxed text-foreground/90 dark:text-gray-300 max-h-32 overflow-y-auto overscroll-contain break-words [scrollbar-gutter:stable]">
                            {lead.interest}
                          </p>
                        </div>
                      </div>
                    )}

                    {lead?.notes && (
                      <div className={FIELD_ROW}>
                        <FileText className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className={FIELD_LABEL}>Observações</p>
                          <p className="text-xs leading-relaxed text-foreground/90 dark:text-gray-300 max-h-24 overflow-y-auto overscroll-contain break-words">
                            {lead.notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Atividades */}
              <section className={SECTION_CLASS}>
                <h3 className={cn(SECTION_TITLE, 'flex items-center gap-2')}>
                  <Clock className="h-3.5 w-3.5" />
                  Últimas atividades
                </h3>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {logs.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Sem atividades recentes.</p>
                  )}
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-border/60 bg-background/60 dark:bg-gray-900/40 p-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-foreground dark:text-gray-200">
                          {humanizeAction(log.action)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {log.meta && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {typeof log.meta === 'string'
                            ? log.meta
                            : humanizeMeta(log.meta, log.action)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border bg-background px-5 sm:px-6 py-4">
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="sm:min-w-[140px] border-border text-foreground hover:bg-muted"
            >
              Fechar
            </Button>
            {lead && (
              <Button
                type="button"
                onClick={() => {
                  const ev = new CustomEvent('openLeadEdit', { detail: { id: lead.id } });
                  window.dispatchEvent(ev);
                  onClose();
                }}
                className="btn-on-emerald sm:min-w-[140px] bg-emerald-800 hover:bg-emerald-700"
                style={{ color: '#ffffff' }}
              >
                <Edit className="h-4 w-4 mr-1.5" style={{ color: '#ffffff' }} />
                Editar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
