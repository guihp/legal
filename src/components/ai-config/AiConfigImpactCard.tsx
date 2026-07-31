import { AI_CONFIG_EMERALD, type ImpactMetric } from './helpers';

type Props = {
  metrics: ImpactMetric[];
};

export function AiConfigImpactCard({ metrics }: Props) {
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
      style={{ backgroundColor: AI_CONFIG_EMERALD, color: '#ffffff' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: '#ffffff' }}>
        Impacto no atendimento
      </h3>

      <ul className="space-y-3.5">
        {metrics.map((m) => (
          <li key={m.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm opacity-90" style={{ color: '#ffffff' }}>
                {m.label}
              </span>
              <span
                className="text-sm font-semibold tabular-nums shrink-0"
                style={{ color: '#ffffff' }}
              >
                {m.value}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className={`h-full rounded-full ${m.barClass}`}
                style={{
                  width: `${m.percent == null ? 0 : Math.min(100, Math.max(0, m.percent))}%`,
                  opacity: m.percent == null ? 0.35 : 1,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed pt-1" style={{ color: 'rgba(255,255,255,0.72)' }}>
        Depois de salvar, use Testar IA para validar as respostas antes de deixar rodando em
        produção.
      </p>
    </div>
  );
}
