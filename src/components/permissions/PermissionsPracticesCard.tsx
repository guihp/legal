import { BEST_PRACTICES, PERMISSIONS_EMERALD } from './constants';

export function PermissionsPracticesCard() {
  return (
    <div
      className="rounded-2xl shadow-sm p-4 sm:p-5 h-full"
      style={{ backgroundColor: PERMISSIONS_EMERALD }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#ffffff' }}>
        Boas práticas de acesso
      </h3>
      <ul className="space-y-3">
        {BEST_PRACTICES.map((text) => (
          <li key={text} className="flex gap-2.5">
            <span
              className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }}
              aria-hidden
            />
            <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
