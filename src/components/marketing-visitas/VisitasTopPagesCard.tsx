import { cn } from '@/lib/utils';
import { prettyPath } from './helpers';

type PageRow = {
  path: string;
  n: number;
  page_type: string;
};

type Props = {
  pages: PageRow[];
};

export function VisitasTopPagesCard({ pages }: Props) {
  const top = pages.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5 h-full">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold text-foreground">Páginas mais visitadas</h2>
        <span className="text-xs text-muted-foreground">top 5</span>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
      ) : (
        <ul className="space-y-1">
          {top.map((row, idx) => (
            <li
              key={`${row.path}-${idx}`}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[11px] text-muted-foreground font-mono w-4 text-right tabular-nums">
                  {idx + 1}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 tracking-wide',
                    row.page_type === 'landing'
                      ? 'bg-sky-600 text-white'
                      : 'bg-emerald-700 text-white',
                  )}
                  style={{ color: '#ffffff' }}
                >
                  {row.page_type === 'landing' ? 'LP' : 'SITE'}
                </span>
                <code className="text-sm text-foreground/80 truncate font-mono" title={row.path}>
                  {prettyPath(row.path)}
                </code>
              </div>
              <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                {row.n}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
