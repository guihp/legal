import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/audit/logger';
import { toast } from 'sonner';

export type Contract = Tables<'contracts'>;
export type ContractInsert = TablesInsert<'contracts'>;
export type ContractUpdate = TablesUpdate<'contracts'>;

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  // Buscar todos os contratos
  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Buscando contratos no banco...');
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar contratos:', error);
        setError(error.message);
        return;
      }

      console.log(`✅ ${data?.length || 0} contratos encontrados:`, data);
      setContracts(data || []);
    } catch (err) {
      console.error('💥 Erro inesperado ao buscar contratos:', err);
      setError('Erro inesperado ao carregar contratos');
    } finally {
      setLoading(false);
    }
  };

  // Criar um novo contrato
  const createContract = async (contractData: ContractInsert): Promise<Contract | null> => {
    try {
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('📝 Criando contrato no banco:', contractData);

      const { data, error } = await supabase
        .from('contracts')
        .insert([{ ...contractData, created_by: user.id }])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar contrato:', error);
        toast.error(`Erro ao salvar contrato: ${error.message}`);
        return null;
      }

      console.log('✅ Contrato criado com sucesso:', data);
      toast.success('Contrato salvo com sucesso!');
      
      // Atualizar lista local
      setContracts(prev => {
        console.log('🔄 Atualizando lista local de contratos...');
        const newList = [data, ...prev];
        console.log('📋 Nova lista de contratos:', newList.length, 'contratos');
        return newList;
      });
      
      // Força uma nova busca para garantir sincronização
      setTimeout(() => {
        console.log('🔄 Forçando refresh da lista de contratos...');
        fetchContracts();
      }, 1000);
      
      try { await logAudit({ action: 'contract.created', resource: 'contract', resourceId: (data as any)?.id, meta: { tipo: (data as any)?.tipo, valor: (data as any)?.valor } }); } catch {}
      return data;
    } catch (err) {
      console.error('💥 Erro inesperado ao criar contrato:', err);
      toast.error('Erro inesperado ao salvar contrato');
      return null;
    }
  };

  // Atualizar um contrato
  const updateContract = async (id: string, updates: ContractUpdate): Promise<Contract | null> => {
    try {
      console.log('📝 Atualizando contrato:', id, updates);

      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar contrato:', error);
        toast.error(`Erro ao atualizar contrato: ${error.message}`);
        return null;
      }

      console.log('✅ Contrato atualizado com sucesso:', data);
      toast.success('Contrato atualizado com sucesso!');
      
      // Atualizar lista local
      setContracts(prev => prev.map(contract => 
        contract.id === id ? data : contract
      ));
      
      try { await logAudit({ action: 'contract.updated', resource: 'contract', resourceId: (data as any)?.id, meta: updates }); } catch {}
      return data;
    } catch (err) {
      console.error('💥 Erro inesperado ao atualizar contrato:', err);
      toast.error('Erro inesperado ao atualizar contrato');
      return null;
    }
  };

  // Deletar um contrato (estratégia híbrida: hard delete → soft delete)
  const deleteContract = async (id: string): Promise<boolean> => {
    try {
      console.log('🗑️ [DEBUG] Iniciando deleção do contrato:', id);
      
      // Primeiro, verificar se o contrato existe
      const { data: existingContract, error: checkError } = await supabase
        .from('contracts')
        .select('id, numero, client_name')
        .eq('id', id)
        .single();
      
      if (checkError) {
        console.error('❌ [DEBUG] Erro ao verificar contrato:', checkError);
        toast.error(`Contrato não encontrado: ${checkError.message}`);
        return false;
      }
      
      console.log('🔍 [DEBUG] Contrato encontrado:', existingContract);

      // ESTRATÉGIA 1: Tentar hard delete primeiro
      console.log('💀 [DEBUG] Tentativa 1: Hard Delete...');
      const { data: hardDeleteData, error: hardDeleteError } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id)
        .select();

      console.log('💀 [DEBUG] Resultado Hard Delete:', {
        data: hardDeleteData,
        error: hardDeleteError,
        deletedCount: hardDeleteData?.length || 0
      });

      // Se hard delete funcionou (retornou dados deletados)
      if (!hardDeleteError && hardDeleteData && hardDeleteData.length > 0) {
        console.log('✅ [DEBUG] Hard Delete bem-sucedido!');
        toast.success('Contrato deletado permanentemente!');
        
        // Remover da lista local
        setContracts(prev => prev.filter(contract => contract.id !== id));
        try { await logAudit({ action: 'contract.deleted', resource: 'contract', resourceId: id, meta: { hard: true } }); } catch {}
        return true;
      }

      // ESTRATÉGIA 2: Hard delete falhou, verificar se ainda existe
      console.log('🔄 [DEBUG] Hard Delete falhou ou foi bloqueado por RLS, verificando se contrato ainda existe...');
      const { data: stillExists, error: checkAfterError } = await supabase
        .from('contracts')
        .select('id')
        .eq('id', id)
        .single();

      if (!checkAfterError && stillExists) {
        console.warn('⚠️ [DEBUG] Contrato ainda existe, RLS está bloqueando hard delete');
        console.log('🔄 [DEBUG] Tentativa 2: Soft Delete (fallback)...');
        
        // Usar soft delete como fallback
        const { data: softDeleteData, error: softDeleteError } = await supabase
          .from('contracts')
          .update({ is_active: false })
          .eq('id', id)
          .select();

        console.log('🔄 [DEBUG] Resultado Soft Delete:', {
          data: softDeleteData,
          error: softDeleteError
        });

        if (softDeleteError) {
          console.error('❌ [DEBUG] Soft Delete também falhou:', softDeleteError);
          toast.error(`Erro ao deletar contrato: ${softDeleteError.message}`);
          return false;
        }

        if (softDeleteData && softDeleteData.length > 0) {
          console.log('✅ [DEBUG] Soft Delete bem-sucedido (contrato marcado como inativo)');
          toast.success('Contrato removido com sucesso!');
          
          // Remover da lista local (soft delete remove da visualização)
          setContracts(prev => prev.filter(contract => contract.id !== id));
          try { await logAudit({ action: 'contract.deleted', resource: 'contract', resourceId: id, meta: { hard: false } }); } catch {}
          return true;
        } else {
          console.error('❌ [DEBUG] Soft Delete não retornou dados');
          toast.error('Erro ao deletar contrato: operação falhou');
          return false;
        }
      } else {
        // Contrato não existe mais, hard delete pode ter funcionado silenciosamente
        console.log('✅ [DEBUG] Contrato não existe mais no banco - deleção bem-sucedida');
        toast.success('Contrato deletado com sucesso!');
        
        // Remover da lista local
        setContracts(prev => prev.filter(contract => contract.id !== id));
        return true;
      }

    } catch (err) {
      console.error('💥 [DEBUG] Erro inesperado ao deletar contrato:', err);
      toast.error('Erro inesperado ao deletar contrato');
      return false;
    }
  };

  // Gerar número único do contrato
  const generateContractNumber = (): string => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `CTR-${year}-${timestamp}`;
  };

  // Calcular próximo vencimento (para contratos de locação)
  const calculateNextDueDate = (startDate: string, paymentDay: string): string | null => {
    if (!paymentDay) return null;
    
    const start = new Date(startDate);
    const day = parseInt(paymentDay);
    
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, day);
    return nextMonth.toISOString().split('T')[0];
  };

  // Buscar contratos por status
  const getContractsByStatus = (status: Contract['status']) => {
    return contracts.filter(contract => contract.status === status);
  };

  // Buscar contratos por tipo
  const getContractsByType = (type: Contract['tipo']) => {
    return contracts.filter(contract => contract.tipo === type);
  };

  // Carregar contratos na inicialização
  useEffect(() => {
    fetchContracts();
  }, []);

  // Configurar real-time updates
  useEffect(() => {
    console.log('📡 Configurando real-time updates para contratos...');
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`contracts_realtime-${uniqueSuffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contracts'
        },
        (payload) => {
          console.log('📡 Mudança em contracts detectada:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            const newContract = payload.new as Contract;
            console.log('➕ Novo contrato via real-time:', newContract);
            if (newContract.is_active) {
              setContracts(prev => {
                console.log('📋 Adicionando contrato via real-time à lista');
                return [newContract, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedContract = payload.new as Contract;
            console.log('🔄 Contrato atualizado via real-time:', updatedContract);
            setContracts(prev => 
              prev.map(contract => 
                contract.id === updatedContract.id ? updatedContract : contract
              ).filter(contract => contract.is_active)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedContract = payload.old as Contract;
            console.log('🗑️ Contrato deletado permanentemente via real-time:', deletedContract);
            setContracts(prev => prev.filter(c => c.id !== deletedContract.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal real-time contracts:', status);
      });

    return () => {
      console.log('🧹 Removendo canal real-time contracts...');
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    contracts,
    loading,
    error,
    fetchContracts,
    createContract,
    updateContract,
    deleteContract,
    generateContractNumber,
    calculateNextDueDate,
    getContractsByStatus,
    getContractsByType,
  };
} 