import type { ActivityRow } from './helpers';

type Props = {
  items: ActivityRow[];
  onOpenLog?: () => void;
};

const TONE: Record<ActivityRow['tone'], string> = {
  green: 'bg-emerald-400',
  blue: 'bg-sky-400',
  amber: 'bg-amber-400',
  purple: 'bg-violet-400',
  rose: 'bg-rose-400',
};

export function DashboardActivityCard({ items, onOpenLog }: Props) {
  return (
    <div
      className="rounded-2xl shadow-sm p-4 sm:p-5 h-full flex flex-col border border-emerald-950/20"
      style={{ backgroundColor: '#0C2919' }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#ffffff' }}>
        Atividade recente
      </h3>

      {items.length === 0 ? (
        <p className="text-sm flex-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Nenhuma atividade recente.
        </p>
      ) : (
        <ul className="space-y-3.5 flex-1">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2.5">
              <span
                className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${TONE[item.tone]}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug" style={{ color: '#ffffff' }}>
                  {item.text}
                </p>
                <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {item.when}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {onOpenLog ? (
        <button
          type="button"
          onClick={onOpenLog}
          className="mt-4 text-sm font-medium text-left hover:opacity-90"
          style={{ color: '#ffffff' }}
        >
          Ver log completo →
        </button>
      ) : null}
    </div>
  );
}
