import { Info } from 'lucide-react';

export function SiteVitrineHowItWorks() {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 sm:px-5 sm:py-4 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
          <Info className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold tracking-tight">Como funciona</p>
          <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/85">
            O site público fica em <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[12px] dark:bg-amber-900/50">/s/seu-slug</code> e
            lista os imóveis disponíveis. Cada imóvel pode ter uma landing em{' '}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[12px] dark:bg-amber-900/50">/imovel/slug-da-lp</code> — configure em{' '}
            <span className="font-medium">Propriedades → abrir imóvel → Landing Page (LP)</span>. No vitrine, o card só vira link quando existir LP publicada para aquele imóvel.
          </p>
        </div>
      </div>
    </div>
  );
}
