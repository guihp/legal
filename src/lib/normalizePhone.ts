/** Telefone apenas dígitos — join Mensagens_Whatsapp ↔ leads. */
export function normalizePhoneDigits(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
}
