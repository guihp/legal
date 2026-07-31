import { Switch } from '@/components/ui/switch';
import { formatCompact } from './helpers';

type Props = {
  isPublished: boolean;
  onPublishedChange: (v: boolean) => void;
  visits30d: number | null;
  leadsFromSite: number | null;
  publishedProperties: number | null;
  totalProperties: number | null;
};

export function SiteVitrineStatusCard({
  isPublished,
  onPublishedChange,
  visits30d,
  leadsFromSite,
  publishedProperties,
  totalProperties,
}: Props) {
  const propsLabel =
    publishedProperties != null && totalProperties != null
      ? `${formatCompact(publishedProperties)} de ${formatCompact(totalProperties)}`
      : publishedProperties != null
        ? formatCompact(publishedProperties)
        : '—';

  return (
    <div
      className="rounded-2xl bg-emerald-950 p-4 sm:p-5 shadow-sm space-y-4"
      style={{ color: '#ffffff' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>
            {isPublished ? 'Site aberto ao público' : 'Site oculto (rascunho)'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {isPublished
              ? 'Indexável e visível para qualquer visitante'
              : 'Visitantes públicos não enxergam o site'}
          </p>
        </div>
        <Switch
          checked={isPublished}
          onCheckedChange={onPublishedChange}
          className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/25 shrink-0"
        />
      </div>

      <div className="border-t border-white/15 pt-3 space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>Visitas (30 d)</span>
          <span className="font-semibold tabular-nums" style={{ color: '#ffffff' }}>
            {formatCompact(visits30d)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>Leads pelo site</span>
          <span className="font-semibold tabular-nums" style={{ color: '#ffffff' }}>
            {formatCompact(leadsFromSite)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>Imóveis publicados</span>
          <span className="font-semibold tabular-nums" style={{ color: '#ffffff' }}>
            {propsLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
