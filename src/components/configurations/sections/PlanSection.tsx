import { LayoutPanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { capitalizePlan, statusLabel, type UsageBar } from '../helpers';

type Props = {
  plan: string;
  maxUsers: number;
  status: string;
  clientSince: string;
  usage: UsageBar[];
};

export function PlanSection({ plan, maxUsers, status, clientSince, usage }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
          <LayoutPanelLeft className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Plano e assinatura</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {capitalizePlan(plan)} · renovação automática
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: 'Plano', value: capitalizePlan(plan) },
          { label: 'Máx. usuários', value: String(maxUsers || '—') },
          { label: 'Status', value: statusLabel(status) },
          { label: 'Cliente desde', value: clientSince },
        ].map((cell) => (
          <div
            key={cell.label}
            className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 min-w-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {cell.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground truncate">{cell.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Uso do plano</h3>
        <ul className="space-y-3">
          {usage.map((bar) => {
            const pct = bar.max > 0 ? Math.min(100, Math.round((bar.used / bar.max) * 100)) : 0;
            return (
              <li key={bar.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{bar.label}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {bar.used} de {bar.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${bar.barClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 shadow-sm"
          style={{ color: '#ffffff' }}
          onClick={() =>
            toast.message('Upgrade de plano ainda não está disponível nesta versão.')
          }
        >
          Fazer upgrade
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl h-9"
          onClick={() => toast.message('Notas fiscais em breve.')}
        >
          Notas fiscais
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl h-9"
          onClick={() => toast.message('Forma de pagamento em breve.')}
        >
          Forma de pagamento
        </Button>
      </div>
    </div>
  );
}
