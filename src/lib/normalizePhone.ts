/** Telefone apenas dígitos — join Mensagens_Whatsapp ↔ leads. */
export function normalizePhoneDigits(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
}

/** Chave de sessão WhatsApp (E.164 sem +); prefixa 55 para DDD+número BR. */
export function normalizePhoneForWhatsAppSession(value: string | null | undefined): string {
  const digits = normalizePhoneDigits(value);
  if (!digits) return '';
  if (digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Máscara de digitação celular BR: (DDD) 9 XXXX-XXXX (máx. 11 dígitos). */
export function formatBrazilianMobileInput(value: string): string {
  let numbers = value.replace(/\D/g, '');
  if (numbers.startsWith('55') && numbers.length > 11) {
    numbers = numbers.slice(2);
  }
  numbers = numbers.slice(0, 11);
  if (numbers.length === 0) return '';

  const ddd = numbers.slice(0, 2);
  let numero = numbers.slice(2);

  if (numero.length > 0 && !numero.startsWith('9')) {
    numero = `9${numero.slice(0, 8)}`;
  }

  if (numbers.length <= 2) return `(${ddd}`;
  if (numbers.length <= 7) return `(${ddd}) ${numero.slice(0, 5)}`;
  if (numbers.length <= 10) {
    return `(${ddd}) ${numero.slice(0, 1)} ${numero.slice(1, 5)}-${numero.slice(5)}`;
  }
  return `(${ddd}) ${numero.slice(0, 1)} ${numero.slice(1, 5)}-${numero.slice(5, 9)}`;
}

/** Formato de persistência (companies.phone): E.164 sem +, ex. 5519993022717. */
export function normalizePhoneForStorage(value: string | null | undefined): string {
  return normalizePhoneForWhatsAppSession(value);
}

/** Exibição amigável de telefone BR (não altera a chave da sessão). */
export function formatPhoneDisplayBR(digits: string): string {
  const d = normalizePhoneDigits(digits);
  if (!d) return '';
  if (d.length === 13 && d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (d.length >= 8) return `+${d}`;
  return d;
}
