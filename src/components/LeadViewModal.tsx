import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, DollarSign, Building2, Mail, Phone, User, FileText, Clock, Eye, Edit } from 'lucide-react';

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
    'contract.updated': 'Contrato atualizado'
  };
  
  return actionMap[action] || action.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Função para humanizar metadados dos logs
const humanizeMeta = (meta: any, action: string | null): string => {
  if (!meta || typeof meta !== 'object') return '';
  
  try {
    const details: string[] = [];
    
    // Humanizar baseado no tipo de ação
    switch (action) {
      case 'lead.stage_changed':
        if (meta.from_stage && meta.to_stage) {
          details.push(`De "${meta.from_stage}" para "${meta.to_stage}"`);
        }
        if (meta.reason) {
          details.push(`Motivo: ${meta.reason}`);
        }
        break;
        
      case 'lead.updated':
        if (meta.updated_fields && Array.isArray(meta.updated_fields)) {
          const fieldNames: Record<string, string> = {
            'name': 'Nome',
            'email': 'E-mail',
            'phone': 'Telefone',
            'interest': 'Interesse',
            'estimated_value': 'Valor estimado',
            'notes': 'Observações',
            'stage': 'Status'
          };
          const humanFields = meta.updated_fields.map((field: string) => 
            fieldNames[field] || field
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
          const content = meta.message_content.length > 50 
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
        // Humanizar campos comuns
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
  } catch (error) {
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
  const [loading, setLoading] = useState(false);
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [imovelInfo, setImovelInfo] = useState<{ tipo_imovel: string | null; descricao: string | null; endereco: string | null } | null>(null);

  const loadLead = async () => {
    if (!leadId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      setLead(data as unknown as LeadRow);

      const { data: logData } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('resource', 'lead')
        .eq('resource_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20);
      setLogs((logData as any[]) || []);

      // Enriquecer imóvel (se houver)
      const listing = (data as any)?.imovel_interesse as string | null;
      if (listing) {
        const { data: imv } = await supabase
          .from('imoveisvivareal')
          .select('tipo_imovel, descricao, endereco')
          .ilike('listing_id', listing)
          .limit(1)
          .maybeSingle();
        if (imv) setImovelInfo({
          tipo_imovel: (imv as any)?.tipo_imovel || null,
          descricao: (imv as any)?.descricao || null,
          endereco: (imv as any)?.endereco || null,
        });
      } else {
        setImovelInfo(null);
      }
    } catch (e) {
      // silenciar erro no modal; poderia usar toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadLead();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, leadId]);

  const headerColor = useMemo(() => {
    switch (lead?.stage) {
      case 'Novo Lead': return 'text-blue-300';
      case 'Qualificado': return 'text-emerald-300';
      case 'Visita Agendada': return 'text-purple-300';
      case 'Em Negociação': return 'text-indigo-300';
      case 'Documentação': return 'text-violet-300';
      case 'Contrato': return 'text-yellow-300';
      case 'Fechamento': return 'text-green-300';
      default: return 'text-slate-300';
    }
  }, [lead?.stage]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-gray-900/95 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-300" />
              {lead?.name || 'Lead'}
            </span>
            {lead?.stage && (
              <Badge variant="outline" className={`${headerColor} border-current`}>{lead.stage}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <Card className="bg-gray-800/70 border-gray-700">
            <CardContent className="p-4 space-y-2 text-sm text-gray-200">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span>{lead?.email || '-'}</span></div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4" /><span>{lead?.phone || '-'}</span></div>
              <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-400" /><span>{lead?.estimated_value ? `R$ ${lead.estimated_value.toLocaleString('pt-BR')}` : 'R$ 0'}</span></div>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{lead?.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : '-'}</span></div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/70 border-gray-700">
            <CardContent className="p-4 space-y-2 text-sm text-gray-200">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /><span>{lead?.imovel_interesse || '-'}</span></div>
              {imovelInfo && (
                <div className="mt-1 text-xs text-gray-300">
                  <div><span className="text-gray-400">Tipo:</span> {imovelInfo.tipo_imovel || '-'}</div>
                  <div className="line-clamp-2"><span className="text-gray-400">Descrição:</span> {imovelInfo.descricao || '-'}</div>
                  <div><span className="text-gray-400">Endereço:</span> {imovelInfo.endereco || '-'}</div>
                </div>
              )}
              {lead?.interest && (
                <div className="flex items-start gap-2"><FileText className="h-4 w-4 mt-0.5" /><span className="text-gray-300">{lead.interest}</span></div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Clock className="h-4 w-4" /> Últimas atividades</h3>
          <div className="space-y-2 max-h-56 overflow-auto pr-1">
            {logs.length === 0 && (
              <div className="text-xs text-gray-400">Sem atividades recentes.</div>
            )}
            {logs.map((log) => (
              <div key={log.id} className="text-xs text-gray-300 bg-gray-800/50 border border-gray-700 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{humanizeAction(log.action)}</span>
                  <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                </div>
                {log.meta && (
                  <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                    {typeof log.meta === 'string' ? log.meta : humanizeMeta(log.meta, log.action)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-red-500">Fechar</Button>
          {lead && (
            <Button
              onClick={() => {
                const ev = new CustomEvent('openLeadEdit', { detail: { id: lead.id } });
                window.dispatchEvent(ev);
                onClose();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Editar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};


