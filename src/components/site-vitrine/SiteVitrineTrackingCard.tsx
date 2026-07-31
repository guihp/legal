import { TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Props = {
  pixel: string;
  analytics: string;
  onPixelChange: (v: string) => void;
  onAnalyticsChange: (v: string) => void;
};

export function SiteVitrineTrackingCard({
  pixel,
  analytics,
  onPixelChange,
  onAnalyticsChange,
}: Props) {
  return (
    <section
      id="sv-rastreamento"
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Rastreamento e marketing</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pixels aplicados apenas nas páginas públicas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Meta Pixel (ID)
          </label>
          <Input
            value={pixel}
            onChange={(e) => onPixelChange(e.target.value)}
            placeholder="Ex.: 123456789"
            className="rounded-xl border-border bg-background h-11"
          />
          <p className="text-xs text-muted-foreground">
            {pixel.trim() ? 'Configurado' : 'Não configurado'}
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Google Analytics (G-XXXX)
          </label>
          <Input
            value={analytics}
            onChange={(e) => onAnalyticsChange(e.target.value)}
            placeholder="Ex.: G-XXXXXXXXXX"
            className="rounded-xl border-border bg-background h-11"
          />
          <p className="text-xs text-muted-foreground">
            {analytics.trim() ? 'Configurado' : 'Não configurado'}
          </p>
        </div>
      </div>
    </section>
  );
}
