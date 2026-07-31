import { FileText } from 'lucide-react';
import { formatExportWhen, type ExportHistoryItem } from './helpers';

type Props = {
  items: ExportHistoryItem[];
  onClear: () => void;
};

export function ReportsExportHistory({ items, onClear }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Exportações recentes</h3>
          <p className="text-sm text-muted-foreground">Arquivos ficam disponíveis por 30 dias</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-emerald-800 hover:text-emerald-700 dark:text-emerald-400 shrink-0"
        >
          Limpar histórico
        </button>
      </div>

      <div
        className={cnScroll(
          'mt-4 overflow-x-auto',
        )}
      >
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground border-b border-border/60">
              <th className="text-left py-2 pr-3 font-semibold">Relatório</th>
              <th className="text-left py-2 pr-3 font-semibold">Gerado em</th>
              <th className="text-left py-2 pr-3 font-semibold">Por</th>
              <th className="text-right py-2 font-semibold">Tam</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhuma exportação neste dispositivo ainda.
                </td>
              </tr>
            ) : (
              items.slice(0, 8).map((item) => (
                <tr key={item.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="truncate font-medium text-foreground">{item.filename}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatExportWhen(item.generatedAt)}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground truncate max-w-[100px]">
                    {item.by}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {item.sizeLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Histórico local neste navegador (sem backend de arquivos).
      </p>
    </div>
  );
}

function cnScroll(extra: string) {
  return `${extra} [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`;
}
