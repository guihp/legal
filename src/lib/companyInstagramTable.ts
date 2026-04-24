/** Sufixo da tabela legada `imobipro_messages_{suffix}_instagram` (alinhado ao SQL da RPC). */
export function instagramMessagesTableSuffix(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length > 0) return digits;
  const alnum = t.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return alnum.length > 0 ? alnum : null;
}

export function instagramLegacyMessagesTableName(raw: string | null | undefined): string | null {
  const s = instagramMessagesTableSuffix(raw);
  return s ? `imobipro_messages_${s}_instagram` : null;
}
