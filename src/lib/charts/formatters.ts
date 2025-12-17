export const formatCurrencyCompact = (value: number): string => {
  if (!Number.isFinite(value)) return "R$ 0";
  if (value >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
};

export const formatCurrencyAxis = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "";
  if (value >= 1_000_000_000) return `R$${(value / 1_000_000_000).toFixed(0)}B`;
  if (value >= 1_000_000) return `R$${Math.round(value / 1_000_000)}Mi`;
  if (value >= 1_000) return `R$${Math.round(value / 1_000)}k`;
  return `R$${Math.round(value)}`;
};

export const formatPercent = (value: number, digits = 0): string => {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
};

export const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const monthLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
};
