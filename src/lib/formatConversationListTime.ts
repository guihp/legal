const TZ = 'America/Sao_Paulo';

function spDateParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function spDayKey(d: Date): string {
  const p = spDateParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

function startOfSpDay(d: Date): Date {
  const p = spDateParts(d);
  return new Date(`${p.year}-${p.month}-${p.day}T12:00:00-03:00`);
}

/** Chave YYYY-MM-DD no fuso de Brasília (para agrupar mensagens por dia). */
export function conversationDayKey(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return spDayKey(date);
}

/** Rótulo da lista (estilo WhatsApp): hoje HH:mm → Ontem → dia da semana → dd/MM/aaaa. */
export function formatConversationListTime(dateString: string, now = new Date()): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const todayStart = startOfSpDay(now);
  const msgStart = startOfSpDay(date);
  const dayDiff = Math.round((todayStart.getTime() - msgStart.getTime()) / 86400000);
  const p = spDateParts(date);

  if (dayDiff === 0) return `${p.hour}:${p.minute}`;
  if (dayDiff === 1) return 'Ontem';

  // Últimos 7 dias (exceto hoje/ontem): "segunda-feira", "quarta-feira", …
  if (dayDiff >= 2 && dayDiff < 7) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      weekday: 'long',
    }).format(date);
  }

  // Mais antigo: data completa
  return `${p.day}/${p.month}/${p.year}`;
}

/** Separador de dia no histórico do chat. */
export function formatChatDaySeparator(dateString: string, now = new Date()): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const todayKey = spDayKey(now);
  const msgKey = spDayKey(date);
  if (msgKey === todayKey) return 'Hoje';

  const yesterday = new Date(startOfSpDay(now).getTime() - 86400000);
  if (msgKey === spDayKey(yesterday)) return 'Ontem';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
