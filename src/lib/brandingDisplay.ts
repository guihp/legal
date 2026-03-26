/**
 * Substitui marca legada exibida ao usuário por IAFÉ IMOBI (dados antigos no banco).
 */
export function normalizeBrandDisplayName(input: string | null | undefined): string {
  const s = input?.trim() ?? '';
  if (!s) return '';
  return s
    .replace(/\bimobi\s*pro\b/gi, 'IAFÉ IMOBI')
    .replace(/\bimobipro\b/gi, 'IAFÉ IMOBI');
}
