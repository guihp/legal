import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ReportMetricCell } from './helpers';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  metrics: ReportMetricCell[];
  periodLabel: string;
  onExport: () => void;
};

export function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  metrics,
  periodLabel,
  onExport,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description} · período {periodLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 py-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl bg-muted/50 px-3 py-3 text-center">
              <p className="text-lg font-semibold tabular-nums text-foreground">{m.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.label}
              </p>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            className="btn-on-emerald rounded-xl bg-emerald-800 text-white"
            style={{ color: '#ffffff' }}
            onClick={() => {
              onExport();
              onOpenChange(false);
            }}
          >
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
