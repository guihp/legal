import { supabase } from '@/integrations/supabase/client';
import type { SimulatorMessage } from '@/components/ai-test/PhoneWhatsAppSimulator';
import {
  buildWhatsappEnviarMensagemBody,
  postWhatsappEnviarMensagem,
} from '@/lib/whatsappEnviarMensagem';

const DEFAULT_WEBHOOK =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/testar-IA-imobi';

const SESSION_STORAGE_PREFIX = 'ai-test-session:';

export type AiTestRequest = {
  companyId: string;
  sessionId: string;
  message: string;
  instancia: string;
};

function resolveWebhookUrl(): string {
  const fromEnv = (import.meta as { env?: Record<string, string> }).env?.VITE_AI_TEST_WEBHOOK_URL;
  return (fromEnv || DEFAULT_WEBHOOK).replace(/\/$/, '');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sessionStorageKey(companyId: string) {
  return `${SESSION_STORAGE_PREFIX}${companyId}`;
}

/** Novo session_id UUID para cada conversa de teste. */
export function createAiTestSessionId(): string {
  return crypto.randomUUID();
}

export function loadStoredAiTestSessionId(companyId: string): string | null {
  try {
    const saved = sessionStorage.getItem(sessionStorageKey(companyId));
    return saved && isUuid(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function storeAiTestSessionId(companyId: string, sessionId: string) {
  try {
    sessionStorage.setItem(sessionStorageKey(companyId), sessionId);
  } catch {
    /* ignore */
  }
}

export function getOrCreateAiTestSessionId(companyId: string): string {
  const existing = loadStoredAiTestSessionId(companyId);
  if (existing) return existing;
  const created = createAiTestSessionId();
  storeAiTestSessionId(companyId, created);
  return created;
}

export function rotateAiTestSessionId(companyId: string): string {
  const next = createAiTestSessionId();
  storeAiTestSessionId(companyId, next);
  return next;
}

type AiTestMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  message_type: 'text' | 'image';
  content: string | null;
  media_url: string | null;
  created_at: string;
};

export function mapAiTestRowToSimulatorMessage(row: AiTestMessageRow): SimulatorMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content || '',
    messageType: row.message_type === 'image' ? 'image' : 'text',
    mediaUrl: row.media_url || undefined,
    sentAt: row.created_at || undefined,
  };
}

export async function fetchAiTestMessages(
  companyId: string,
  sessionId: string,
): Promise<SimulatorMessage[]> {
  const { data, error } = await (supabase as any)
    .from('ai_test_messages')
    .select('id, role, message_type, content, media_url, created_at')
    .eq('company_id', companyId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data || []) as AiTestMessageRow[]).map(mapAiTestRowToSimulatorMessage);
}

export async function insertUserAiTestMessage(params: {
  companyId: string;
  sessionId: string;
  content: string;
}): Promise<SimulatorMessage> {
  const { data, error } = await (supabase as any)
    .from('ai_test_messages')
    .insert({
      company_id: params.companyId,
      session_id: params.sessionId,
      role: 'user',
      message_type: 'text',
      content: params.content,
    })
    .select('id, role, message_type, content, media_url, created_at')
    .single();

  if (error) throw error;
  return mapAiTestRowToSimulatorMessage(data as AiTestMessageRow);
}

export async function clearAiTestSessionMessages(
  companyId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('ai_test_messages')
    .delete()
    .eq('company_id', companyId)
    .eq('session_id', sessionId);

  if (error) throw error;
}

/** Envia para o n8n com o mesmo payload do chat WhatsApp. */
export async function sendAiTestMessage(input: AiTestRequest): Promise<void> {
  const body = buildWhatsappEnviarMensagemBody({
    sessionId: input.sessionId,
    instancia: input.instancia,
    companyId: input.companyId,
    tipo: 'texto',
    mensagem: input.message,
    channel: 'whatsapp',
  });

  await postWhatsappEnviarMensagem(resolveWebhookUrl(), body);
}

/** @deprecated use createAiTestSessionId */
export function buildAiTestSessionId(): string {
  return createAiTestSessionId();
}
