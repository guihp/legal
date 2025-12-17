import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { 
  KanbanLead, 
  LeadStage,
  databaseLeadToKanbanLead,
  kanbanLeadToDatabaseLead 
} from '@/types/kanban';
import { logAudit } from '@/lib/audit/logger';

type DatabaseLead = Tables<'leads'>;

export function useKanbanLeads() {
  const [leads, setLeads] = useState<KanbanLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('corretor');
  const subscriptionRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const userRoleRef = useRef<string>('corretor');
  const updateBufferRef = useRef<Map<string, number>>(new Map());
  const leadsRef = useRef<KanbanLead[]>([]);
  const corretorCacheRef = useRef<Map<string, { id: string; full_name: string; role: string }>>(new Map());
  const pendingFetchesRef = useRef<Set<string>>(new Set());
  const broadcastRef = useRef<any>(null);
  const companyIdRef = useRef<string | null>(null);

  // Telemetria apenas em DEV (pode ser controlada por flag VITE_FEATURE_RT_DEBUG_LEADS)
  const rtDebugEnabled = (import.meta as any)?.env?.DEV && (import.meta as any)?.env?.VITE_FEATURE_RT_DEBUG_LEADS !== 'false';
  const rtLog = (...args: any[]) => { if (rtDebugEnabled) console.info('RT(leads):', ...args); };
  const rtWarn = (...args: any[]) => { if (rtDebugEnabled) console.warn('RT(leads):', ...args); };
  const transferFixEnabled = (import.meta as any)?.env?.DEV && ((import.meta as any)?.env?.VITE_FEATURE_RT_TRANSFER_FIX !== 'false');
  const broadcastEnabled = (import.meta as any)?.env?.DEV !== false; // habilitado em DEV por padrão

  // Verificar role do usuário
  const checkUserRole = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'corretor';

      // Buscar role real do user_profiles
      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar role do usuário:', error);
        return 'corretor';
      }

      const role = profileData?.role || 'corretor';
      setUserRole(role);
      userRoleRef.current = role;
      return role;
    } catch (error) {
      console.error('Erro ao verificar role do usuário:', error);
      return 'corretor';
    }
  }, []);

  // Buscar todos os leads do banco de dados
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Verificar se o usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Guardar userId em ref para uso em handlers de realtime
      userIdRef.current = user.id;

      // Verificar role do usuário e company id
      const currentRole = await checkUserRole();
      let companyId: string | null = null;
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        companyId = (profile as any)?.company_id || null;
      } catch (_) {}
      companyIdRef.current = companyId;

      //

      // Para gestores e admins, buscar todos os leads
      // Para corretores, as políticas RLS já filtram automaticamente
      let query = supabase
        .from('leads')
        .select(`
          *,
          corretor:user_profiles!leads_id_corretor_responsavel_fkey(
            id, full_name, role
          )
        `) 
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

              //

      // Popular cache de corretores a partir dos dados com join
      try {
        (data || []).forEach((dbLead: any) => {
          const ownerId: string | null | undefined = dbLead?.id_corretor_responsavel;
          const corr = dbLead?.corretor;
          if (ownerId && corr?.full_name) {
            corretorCacheRef.current.set(ownerId, {
              id: corr.id,
              full_name: corr.full_name,
              role: corr.role || 'corretor'
            });
          }
        });
      } catch (_) {}

      // Converter dados do banco para formato do kanban com tratamento seguro
      const kanbanLeads = (data || []).map(dbLead => {
        try {
          const k = databaseLeadToKanbanLead({
            ...dbLead,
            stage: (dbLead.stage || 'Novo Lead') as LeadStage,
            interest: dbLead.interest || null,
            estimated_value: dbLead.estimated_value || null,
            notes: dbLead.notes || null,
            updated_at: dbLead.updated_at || null
          });
          return k;
        } catch (conversionError) {
          console.error('Erro ao converter lead:', dbLead, conversionError);
          // Retorna um lead padrão em caso de erro
          return databaseLeadToKanbanLead({
            id: dbLead.id || 'unknown',
            name: dbLead.name || 'Nome não informado',
            email: null,
            phone: null,
            source: 'Não informado',
            stage: 'Novo Lead',
            interest: null,
            estimated_value: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: null
          });
        }
      });
      
      // Enriquecer tipo do imóvel (tipo_imovel) a partir do catálogo, quando houver listing_id
      const listingIds = Array.from(new Set((kanbanLeads
        .map(l => l.imovel_interesse)
        .filter(Boolean) as string[])));
      let tipoMap: Record<string, string> = {};
      if (listingIds.length > 0) {
        const { data: imv } = await supabase
          .from('imoveisvivareal')
          .select('listing_id, tipo_imovel')
          .in('listing_id', listingIds);
        (imv || []).forEach((row: any) => {
          if (row.listing_id) tipoMap[String(row.listing_id)] = row.tipo_imovel || '';
        });
      }
      const enriched = kanbanLeads.map(l => ({
        ...l,
        imovel_tipo: l.imovel_interesse ? (tipoMap[l.imovel_interesse] || undefined) : undefined
      }));

      // Salvaguarda de UI: se corretor, mostrar apenas leads atribuídos a si
      const visibleLeads = (currentRole === 'corretor' && user?.id)
        ? enriched.filter(l => l.id_corretor_responsavel === user.id)
        : enriched;

      setLeads(visibleLeads);
      leadsRef.current = visibleLeads;

      // Inicializar canal de broadcast por empresa (se habilitado), apenas uma vez
      if (broadcastEnabled && companyId && !broadcastRef.current) {
        const room = `company_${companyId}_leads`;
        const ch = supabase.channel(room, { config: { broadcast: { self: true } } as any });
        ch.on('broadcast', { event: 'lead_transfer' } as any, async ({ payload }: any) => {
          const { lead_id, new_owner_id, company_id } = payload || {};
          if (!lead_id || !company_id) return;
          rtLog('broadcast recv lead_transfer', { lead_id, new_owner_id });
          if (company_id !== companyId) return;

          // Se sou corretor
          if (userRoleRef.current === 'corretor') {
            // Novo dono: buscar por id e upsert
            if (new_owner_id && userIdRef.current === new_owner_id) {
              try {
                const { data, error } = await supabase
                  .from('leads')
                  .select('*, corretor:user_profiles!leads_id_corretor_responsavel_fkey(id, full_name, role)')
                  .eq('id', lead_id)
                  .single();
                if (!error && data) {
                  const k = databaseLeadToKanbanLead({
                    ...data,
                    stage: (data.stage || 'Novo Lead') as LeadStage,
                    interest: data.interest || null,
                    estimated_value: data.estimated_value || null,
                    notes: data.notes || null,
                    updated_at: data.updated_at || null
                  });
                  setLeads(prev => {
                    const exists = prev.some(l => l.id === k.id);
                    let next = exists ? prev.map(l => (l.id === k.id ? k : l)) : [k, ...prev];
                    if (userRoleRef.current === 'corretor' && userIdRef.current) {
                      next = next.filter(l => l.id_corretor_responsavel === userIdRef.current);
                    }
                    leadsRef.current = next;
                    return next;
                  });
                }
              } catch (_) {}
            } else {
              // Não sou o novo dono: evict se existir
              setLeads(prev => {
                const next = prev.filter(l => l.id !== lead_id);
                leadsRef.current = next;
                return next;
              });
            }
          } else {
            // Gestor/Admin: opcionalmente atualizar por id para garantir label atualizado
            try {
              const { data, error } = await supabase
                .from('leads')
                .select('*, corretor:user_profiles!leads_id_corretor_responsavel_fkey(id, full_name, role)')
                .eq('id', lead_id)
                .single();
              if (!error && data) {
                const k = databaseLeadToKanbanLead({
                  ...data,
                  stage: (data.stage || 'Novo Lead') as LeadStage,
                  interest: data.interest || null,
                  estimated_value: data.estimated_value || null,
                  notes: data.notes || null,
                  updated_at: data.updated_at || null
                });
                setLeads(prev => {
                  const exists = prev.some(l => l.id === k.id);
                  const next = exists ? prev.map(l => (l.id === k.id ? k : l)) : [k, ...prev];
                  leadsRef.current = next;
                  return next;
                });
              }
            } catch (_) {}
          }
        });
        ch.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') rtLog('broadcast [SUBSCRIBED]', room);
        });
        broadcastRef.current = ch;
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar leads';
      setError(errorMessage);
      console.error('Erro ao buscar leads:', err);
      // Em caso de erro, definir array vazio ao invés de deixar undefined
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [checkUserRole]);

  // Atualizar estágio de um lead
  const updateLeadStage = useCallback(async (leadId: string, newStage: LeadStage) => {
    try {
      // Atualizar no banco de dados
      const { error } = await supabase
        .from('leads')
        .update({ 
          stage: newStage,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) {
        throw error;
      }

      // Atualizar estado local imediatamente
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId 
            ? { ...lead, stage: newStage }
            : lead
        )
      );
      logAudit({ action: 'lead.stage_changed', resource: 'lead', resourceId: leadId, meta: { newStage } });

      return true;
    } catch (err) {
      console.error('Erro ao atualizar estágio do lead:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar lead');
      return false;
    }
  }, []);

  // Criar novo lead (permite atribuição opcional a um corretor específico)
  const createLead = useCallback(async (
    leadData: Omit<KanbanLead, 'id' | 'dataContato'>,
    options?: { assignedUserId?: string }
  ) => {
    try {
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Preparar dados incluindo os novos campos
      const insertData: any = {
        name: leadData.nome,
        email: leadData.email || null,
        phone: leadData.telefone || null,
        cpf: leadData.cpf || null,
        endereco: leadData.endereco || null,
        estado_civil: leadData.estado_civil || null,
        source: leadData.origem,
        stage: leadData.stage as LeadStage,
        interest: leadData.interesse || null,
        estimated_value: leadData.valorEstimado || leadData.valor || null,
        notes: leadData.observacoes || null,
        imovel_interesse: leadData.imovel_interesse || null,
        // Campos de autoria e responsabilidade
        user_id: user.id,
        id_corretor_responsavel: options?.assignedUserId ?? user.id
      };

      // Adicionar property_id se existir na estrutura da tabela
      if (leadData.property_id) {
        insertData.property_id = leadData.property_id;
      }

      // Adicionar message se existir na estrutura da tabela
      if (leadData.message) {
        insertData.message = leadData.message;
      }

      const { data, error } = await supabase
        .from('leads')
        .insert([insertData])
        .select(`
          *,
          corretor:user_profiles!leads_id_corretor_responsavel_fkey(
            id, full_name, role
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      // Adicionar ao estado local
      const newKanbanLead = databaseLeadToKanbanLead({
        ...data,
        stage: (data.stage || 'Novo Lead') as LeadStage,
        interest: data.interest || null,
        estimated_value: data.estimated_value || null,
        notes: data.notes || null,
        updated_at: data.updated_at || null
      });
      setLeads(prevLeads => [newKanbanLead, ...prevLeads]);
      logAudit({ action: 'lead.created', resource: 'lead', resourceId: newKanbanLead.id, meta: { nome: newKanbanLead.nome, origem: newKanbanLead.origem } });

      return newKanbanLead;
    } catch (err) {
      console.error('Erro ao criar lead:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar lead');
      return null;
    }
  }, []);

  // Atualizar lead completo
  const updateLead = useCallback(async (leadId: string, updates: Partial<KanbanLead>) => {
    try {
      // Preparar dados básicos que existem na tabela atual
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.nome) updateData.name = updates.nome;
      if (updates.email !== undefined) updateData.email = updates.email || null;
      if (updates.telefone !== undefined) updateData.phone = updates.telefone || null;
      if (updates.cpf !== undefined) updateData.cpf = updates.cpf || null;
      if (updates.endereco !== undefined) updateData.endereco = updates.endereco || null;
      if (updates.estado_civil !== undefined) updateData.estado_civil = updates.estado_civil || null;
      if (updates.origem) updateData.source = updates.origem;
      if (updates.stage) updateData.stage = updates.stage as LeadStage;
      if (updates.interesse !== undefined) updateData.interest = updates.interesse || null;
      if (updates.valorEstimado !== undefined || updates.valor !== undefined) {
        updateData.estimated_value = updates.valorEstimado || updates.valor || null;
      }
      if (updates.observacoes !== undefined) updateData.notes = updates.observacoes || null;
      if (updates.property_id !== undefined) updateData.property_id = updates.property_id || null;
      if (updates.imovel_interesse !== undefined) updateData.imovel_interesse = updates.imovel_interesse || null;
      if (updates.message !== undefined) updateData.message = updates.message || null;
      // Atribuição de corretor responsável (padronizado)
      if ((updates as any).id_corretor_responsavel !== undefined) {
        updateData.id_corretor_responsavel = (updates as any).id_corretor_responsavel || null;
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) {
        throw error;
      }

      // Atualizar estado local
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId 
            ? { ...lead, ...updates }
            : lead
        )
      );
      logAudit({ action: 'lead.updated', resource: 'lead', resourceId: leadId, meta: updates });

      // Se houve transferência de responsável, emitir broadcast
      if (broadcastEnabled && (updates as any).id_corretor_responsavel) {
        const newOwnerId = (updates as any).id_corretor_responsavel as string | null;
        const companyId = companyIdRef.current;
        if (companyId && broadcastRef.current) {
          rtLog('broadcast send lead_transfer', { leadId, newOwnerId });
          try {
            await broadcastRef.current.send({
              type: 'broadcast',
              event: 'lead_transfer',
              payload: { lead_id: leadId, new_owner_id: newOwnerId, company_id: companyId }
            });
          } catch (_) {}
        }
      }

      return true;
    } catch (err) {
      console.error('Erro ao atualizar lead:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar lead');
      return false;
    }
  }, []);

  // Deletar lead
  const deleteLead = useCallback(async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) {
        throw error;
      }

      // Remover do estado local
      setLeads(prevLeads => {
        const next = prevLeads.filter(lead => lead.id !== leadId);
        leadsRef.current = next;
        return next;
      });
      logAudit({ action: 'lead.deleted', resource: 'lead', resourceId: leadId, meta: null });

      return true;
    } catch (err) {
      console.error('Erro ao deletar lead:', err);
      setError(err instanceof Error ? err.message : 'Erro ao deletar lead');
      return false;
    }
  }, []);

  // Vinculação em massa de leads a um corretor
  const bulkAssignLeads = useCallback(async (leadIds: string[], corretorId: string | null) => {
    try {
      // Atualizar no banco de dados
      const { error } = await supabase
        .from('leads')
        .update({ 
          id_corretor_responsavel: corretorId,
          updated_at: new Date().toISOString()
        })
        .in('id', leadIds);

      if (error) {
        throw error;
      }

      // Atualizar estado local
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          leadIds.includes(lead.id) 
            ? { ...lead, id_corretor_responsavel: corretorId || undefined }
            : lead
        )
      );

      // Fazer log da operação (usar ação existente para compatibilidade de tipos)
      logAudit({ 
        action: 'lead.updated', 
        resource: 'leads', 
        resourceId: leadIds.join(','), 
        meta: { 
          operation: 'bulk_assign',
          corretorId, 
          leadCount: leadIds.length,
          action: corretorId ? 'assign' : 'unassign'
        }
      });

      // Emitir broadcast por cada lead transferido
      const companyId = companyIdRef.current;
      if (broadcastEnabled && companyId && broadcastRef.current) {
        for (const id of leadIds) {
          rtLog('broadcast send lead_transfer', { lead_id: id, new_owner_id: corretorId });
          try {
            await broadcastRef.current.send({
              type: 'broadcast',
              event: 'lead_transfer',
              payload: { lead_id: id, new_owner_id: corretorId, company_id: companyId }
            });
          } catch (_) {}
        }
      }

      return true;
    } catch (err) {
      console.error('Erro ao atribuir leads em massa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atribuir leads');
      return false;
    }
  }, []);

  // Buscar leads por estágio
  const getLeadsByStage = useCallback((stage: string) => {
    return leads.filter(lead => lead.stage === stage);
  }, [leads]);

  // Carregar dados na inicialização
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Configurar escuta em tempo real (separado para evitar re-subscriptions)
  useEffect(() => {
    // Helper para limpar canal atual (antes de inscrever/recriar e no unmount)
    const cleanupChannel = () => {
      try {
        const ch = subscriptionRef.current;
        subscriptionRef.current = null;
        isSubscribedRef.current = false;
        if (ch && typeof ch.unsubscribe === 'function') {
          Promise.resolve(ch.unsubscribe()).catch(() => {
            // fallback silencioso
          }).finally(() => {
            try { supabase.removeChannel(ch); } catch (_) {}
          });
        } else if (ch) {
          try { supabase.removeChannel(ch); } catch (_) {}
        }
      } catch (e) {
        rtWarn('cleanup error', e);
      }
    };

    // Helpers para aplicar mudanças no estado com fail-safe de corretor
    const applyInsert = (newLead: KanbanLead) => {
      // Enriquecer com cache de corretor, se possível
      if (newLead.id_corretor_responsavel) {
        const c = corretorCacheRef.current.get(newLead.id_corretor_responsavel);
        if (c) {
          newLead = { ...newLead, corretor: { id: c.id, nome: c.full_name, role: c.role } as any };
          rtLog('hydrate-corretor hit', c.id);
        } else {
          // Buscar pontualmente em background
          ensureCorretorHydrated(newLead.id_corretor_responsavel, newLead.id);
        }
      }
      setLeads(prev => {
        const exists = prev.some(l => l.id === newLead.id);
        const next = exists ? prev : [newLead, ...prev];
        if (userRoleRef.current === 'corretor' && userIdRef.current) {
          return next.filter(l => l.id_corretor_responsavel === userIdRef.current);
        }
        leadsRef.current = next;
        return next;
      });
    };

    const applyUpdateUpsert = (updatedLead: KanbanLead) => {
      // Enriquecer com cache de corretor, se possível
      if (updatedLead.id_corretor_responsavel) {
        const c = corretorCacheRef.current.get(updatedLead.id_corretor_responsavel);
        if (c) {
          updatedLead = { ...updatedLead, corretor: { id: c.id, nome: c.full_name, role: c.role } as any };
          rtLog('hydrate-corretor hit', c.id);
        } else {
          ensureCorretorHydrated(updatedLead.id_corretor_responsavel, updatedLead.id);
        }
      }
      setLeads(prev => {
        const exists = prev.some(l => l.id === updatedLead.id);
        let next: KanbanLead[];
        if (exists) {
          next = prev.map(l => (l.id === updatedLead.id ? updatedLead : l));
        } else {
          // Inserir no topo quando não existe (ex.: novo dono recebendo o UPDATE)
          next = [updatedLead, ...prev];
        }

        // Fail-safe para corretores: manter apenas os próprios leads
        if (userRoleRef.current === 'corretor' && userIdRef.current) {
          next = next.filter(l => l.id_corretor_responsavel === userIdRef.current);
        }

        leadsRef.current = next;
        return next;
      });
    };

    const applyDelete = (deletedId: string) => {
      setLeads(prev => prev.filter(l => l.id !== deletedId));
    };

    // Coalescer updates por lead.id
    const scheduleCoalescedUpdate = (updatedLead: KanbanLead) => {
      const key = updatedLead.id;
      const existing = updateBufferRef.current.get(key);
      if (existing) clearTimeout(existing);
      const t = window.setTimeout(() => {
        applyUpdateUpsert(updatedLead);
        updateBufferRef.current.delete(key);
      }, 75);
      updateBufferRef.current.set(key, t);
    };

    // Buscar e cachear corretor por id; aplica patch no lead ao retornar
    const ensureCorretorHydrated = async (ownerId: string, leadIdForPatch?: string) => {
      if (!ownerId) return;
      if (corretorCacheRef.current.has(ownerId)) return; // hit
      if (pendingFetchesRef.current.has(ownerId)) return; // já buscando
      pendingFetchesRef.current.add(ownerId);
      rtLog('hydrate-corretor miss → fetch', ownerId);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, full_name, role')
          .eq('id', ownerId)
          .single();
        if (!error && data) {
          corretorCacheRef.current.set(ownerId, {
            id: data.id,
            full_name: data.full_name,
            role: data.role || 'corretor'
          });
          if (leadIdForPatch) {
            // Patch no card específico
            setLeads(prev => {
              const next = prev.map(l => {
                if (l.id !== leadIdForPatch) return l;
                return { ...l, corretor: { id: data.id, nome: data.full_name, role: data.role } as any };
              });
              leadsRef.current = next;
              return next;
            });
          }
        }
      } catch (_) {
        // silencioso
      } finally {
        pendingFetchesRef.current.delete(ownerId);
      }
    };

    // Hidratar label do novo corretor quando houver transferência
    const hydrateBrokerIfTransferred = async (prevOwnerId: string | undefined, newOwnerId: string | undefined, leadId: string) => {
      if (!newOwnerId || prevOwnerId === newOwnerId) return;
      const cached = corretorCacheRef.current.get(newOwnerId);
      if (cached) {
        setLeads(prev => {
          const next = prev.map(l => {
            if (l.id !== leadId) return l;
            return { ...l, corretor: { id: cached.id, nome: cached.full_name, role: cached.role } as any };
          });
          leadsRef.current = next;
          return next;
        });
        rtLog('hydrate-corretor hit', cached.id);
        return;
      }
      await ensureCorretorHydrated(newOwnerId, leadId);
    };

    // Setup assíncrono do canal
    const setup = async () => {
      // Se já houver canal, limpar antes de criar outro
      if (subscriptionRef.current) {
        rtLog('cleanup before subscribe');
        cleanupChannel();
      }

      // Inicializar contexto de auth (userId e role em refs)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userIdRef.current = user?.id ?? null;
      } catch (e) {
        userIdRef.current = null;
      }
      try {
        const role = await checkUserRole();
        userRoleRef.current = role;
      } catch (_) {}

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const channelName = `leads_changes_${timestamp}_${random}`;
      rtLog('subscribing', channelName);

      try {
        const subscription = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'leads' },
            (payload) => {
              const id = (payload.new as any)?.id || (payload.old as any)?.id;
              rtLog('event', payload.eventType, id);
              switch (payload.eventType) {
                case 'INSERT': {
                  const newLead = databaseLeadToKanbanLead({
                    ...payload.new as DatabaseLead,
                    stage: (payload.new.stage || 'Novo Lead') as LeadStage,
                    interest: payload.new.interest || null,
                    estimated_value: payload.new.estimated_value || null,
                    notes: payload.new.notes || null,
                    updated_at: payload.new.updated_at || null
                  });
                  applyInsert(newLead);
                  break;
                }
                case 'UPDATE': {
                  const updatedLead = databaseLeadToKanbanLead({
                    ...payload.new as DatabaseLead,
                    stage: (payload.new.stage || 'Novo Lead') as LeadStage,
                    interest: payload.new.interest || null,
                    estimated_value: payload.new.estimated_value || null,
                    notes: payload.new.notes || null,
                    updated_at: payload.new.updated_at || null
                  });
                  // Detectar transferência de responsável
                  const prevLead = leadsRef.current.find(l => l.id === updatedLead.id);
                  const oldOwner = prevLead?.id_corretor_responsavel;
                  const newOwner = (payload.new as any)?.id_corretor_responsavel as string | undefined;
                  if (oldOwner !== newOwner) {
                    rtLog('transfer', id, oldOwner, '→', newOwner);
                    // Hidratar corretor do novo dono
                    hydrateBrokerIfTransferred(oldOwner, newOwner, updatedLead.id);

                    // Re-emitir broadcast (somente gestor/admin) para sincronizar imediato entre abas
                    try {
                      const oldOwnerPayload = (payload.old as any)?.id_corretor_responsavel || null;
                      const newOwnerPayload = (payload.new as any)?.id_corretor_responsavel || null;
                      const isManager = userRoleRef.current === 'gestor' || userRoleRef.current === 'admin';
                      if (
                        isManager &&
                        oldOwnerPayload !== newOwnerPayload &&
                        companyIdRef.current &&
                        broadcastRef.current
                      ) {
                        const transferPayload = {
                          lead_id: (payload.new as any)?.id,
                          new_owner_id: newOwnerPayload,
                          company_id: companyIdRef.current
                        };
                        rtLog('broadcast send (re-emit) lead_transfer', transferPayload);
                        Promise.resolve(
                          broadcastRef.current.send({
                            type: 'broadcast',
                            event: 'lead_transfer',
                            payload: transferPayload
                          })
                        ).catch((e: any) => rtWarn('broadcast re-emit error', e));
                      }
                    } catch (e) {
                      rtWarn('broadcast re-emit error', e);
                    }
                  }

                  scheduleCoalescedUpdate(updatedLead);
                  break;
                }
                case 'DELETE': {
                  const deletedId = (payload.old as any)?.id as string;
                  applyDelete(deletedId);
                  break;
                }
              }
            }
          );

        subscriptionRef.current = subscription;

        subscription.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
            rtLog('[SUBSCRIBED]', channelName);
          }
        });
      } catch (e) {
        console.error('❌ Erro ao configurar subscription de leads:', e);
      }
    };

    setup();

    // Adicionar refetch on focus/visibility e intervalo (apenas corretores)
    let intervalId: number | null = null;
    const onVisibility = () => {
      if (!transferFixEnabled) return;
      if (document.visibilityState === 'visible' && userRoleRef.current === 'corretor') {
        rtLog('refetch:onFocus');
        fetchLeads();
      }
    };
    const onFocus = () => {
      if (!transferFixEnabled) return;
      if (userRoleRef.current === 'corretor') {
        rtLog('refetch:onFocus');
        fetchLeads();
      }
    };
    if (transferFixEnabled) {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);
      if (userRoleRef.current === 'corretor') {
        intervalId = window.setInterval(() => {
          rtLog('refetch:interval');
          fetchLeads();
        }, 60000);
      }
    }

    // Cleanup
    return () => {
      rtLog('cleanup: unsubscribe + removeChannel');
      // Limpar buffers de update
      try {
        updateBufferRef.current.forEach((t) => clearTimeout(t));
        updateBufferRef.current.clear();
      } catch (_) {}
      // Remover listeners/interval
      try {
        if (transferFixEnabled) {
          window.removeEventListener('focus', onFocus);
          document.removeEventListener('visibilitychange', onVisibility);
          if (intervalId) clearInterval(intervalId);
        }
      } catch (_) {}
      // Cleanup broadcast channel
      try {
        const b = broadcastRef.current;
        if (b) {
          rtLog('broadcast CLEANUP');
          broadcastRef.current = null;
          Promise.resolve(b.unsubscribe?.()).finally(() => {
            try { supabase.removeChannel(b); } catch (_) {}
          });
        }
      } catch (_) {}
      cleanupChannel();
    };
  }, []);

  return {
    leads,
    loading,
    error,
    userRole, // Expor o role do usuário
    fetchLeads,
    updateLeadStage,
    createLead,
    updateLead,
    deleteLead,
    bulkAssignLeads,
    getLeadsByStage,
    // Estatísticas calculadas
    totalLeads: leads.length,
    totalValue: leads.reduce((sum, lead) => sum + (lead.valor || 0), 0),
    stageStats: leads.reduce((acc, lead) => {
      acc[lead.stage] = (acc[lead.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}
