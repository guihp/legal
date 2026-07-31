const SUMMARY_TEXT_KEYS = ['resumo_conversa', 'resumo', 'summary', 'message'] as const;
const WRAPPER_KEYS = ['output', 'data', 'result', 'payload', 'OUTPUT'] as const;

export interface ConversationSummaryData {
  nota_atendimento?: number;
  resumo_conversa?: string;
  status_atendimento?: string;
  proximas_acoes?: string[];
  pendencias?: string[];
  riscos?: string[];
  recomendacoes_processos?: string[];
  dados_extraidos?: Record<string, unknown>;
  metricas?: {
    total_mensagens?: number;
    mensagens_ia?: number;
    mensagens_human?: number;
    tempo_primeira_resposta_segundos?: number;
    repeticoes_detectadas?: number;
  };
  qualidade?: Record<string, number | string | null | undefined>;
  flags?: Record<string, boolean>;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseMaybeEmbeddedJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return safeParseJson(trimmed) ?? value;
  }
  return value;
}

function unwrapSummaryPayload(value: unknown): unknown {
  let current = value;

  for (let depth = 0; depth < 4; depth += 1) {
    if (current == null) return null;

    if (Array.isArray(current)) {
      current = current.length > 0 ? current[0] : null;
      continue;
    }

    if (typeof current === 'string') {
      current = parseMaybeEmbeddedJson(current);
      continue;
    }

    if (typeof current !== 'object') return current;

    const record = current as Record<string, unknown>;

    let foundWrapper = false;
    for (const key of WRAPPER_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      current = parseMaybeEmbeddedJson(record[key]);
      foundWrapper = true;
      break;
    }
    if (!foundWrapper) {
      return record;
    }
  }

  return current;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeSummaryData(value: unknown): ConversationSummaryData | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return { resumo_conversa: trimmed };
  }

  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const resumo =
    SUMMARY_TEXT_KEYS.map((key) => record[key])
      .find((candidate) => typeof candidate === 'string' && candidate.trim())
      ?.toString()
      .trim() || undefined;

  const hasStructuredFields =
    resumo != null ||
    record.status_atendimento != null ||
    record.nota_atendimento != null ||
    asStringArray(record.proximas_acoes) != null ||
    asStringArray(record.pendencias) != null ||
    asStringArray(record.riscos) != null;

  if (!hasStructuredFields) return null;

  return {
    resumo_conversa: resumo,
    nota_atendimento: asNumber(record.nota_atendimento),
    status_atendimento:
      typeof record.status_atendimento === 'string'
        ? record.status_atendimento.trim() || undefined
        : undefined,
    proximas_acoes: asStringArray(record.proximas_acoes),
    pendencias: asStringArray(record.pendencias),
    riscos: asStringArray(record.riscos),
    recomendacoes_processos: asStringArray(record.recomendacoes_processos),
    dados_extraidos:
      record.dados_extraidos && typeof record.dados_extraidos === 'object' && !Array.isArray(record.dados_extraidos)
        ? (record.dados_extraidos as Record<string, unknown>)
        : undefined,
    metricas:
      record.metricas && typeof record.metricas === 'object' && !Array.isArray(record.metricas)
        ? (record.metricas as ConversationSummaryData['metricas'])
        : undefined,
    qualidade:
      record.qualidade && typeof record.qualidade === 'object' && !Array.isArray(record.qualidade)
        ? (record.qualidade as ConversationSummaryData['qualidade'])
        : undefined,
    flags:
      record.flags && typeof record.flags === 'object' && !Array.isArray(record.flags)
        ? (record.flags as Record<string, boolean>)
        : undefined,
  };
}

function pickSummaryText(data: ConversationSummaryData | null, fallback: string): string {
  const text = data?.resumo_conversa?.trim();
  return text || fallback.trim();
}

/** Parses stored `leads.conversation_summary` — JSON object or legacy plain text. */
export function parseStoredConversationSummary(
  stored: string | null | undefined,
): ConversationSummaryData | null {
  if (!stored?.trim()) return null;

  const trimmed = stored.trim();
  const parsed = safeParseJson(trimmed);

  if (parsed != null) {
    const fromJson = normalizeSummaryData(unwrapSummaryPayload(parsed));
    if (fromJson) return fromJson;
  }

  return { resumo_conversa: trimmed };
}

/** Serializes structured summary for persistence in `leads.conversation_summary`. */
export function serializeConversationSummary(data: ConversationSummaryData): string {
  return JSON.stringify(data);
}

/** Normalizes n8n `resumo_conversa` webhook responses into structured summary data. */
export function parseConversationSummaryResponse(raw: string): {
  data: ConversationSummaryData | null;
  text: string;
  persistValue: string;
} {
  const parsed = unwrapSummaryPayload(safeParseJson(raw) ?? raw);
  const data = normalizeSummaryData(parsed);
  const text = pickSummaryText(data, typeof parsed === 'string' ? parsed : raw);

  const persistValue = data ? serializeConversationSummary(data) : text.trim();

  return { data, text, persistValue };
}
