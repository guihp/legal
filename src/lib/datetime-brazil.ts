/** Fuso usado no produto para datas de negócio (cadastro, contato, etc.). */
export const BRAZIL_TIMEZONE = "America/Sao_Paulo";

const ymdFromDateInTz = (d: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/**
 * Data civil (YYYY-MM-DD) no horário de Brasília a partir de um instante ISO/Date.
 * Evita usar UTC (`toISOString().split('T')[0]`), que desloca o dia à noite/madrugada no BR.
 */
export function toCalendarDateYmdBrazil(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return ymdFromDateInTz(d, BRAZIL_TIMEZONE);
}

/**
 * Formata para exibição dd/mm/aaaa.
 * - Se for só `YYYY-MM-DD`, interpreta como **dia civil já definido** (sem meia-noite UTC).
 * - Se for timestamp ISO completo, formata o instante no fuso de Brasília.
 */
export function formatDatePtBrBrazil(input: string | Date | null | undefined): string {
  if (input == null || input === "") return "";
  if (typeof input === "string") {
    const t = input.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (m) {
      const [, y, mo, da] = m;
      return `${da}/${mo}/${y}`;
    }
  }
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return typeof input === "string" ? input : "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
