/** Valores persistidos em `conversation_contact_labels.status`. */
export type ConversationContactLabelStatus = 'ai_ativa' | 'humano' | 'humano_solicitado';

/** Texto exibido na lista / header (UI). */
export function conversationLabelStatusToDisplay(status: string | null | undefined): string {
  const s = String(status || 'ai_ativa').toLowerCase().trim();
  if (s === 'humano') return 'Humano';
  if (s === 'humano_solicitado') return 'Humano solicitado';
  return 'AI ATIVA';
}

/** Badge compacto (lista Premium / Instagram). */
export function conversationLabelListBadgeClasses(displayLabel: string | null | undefined): string {
  const d = String(displayLabel || 'AI ATIVA');
  if (d === 'Humano') {
    return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/60';
  }
  if (d === 'Humano solicitado') {
    return 'bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/60';
  }
  return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/60';
}

/** Badge outline (ConversasView legado). */
export function conversationLabelOutlineBadgeClasses(displayLabel: string | null | undefined): string {
  const d = String(displayLabel || 'AI ATIVA');
  if (d === 'Humano') return 'border-amber-500/40 text-amber-300';
  if (d === 'Humano solicitado') return 'border-orange-500/40 text-orange-300';
  return 'border-emerald-500/40 text-emerald-300';
}
