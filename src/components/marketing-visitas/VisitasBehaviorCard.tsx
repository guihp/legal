import type { BehaviorMetric } from './helpers';

type Props = {
  metrics: BehaviorMetric[];
  lowVolume?: boolean;
};

export function VisitasBehaviorCard({ metrics, lowVolume }: Props) {
  return (
    <div
      className="rounded-2xl shadow-sm p-4 sm:p-5 h-full"
      style={{ backgroundColor: '#0C2919' }}
    >
      <h2 className="text-base font-semibold mb-4" style={{ color: '#ffffff' }}>
        Comportamento
      </h2>

      <ul className="space-y-4">
        {metrics.map((m) => (
          <li key={m.key}>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {m.label}
              </span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: '#ffffff' }}>
                {m.value}
              </span>
            </div>
            {typeof m.progress === 'number' ? (
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                <div
                  className={m.barClass || 'bg-emerald-300'}
                  style={{
                    height: '100%',
                    borderRadius: 9999,
                    width: `${Math.min(100, Math.max(0, m.progress))}%`,
                  }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {lowVolume ? (
        <p className="mt-5 text-[11px] leading-relaxed" style={{ color: 'rgba(190, 220, 160, 0.75)' }}>
          Volume ainda baixo para conclusões: divulgue o link do vitrine nas campanhas para ganhar
          amostra.
        </p>
      ) : null}
    </div>
  );
}
