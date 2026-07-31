import { Compass, Globe, Instagram, Megaphone, MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  channelLabelForVisit,
  formatDuration,
  formatVisitWhen,
  prettyPath,
  softDevice,
  softDurationSeconds,
  type VisitRow,
} from './helpers';

type Props = {
  rows: VisitRow[];
  totalInPeriod: number;
  search: string;
  onSearchChange: (v: string) => void;
};

function OriginIcon({ channelKey }: { channelKey: string }) {
  const cls = 'h-3.5 w-3.5';
  if (channelKey === 'instagram') return <Instagram className={cn(cls, 'text-pink-600')} />;
  if (channelKey === 'whatsapp') return <MessageCircle className={cn(cls, 'text-emerald-600')} />;
  if (channelKey === 'meta') return <Megaphone className={cn(cls, 'text-sky-600')} />;
  if (channelKey === 'referral') return <Compass className={cn(cls, 'text-amber-700')} />;
  return <Globe className={cn(cls, 'text-muted-foreground')} />;
}

export function VisitasRecentTable({ rows, totalInPeriod, search, onSearchChange }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 border-b border-border/60">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Últimas visitas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rows.length} registros mais recentes no período
          </p>
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrar por path ou origem..."
            className="pl-9 h-9 rounded-xl bg-muted/40 border-border/70"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Sem visitas para exibir.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border/60">
                <th className="px-4 sm:px-5 py-2.5 font-medium">Quando</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium">Página</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium">Path</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium">Origem</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium">Dispositivo</th>
                <th className="px-4 sm:px-5 py-2.5 font-medium">Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((r, idx) => {
                const origin = channelLabelForVisit(r);
                return (
                  <tr key={`${r.created_at}-${idx}`} className="hover:bg-muted/30">
                    <td className="px-4 sm:px-5 py-3 text-foreground/90 whitespace-nowrap tabular-nums">
                      {formatVisitWhen(r.created_at)}
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide',
                          r.page_type === 'landing'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
                        )}
                      >
                        {r.page_type === 'landing' ? 'Landing' : 'Vitrine'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <code className="text-xs text-foreground/70 font-mono">{prettyPath(r.path)}</code>
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-foreground/80 text-xs">
                        <OriginIcon channelKey={origin.key} />
                        {origin.label}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {softDevice(r)}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-xs text-foreground/80 tabular-nums whitespace-nowrap">
                      {formatDuration(softDurationSeconds(r))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 border-t border-border/60 bg-[#F7F5F0]/60 dark:bg-muted/20 text-xs text-muted-foreground">
        <p>
          Exibindo <span className="font-semibold text-foreground">{rows.length}</span> das{' '}
          {totalInPeriod} visitas do período
        </p>
        <p>Rastreamento próprio · sem cookies de terceiros</p>
      </div>
    </div>
  );
}
