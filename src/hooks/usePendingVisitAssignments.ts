import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserProfile } from './useUserProfile';

export type PendingVisitLead = {
  id: string;
  name: string | null;
  nomeInstagram: string | null;
  phone: string | null;
  notes: string | null;
  eventId: string;
  calendarId: string;
  updatedAt: string | null;
};

export function usePendingVisitAssignments() {
  const { profile, isManager } = useUserProfile();
  const [items, setItems] = useState<PendingVisitLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.company_id || !isManager) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: qError } = await supabase
        .from('leads')
        .select(
          'id, name, nome_instagram_cliente, phone, notes, event_id, calenda_id, updated_at, stage'
        )
        .eq('company_id', profile.company_id)
        .eq('stage', 'visita-agendada')
        .is('id_corretor_responsavel', null)
        .not('event_id', 'is', null)
        .not('calenda_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (qError) throw qError;

      const mapped: PendingVisitLead[] = (data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: (row.name as string) || null,
        nomeInstagram: (row.nome_instagram_cliente as string) || null,
        phone: (row.phone as string) || null,
        notes: (row.notes as string) || null,
        eventId: String(row.event_id),
        calendarId: String(row.calenda_id),
        updatedAt: (row.updated_at as string) || null,
      }));

      setItems(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar visitas pendentes';
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, isManager]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, isManager, refresh: load };
}
