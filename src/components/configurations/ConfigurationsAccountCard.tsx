import { Clock } from 'lucide-react';
import { CONFIG_EMERALD } from './helpers';

type Props = {
  planLabel: string;
  daysRemaining: number | null;
  startLabel: string;
  renewLabel: string;
  progress: number;
};

export function ConfigurationsAccountCard({
  planLabel,
  daysRemaining,
  startLabel,
  renewLabel,
  progress,
}: Props) {
  const daysText =
    daysRemaining == null
      ? 'sem data de expiração'
      : daysRemaining === 0
        ? 'expira hoje'
        : `${daysRemaining} dias restantes`;

  return (
    <div className="rounded-2xl p-4 sm:p-5 shadow-sm space-y-4" style={{ backgroundColor: CONFIG_EMERALD }}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
        >
          <Clock className="h-4 w-4" style={{ color: '#ffffff' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>
            Conta ativa
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
            Plano {planLabel} · {daysText}
          </p>
        </div>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: '#34d399',
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
        <span>{startLabel}</span>
        <span>renova {renewLabel}</span>
      </div>
    </div>
  );
}
