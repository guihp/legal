import { invokeEdge } from '@/integrations/supabase/invoke';

export type AssignVisitBrokerParams = {
  companyId: string;
  leadId: string;
  brokerId: string;
};

export type AssignVisitBrokerResult = {
  success: boolean;
  error?: string;
  brokerName?: string | null;
  calendarId?: string | null;
  eventId?: string | null;
};

export async function assignVisitBroker(
  params: AssignVisitBrokerParams
): Promise<AssignVisitBrokerResult> {
  const { data, error } = await invokeEdge<
    AssignVisitBrokerParams & { action: string },
    {
      success?: boolean;
      error?: string;
      broker_name?: string | null;
      calendar_id?: string | null;
      event_id?: string | null;
    }
  >('schedule-api', {
    body: {
      action: 'assign_visit_broker',
      company_id: params.companyId,
      lead_id: params.leadId,
      broker_id: params.brokerId,
    },
  });

  if (error) {
    return { success: false, error: error.message || 'Erro ao atribuir corretor' };
  }

  if (!data?.success) {
    return { success: false, error: data?.error || 'Não foi possível atribuir o corretor' };
  }

  return {
    success: true,
    brokerName: data.broker_name ?? null,
    calendarId: data.calendar_id ?? null,
    eventId: data.event_id ?? null,
  };
}
