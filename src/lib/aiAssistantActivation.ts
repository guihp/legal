import { supabase } from '@/integrations/supabase/client';
import type { OwnCompanyData } from '@/hooks/useOwnCompany';

export type AiPromptFields = Pick<
  OwnCompanyData,
  | 'ai_initial_message'
  | 'ai_assistant_name'
  | 'ai_unknown_info_message'
  | 'ai_company_mission'
  | 'ai_tone'
  | 'ai_payment_methods'
  | 'ai_visit_policy'
  | 'ai_target_audience'
  | 'ai_rules'
  | 'ai_additional_info'
  | 'business_hours'
>;

const PROMPT_FIELD_CHECKS: Array<{ key: keyof AiPromptFields; label: string }> = [
  { key: 'ai_initial_message', label: 'Mensagem inicial' },
  { key: 'ai_assistant_name', label: 'Nome da IA' },
  { key: 'ai_unknown_info_message', label: 'Resposta quando não souber no cadastro' },
  { key: 'ai_company_mission', label: 'Missão da empresa' },
  { key: 'ai_tone', label: 'Tom da IA' },
  { key: 'ai_payment_methods', label: 'Métodos de pagamento' },
  { key: 'ai_visit_policy', label: 'Política de visita' },
  { key: 'ai_target_audience', label: 'Público-alvo' },
  { key: 'ai_rules', label: 'Regras da IA' },
  { key: 'ai_additional_info', label: 'Informações adicionais' },
  { key: 'business_hours', label: 'Horário de funcionamento' },
];

function isFilled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function getMissingAiPromptFields(company: AiPromptFields): string[] {
  return PROMPT_FIELD_CHECKS.filter(({ key }) => !isFilled(company[key])).map(
    ({ label }) => label,
  );
}

export async function hasConnectedWhatsApp(companyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('company_whatsapp_instances' as never)
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'connected')
    .eq('is_active', true)
    .limit(1);

  if (error) {
    console.warn('hasConnectedWhatsApp:', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function getAiActivationBlockers(
  companyId: string,
  company: AiPromptFields,
): Promise<string[]> {
  const blockers: string[] = [];

  if (!(await hasConnectedWhatsApp(companyId))) {
    blockers.push('WhatsApp não conectado — conecte em Conexões');
  }

  blockers.push(...getMissingAiPromptFields(company));
  return blockers;
}

export function formatActivationBlockersMessage(blockers: string[]): string {
  if (blockers.length === 0) return '';
  return `Para ativar a IA, complete:\n• ${blockers.join('\n• ')}`;
}
