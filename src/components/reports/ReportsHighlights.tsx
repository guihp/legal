import type { PeriodHighlight } from './helpers';

type Props = {
  items: PeriodHighlight[];
};

export function ReportsHighlights({ items }: Props) {
  return (
    <div
      className="rounded-2xl shadow-sm p-4 sm:p-5 min-w-0"
      style={{ backgroundColor: '#0C2919' }}
    >
      <h3 className="text-base font-semibold" style={{ color: '#ffffff' }}>
        Destaques do período
      </h3>
      <ul className="mt-4 space-y-3">
        {items.map((row) => (
          <li
            key={row.label}
            className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0"
          >
            <span className="text-sm text-white/70">{row.label}</span>
            <span
              className="text-sm font-medium text-right tabular-nums"
              style={{ color: '#ffffff' }}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-white/55">
        Os PDFs seguem a identidade da imobiliária, com logo e dados de contato do cadastro.
      </p>
    </div>
  );
}
