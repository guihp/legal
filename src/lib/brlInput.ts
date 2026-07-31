/**
 * BRL money input mask (cents-based while typing).
 * Display: 480.000,00  |  Parse: digit string as cents → number
 */

/** Format raw input (or digits) as pt-BR money. Empty → "". */
export function formatBRLInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Parse masked/raw BRL string to number. Empty → null. */
export function parseBRLInput(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return parseInt(digits, 10) / 100;
}

/** Format a numeric price for an input (e.g. when opening edit). */
export function numberToBRLInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "";
  const n = Number(value);
  if (n === 0) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
