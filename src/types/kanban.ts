// Tipos para o sistema Kanban de Leads
import { Tables } from '@/integrations/supabase/types';

export type LeadStage = 
  | 'Novo Lead'
  | 'Qualificado'
  | 'Visita Agendada'
  | 'Em Negociação'
  | 'Documentação'
  | 'Contrato'
  | 'Fechamento';

export interface DatabaseLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  endereco: string | null;
  estado_civil: string | null;
  source: string;
  stage: LeadStage;
  interest: string | null;
  estimated_value: number | null;
  notes: string | null;
  property_id: string | null;
  imovel_interesse: string | null; // ID numérico do imóvel
  assigned_user_id?: string | null;
  id_corretor_responsavel?: string | null;
  created_at: string | null;
  updated_at: string | null;
  message?: string | null; // Campo legado
}

export interface KanbanLead {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  endereco: string;
  estado_civil: string;
  origem: string;
  interesse: string;
  valor: number;
  valorEstimado: number; // Alias para compatibilidade
  stage: string;
  dataContato: string;
  observacoes: string;
  property_id?: string;
  imovel_interesse?: string; // ID numérico do imóvel
  imovel_tipo?: string; // tipo_imovel resolvido a partir de imoveisvivareal
  message?: string;
  id_corretor_responsavel?: string;
  // Informações do corretor responsável
  corretor?: {
    id?: string;
    nome: string;
    role: string;
  };
}

export interface KanbanStage {
  id: string;
  title: LeadStage;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  icon: any;
}

export interface KanbanStats {
  stage: LeadStage;
  lead_count: number;
  avg_value: number;
  total_value: number;
  percentage: number;
}

// Função para converter DatabaseLead para KanbanLead
export function databaseLeadToKanbanLead(dbLead: any): KanbanLead {
  return {
    id: dbLead.id,
    nome: dbLead.name || '',
    email: dbLead.email || '',
    telefone: dbLead.phone || '',
    cpf: dbLead.cpf || '',
    endereco: dbLead.endereco || '',
    estado_civil: dbLead.estado_civil || '',
    origem: dbLead.source || 'Não informado',
    interesse: dbLead.interest || 'Não especificado',
    valor: dbLead.estimated_value || 0,
    valorEstimado: dbLead.estimated_value || 0,
    stage: dbLead.stage || 'Novo Lead',
    dataContato: dbLead.created_at ? new Date(dbLead.created_at).toISOString().split('T')[0] : '',
    observacoes: dbLead.notes || '',
    property_id: dbLead.property_id || undefined,
    imovel_interesse: dbLead.imovel_interesse || undefined,
    message: dbLead.message || undefined,
    id_corretor_responsavel: dbLead.id_corretor_responsavel || dbLead.assigned_user_id || undefined,
    // Incluir informações do corretor se disponível
    corretor: dbLead.corretor ? {
      id: dbLead.corretor.id,
      nome: dbLead.corretor.full_name || 'Nome não informado',
      role: dbLead.corretor.role || 'corretor'
    } : undefined
  };
}

// Função para converter KanbanLead para DatabaseLead (para updates)
export function kanbanLeadToDatabaseLead(kanbanLead: KanbanLead): Partial<DatabaseLead> {
  return {
    id: kanbanLead.id,
    name: kanbanLead.nome,
    email: kanbanLead.email || null,
    phone: kanbanLead.telefone || null,
    cpf: kanbanLead.cpf || null,
    endereco: kanbanLead.endereco || null,
    estado_civil: kanbanLead.estado_civil || null,
    source: kanbanLead.origem,
    stage: kanbanLead.stage as LeadStage,
    interest: kanbanLead.interesse || null,
    estimated_value: kanbanLead.valorEstimado || kanbanLead.valor || null,
    notes: kanbanLead.observacoes || null,
    property_id: kanbanLead.property_id || null,
    imovel_interesse: kanbanLead.imovel_interesse || null,
    message: kanbanLead.message || null,
    updated_at: new Date().toISOString()
  };
} 