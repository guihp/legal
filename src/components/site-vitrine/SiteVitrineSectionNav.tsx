import {
  Box,
  Contrast,
  Image as ImageIcon,
  List,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VitrineSectionId } from './helpers';

const SECTIONS: {
  id: VitrineSectionId;
  label: string;
  Icon: typeof Box;
}[] = [
  { id: 'identidade', label: 'Identidade', Icon: Box },
  { id: 'aparencia', label: 'Aparência', Icon: Contrast },
  { id: 'textos', label: 'Textos', Icon: List },
  { id: 'assets', label: 'Logo e capas', Icon: ImageIcon },
  { id: 'rastreamento', label: 'Rastreamento', Icon: TrendingUp },
];

type Props = {
  active: VitrineSectionId;
  counts: Record<VitrineSectionId, number>;
  fillPercent: number;
  onSelect: (id: VitrineSectionId) => void;
};

export function SiteVitrineSectionNav({ active, counts, fillPercent, onSelect }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-3 py-3 sm:px-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Seções
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">
            {SECTIONS.map(({ id, label, Icon }) => {
              const isActive = active === id;
              const count = counts[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors border',
                    isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 font-medium dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive ? 'text-emerald-700 dark:text-emerald-400' : '')} />
                  <span>{label}</span>
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-semibold tabular-nums',
                      isActive
                        ? 'bg-emerald-800 text-white btn-on-emerald'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 w-full lg:w-44">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Preenchimento
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{fillPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-700 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
