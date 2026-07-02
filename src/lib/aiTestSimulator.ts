const DEFAULT_WEBHOOK =
  'https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/teste-ia';

export type AiTestHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiTestRequest = {
  companyId: string;
  companyName: string;
  sessionId: string;
  message: string;
  aiEnabled: boolean;
  assistantName?: string | null;
  userEmail?: string | null;
  instancia?: string | null;
  history?: AiTestHistoryItem[];
};

export type AiTestResponse = {
  reply: string;
  raw?: unknown;
};

function resolveWebhookUrl(): string {
  const fromEnv = (import.meta as { env?: Record<string, string> }).env?.VITE_AI_TEST_WEBHOOK_URL;
  return (fromEnv || DEFAULT_WEBHOOK).replace(/\/$/, '');
}

function extractReply(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';

  const data = payload as Record<string, unknown>;
  const candidates = [
    data.reply,
    data.message,
    data.response,
    data.text,
    data.output,
    data.result,
  ];

  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }

  if (Array.isArray(data.messages)) {
    const last = [...data.messages].reverse().find(
      (m) => m && typeof m === 'object' && typeof (m as { content?: string }).content === 'string',
    ) as { content?: string } | undefined;
    if (last?.content?.trim()) return last.content.trim();
  }

  return '';
}

/** Telefone estável por empresa para simular um lead de teste no WhatsApp. */
export function buildAiTestSessionId(companyId: string): string {
  const digits = companyId.replace(/\D/g, '').slice(0, 9).padEnd(9, '0');
  return `55119${digits}`.slice(0, 13);
}

export async function sendAiTestMessage(input: AiTestRequest): Promise<AiTestResponse> {
  const body = {
    test_mode: true,
    channel: 'whatsapp',
    company_id: input.companyId,
    company_name: input.companyName,
    session_id: input.sessionId,
    instancia: input.instancia || 'simulador',
    message: input.message,
    ai_enabled: input.aiEnabled,
    assistant_name: input.assistantName || null,
    user_email: input.userEmail || null,
    history: input.history || [],
  };

  const response = await fetch(resolveWebhookUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  const raw = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');

  if (!response.ok) {
    const errText =
      extractReply(raw) ||
      (typeof raw === 'object' && raw && 'error' in raw ? String((raw as { error: unknown }).error) : '') ||
      `Falha ao consultar a IA (${response.status})`;
    throw new Error(errText);
  }

  const reply = extractReply(raw);
  if (!reply) {
    throw new Error('A IA respondeu sem conteúdo. Verifique o fluxo n8n de teste.');
  }

  return { reply, raw };
}
