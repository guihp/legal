import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type DatabaseLead = Tables<'leads'>;
export type LeadInsert = TablesInsert<'leads'>;
export type LeadUpdate = TablesUpdate<'leads'>;

export function useLeads() {
  const [leads, setLeads] = useState<DatabaseLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

  const createLead = async (leadData: Omit<LeadInsert, 'user_id'> & { id_corretor_responsavel?: string | null }): Promise<DatabaseLead | null> => {
    try {
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('leads')
        .insert([{ 
          ...leadData, 
          user_id: user.id,
          id_corretor_responsavel: leadData.id_corretor_responsavel ?? user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Atualizar lista local
      setLeads(prev => [data, ...prev]);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lead');
      return null;
    }
  };

  const updateLead = async (id: string, updates: LeadUpdate): Promise<DatabaseLead | null> => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Atualizar lista local
      setLeads(prev => prev.map(lead => lead.id === id ? data : lead));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar lead');
      return null;
    }
  };

  const deleteLead = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Atualizar lista local
      setLeads(prev => prev.filter(lead => lead.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar lead');
      return false;
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return { 
    leads, 
    loading, 
    error, 
    refetch: fetchLeads,
    createLead,
    updateLead,
    deleteLead
  };
}
